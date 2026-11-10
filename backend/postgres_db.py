"""
Standalone PostgreSQL Database Layer for Modernality (`psycopg` v3).
Manages relational persistence for:
1. `subjects` — User subject folders (e.g., Calculus III, Organic Chemistry)
2. `study_kits` — Complete synthesized Study Sets, ingested sources, media URLs, and flashcard mastery (`card_ratings`)
3. `recent_problems` — Captured screen/image problems and solutions from the Interactive Problem Solver

Includes automatic schema migration and a write-through local disk mirror (`data/kits/` & `data/user_state.json`)
so data is never lost if the local PostgreSQL service is temporarily stopped, and automatically syncs into
PostgreSQL as soon as `DATABASE_URL` connects.
"""

import datetime
import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

logger = logging.getLogger("modernality.postgres")

DEFAULT_DATABASE_URL = "postgresql://modernality:modernality@localhost:5432/modernality"

DDL_SCHEMA = """
CREATE TABLE IF NOT EXISTS subjects (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL DEFAULT 'sujay',
    name VARCHAR(140) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS study_kits (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL DEFAULT 'sujay',
    title TEXT NOT NULL,
    subject_area VARCHAR(140) NOT NULL DEFAULT 'General',
    kit_payload JSONB NOT NULL,
    sources_payload JSONB NOT NULL DEFAULT '[]'::jsonb,
    slide_media JSONB NOT NULL DEFAULT '{}'::jsonb,
    card_ratings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_kits_user_subject
    ON study_kits (user_id, subject_area);

CREATE TABLE IF NOT EXISTS recent_problems (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL DEFAULT 'sujay',
    label TEXT NOT NULL,
    problem_text TEXT NOT NULL DEFAULT '',
    image_b64 TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""


class PostgresStudyDatabase:
    def __init__(self, local_kits_dir: Path, data_dir: Path, user_id: str = "sujay"):
        self.local_kits_dir = local_kits_dir
        self.data_dir = data_dir
        self.user_state_file = data_dir / "user_state.json"
        self.user_id = user_id
        self.local_kits_dir.mkdir(parents=True, exist_ok=True)
        self.data_dir.mkdir(parents=True, exist_ok=True)

        self.database_url: str = os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL).strip()
        self.pg_active: bool = False
        self.last_pg_error: Optional[str] = None

        self._initialize_postgres()

    def get_status(self) -> Dict[str, Any]:
        return {
            "backend": "PostgreSQL (Active)" if self.pg_active else "PostgreSQL (Write-Through Local Mirror)",
            "postgres_active": self.pg_active,
            "user_id": self.user_id,
            "last_error": self.last_pg_error,
        }

    def _get_connection(self) -> psycopg.Connection:
        return psycopg.connect(
            self.database_url,
            autocommit=True,
            connect_timeout=3,
            row_factory=dict_row,
        )

    def _ensure_database_exists(self) -> None:
        """If connecting to a local PostgreSQL server where the `modernality` database hasn't been created yet, creates it automatically."""
        if "/modernality" not in self.database_url:
            return
        admin_dsn = self.database_url.rsplit("/modernality", 1)[0] + "/postgres"
        try:
            with psycopg.connect(admin_dsn, autocommit=True, connect_timeout=2) as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1 FROM pg_database WHERE datname = 'modernality';")
                    if not cur.fetchone():
                        cur.execute("CREATE DATABASE modernality;")
                        logger.info("Created 'modernality' database in local PostgreSQL instance.")
        except Exception:
            pass

    def _initialize_postgres(self) -> None:
        try:
            self._ensure_database_exists()
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(DDL_SCHEMA)
            self.pg_active = True
            self.last_pg_error = None
            logger.info("Connected to standalone PostgreSQL database and verified schema.")
            self._sync_local_mirror_to_postgres()
        except Exception as e:
            self.pg_active = False
            self.last_pg_error = str(e)
            logger.info(f"PostgreSQL at DATABASE_URL not yet reachable ({e}); using write-through local disk persistence.")

    def _load_local_user_state(self) -> Dict[str, Any]:
        if self.user_state_file.exists():
            try:
                return json.loads(self.user_state_file.read_text(encoding="utf-8"))
            except Exception:
                pass
        return {"subjects": [], "recent_problems": []}

    def _save_local_user_state(self, state: Dict[str, Any]) -> None:
        self.user_state_file.write_text(json.dumps(state, indent=2), encoding="utf-8")

    def _sync_local_mirror_to_postgres(self) -> None:
        """Whenever PostgreSQL connects, ensures any locally created kits or subjects are synced into PostgreSQL."""
        if not self.pg_active:
            return
        try:
            for p in self.local_kits_dir.glob("kit_*.json"):
                try:
                    rec = json.loads(p.read_text(encoding="utf-8"))
                    if rec.get("id"):
                        self._upsert_kit_in_pg(rec)
                except Exception:
                    pass
            local_state = self._load_local_user_state()
            for subj in local_state.get("subjects", []):
                self._insert_subject_in_pg(subj)
        except Exception as e:
            logger.warning(f"Local-to-Postgres sync note: {e}")

    def _upsert_kit_in_pg(self, kit_record: Dict[str, Any]) -> None:
        kit_id = kit_record["id"]
        kit_obj = kit_record.get("kit", {})
        title = kit_obj.get("title", "Untitled Study Set")
        subject_area = kit_obj.get("subject_area", "General")
        sources = kit_record.get("sources", [])
        slide_media = kit_record.get("slide_media", {})
        card_ratings = kit_record.get("card_ratings", {})

        with self._get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO study_kits (
                        id, user_id, title, subject_area,
                        kit_payload, sources_payload, slide_media, card_ratings, updated_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    ON CONFLICT (id) DO UPDATE SET
                        title = EXCLUDED.title,
                        subject_area = EXCLUDED.subject_area,
                        kit_payload = EXCLUDED.kit_payload,
                        sources_payload = EXCLUDED.sources_payload,
                        slide_media = EXCLUDED.slide_media,
                        card_ratings = EXCLUDED.card_ratings,
                        updated_at = NOW();
                    """,
                    (
                        kit_id,
                        self.user_id,
                        title,
                        subject_area,
                        Jsonb(kit_obj),
                        Jsonb(sources),
                        Jsonb(slide_media),
                        Jsonb(card_ratings),
                    ),
                )
                if subject_area and subject_area.strip():
                    cur.execute(
                        """
                        INSERT INTO subjects (user_id, name)
                        VALUES (%s, %s)
                        ON CONFLICT (user_id, name) DO NOTHING;
                        """,
                        (self.user_id, subject_area.strip()),
                    )

    def _insert_subject_in_pg(self, name: str) -> None:
        cleaned = (name or "").strip()
        if not cleaned:
            return
        with self._get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO subjects (user_id, name)
                    VALUES (%s, %s)
                    ON CONFLICT (user_id, name) DO NOTHING;
                    """,
                    (self.user_id, cleaned),
                )

    # ========================================================================
    # Study Set Persistence (PostgreSQL Primary + Local JSON Write-Through)
    # ========================================================================
    def save_study_kit(self, kit_record: Dict[str, Any]) -> Dict[str, Any]:
        kit_id = kit_record["id"]
        kit_record.setdefault("card_ratings", {})

        # 1. Write-through local cache file
        local_file = self.local_kits_dir / f"{kit_id}.json"
        local_file.write_text(json.dumps(kit_record, indent=2), encoding="utf-8")

        # 2. Save in standalone PostgreSQL
        if not self.pg_active:
            self._initialize_postgres()
        if self.pg_active:
            try:
                self._upsert_kit_in_pg(kit_record)
                kit_record["saved_in_postgres"] = True
            except Exception as e:
                self.last_pg_error = str(e)
                self.pg_active = False
                kit_record["saved_in_postgres"] = False
        return kit_record

    def load_all_study_kits(self) -> Dict[str, Dict[str, Any]]:
        kits: Dict[str, Dict[str, Any]] = {}

        # 1. Load local write-through cache
        for p in sorted(self.local_kits_dir.glob("kit_*.json"), key=lambda x: x.stat().st_mtime, reverse=True):
            try:
                data = json.loads(p.read_text(encoding="utf-8"))
                if data.get("id"):
                    data.setdefault("card_ratings", {})
                    kits[data["id"]] = data
            except Exception:
                pass

        # 2. Load from standalone PostgreSQL (authoritative when connected)
        if not self.pg_active:
            self._initialize_postgres()
        if self.pg_active:
            try:
                with self._get_connection() as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            """
                            SELECT id, title, subject_area, kit_payload, sources_payload,
                                   slide_media, card_ratings, created_at, updated_at
                            FROM study_kits
                            WHERE user_id = %s
                            ORDER BY updated_at DESC;
                            """,
                            (self.user_id,),
                        )
                        rows = cur.fetchall()
                        for r in rows:
                            kid = r["id"]
                            rec = {
                                "id": kid,
                                "created_at": r["created_at"].isoformat() if isinstance(r["created_at"], datetime.datetime) else str(r["created_at"]),
                                "updated_at": r["updated_at"].isoformat() if isinstance(r["updated_at"], datetime.datetime) else str(r["updated_at"]),
                                "kit": r["kit_payload"],
                                "sources": r["sources_payload"] or [],
                                "slide_media": r["slide_media"] or {},
                                "card_ratings": r["card_ratings"] or {},
                                "saved_in_postgres": True,
                            }
                            kits[kid] = rec
                            (self.local_kits_dir / f"{kid}.json").write_text(
                                json.dumps(rec, indent=2), encoding="utf-8"
                            )
            except Exception as e:
                self.last_pg_error = str(e)
                self.pg_active = False

        return kits

    def delete_study_kit(self, kit_id: str) -> bool:
        local_file = self.local_kits_dir / f"{kit_id}.json"
        if local_file.exists():
            local_file.unlink()
        if self.pg_active:
            try:
                with self._get_connection() as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            "DELETE FROM study_kits WHERE id = %s AND user_id = %s;",
                            (kit_id, self.user_id),
                        )
            except Exception as e:
                self.last_pg_error = str(e)
        return True

    # ========================================================================
    # Subject Folders & Flashcard Progress Persistence
    # ========================================================================
    def list_subjects(self) -> List[str]:
        state = self._load_local_user_state()
        subjects = list(dict.fromkeys(state.get("subjects", [])))
        if self.pg_active:
            try:
                with self._get_connection() as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            "SELECT name FROM subjects WHERE user_id = %s ORDER BY created_at ASC;",
                            (self.user_id,),
                        )
                        for row in cur.fetchall():
                            if row["name"] not in subjects:
                                subjects.append(row["name"])
            except Exception:
                pass
        return subjects

    def add_subject(self, name: str) -> List[str]:
        cleaned = (name or "").strip()
        if not cleaned:
            return self.list_subjects()
        state = self._load_local_user_state()
        subj_list = state.get("subjects", [])
        if cleaned not in subj_list:
            subj_list.append(cleaned)
            state["subjects"] = subj_list
            self._save_local_user_state(state)
        if self.pg_active:
            try:
                self._insert_subject_in_pg(cleaned)
            except Exception:
                pass
        return self.list_subjects()

    def list_recent_problems(self, limit: int = 8) -> List[Dict[str, Any]]:
        state = self._load_local_user_state()
        problems: List[Dict[str, Any]] = state.get("recent_problems", [])[:limit]
        if self.pg_active:
            try:
                with self._get_connection() as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            """
                            SELECT id, label, problem_text, image_b64, created_at
                            FROM recent_problems
                            WHERE user_id = %s
                            ORDER BY created_at DESC
                            LIMIT %s;
                            """,
                            (self.user_id, limit),
                        )
                        rows = cur.fetchall()
                        if rows:
                            problems = [
                                {
                                    "id": r["id"],
                                    "label": r["label"],
                                    "text": r["problem_text"],
                                    "image": r["image_b64"],
                                    "timestamp": r["created_at"].strftime("%I:%M %p") if isinstance(r["created_at"], datetime.datetime) else "",
                                }
                                for r in rows
                            ]
            except Exception:
                pass
        return problems

    def save_recent_problem(self, prob: Dict[str, Any]) -> List[Dict[str, Any]]:
        pid = str(prob.get("id") or int(datetime.datetime.now().timestamp() * 1000))
        label = (prob.get("label") or prob.get("text") or "Captured Problem")[:80]
        text = prob.get("text") or ""
        image = prob.get("image")
        timestamp = prob.get("timestamp") or datetime.datetime.now().strftime("%I:%M %p")

        state = self._load_local_user_state()
        existing = [p for p in state.get("recent_problems", []) if p.get("label") != label]
        existing.insert(0, {"id": pid, "label": label, "text": text, "image": image, "timestamp": timestamp})
        state["recent_problems"] = existing[:8]
        self._save_local_user_state(state)

        if self.pg_active:
            try:
                with self._get_connection() as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            """
                            INSERT INTO recent_problems (id, user_id, label, problem_text, image_b64, created_at)
                            VALUES (%s, %s, %s, %s, %s, NOW())
                            ON CONFLICT (id) DO UPDATE SET
                                label = EXCLUDED.label,
                                problem_text = EXCLUDED.problem_text,
                                image_b64 = EXCLUDED.image_b64,
                                created_at = NOW();
                            """,
                            (pid, self.user_id, label, text, image),
                        )
            except Exception:
                pass
        return self.list_recent_problems()
