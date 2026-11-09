"""
Google Cloud Backend Storage & Persistence Layer for Lumina Studio.
Integrates:
1. Cloud Firestore (`google-cloud-firestore`) — Stores Study Kits, slide media mappings, and student progress in the `study_kits` collection.
2. Google Cloud Storage (`google-cloud-storage`) — Stores uploaded source files, generated `gemini-3.8-flash-tts` WAV voiceovers, and `gemini-omni-1.1-flash` MP4 concept videos in a GCS bucket.
3. Google Cloud Secret Manager (`google-cloud-secret-manager`) — Automatically retrieves `GEMINI_API_KEY` from Secret Manager when deployed on Cloud Run if not explicitly provided via env var.
4. Hybrid Local + Cloud Sync — Automatically detects GCP credentials/configuration (`GCP_PROJECT_ID`, `GCS_BUCKET_NAME`, `FIRESTORE_DATABASE`) and falls back gracefully to local disk (`data/kits`, `data/media`) when offline or unconfigured.
"""

import json
import logging
import mimetypes
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("lumina.gcp")


class GoogleCloudBackend:
    def __init__(
        self,
        local_kits_dir: Path,
        local_media_dir: Path,
        local_uploads_dir: Path,
    ):
        self.local_kits_dir = local_kits_dir
        self.local_media_dir = local_media_dir
        self.local_uploads_dir = local_uploads_dir

        self.project_id: Optional[str] = (
            os.environ.get("GCP_PROJECT_ID")
            or os.environ.get("GOOGLE_CLOUD_PROJECT")
            or os.environ.get("GCLOUD_PROJECT")
            or "personal-portfolio-470022"
        )
        self.region: str = os.environ.get("GCP_REGION", "us-east4")
        self.gcs_bucket_name: Optional[str] = os.environ.get(
            "GCS_BUCKET_NAME", f"{self.project_id}-lumina-media"
        )
        self.firestore_database: str = os.environ.get("FIRESTORE_DATABASE", "(default)")
        self.firestore_collection: str = os.environ.get("FIRESTORE_COLLECTION", "lumina_study_kits")
        self.secret_id: str = os.environ.get("GEMINI_SECRET_ID", "GEMINI_API_KEY")

        self._firestore_client = None
        self._storage_client = None
        self._gcs_bucket = None
        self.firestore_active: bool = False
        self.gcs_active: bool = False
        self.last_cloud_error: Optional[str] = None

        self._initialize_cloud_clients()

    def _initialize_cloud_clients(self) -> None:
        """Initializes Cloud Firestore and Cloud Storage clients if GCP_PROJECT_ID is configured."""
        if not self.project_id:
            return

        # 1. Initialize Cloud Firestore
        try:
            from google.cloud import firestore

            self._firestore_client = firestore.Client(
                project=self.project_id,
                database=self.firestore_database,
            )
            self.firestore_active = True
            logger.info(
                f"Connected to Cloud Firestore (project={self.project_id}, db={self.firestore_database})"
            )
        except Exception as e:
            self.firestore_active = False
            self.last_cloud_error = f"Firestore init note: {e}"
            logger.warning(self.last_cloud_error)

        # 2. Initialize Google Cloud Storage
        if self.gcs_bucket_name:
            try:
                from google.cloud import storage

                self._storage_client = storage.Client(project=self.project_id)
                self._gcs_bucket = self._storage_client.bucket(self.gcs_bucket_name)
                self.gcs_active = True
                logger.info(f"Connected to Google Cloud Storage bucket gs://{self.gcs_bucket_name}")
            except Exception as e:
                self.gcs_active = False
                self.last_cloud_error = f"GCS init note: {e}"
                logger.warning(self.last_cloud_error)

    def configure_runtime_gcp(
        self,
        project_id: str,
        gcs_bucket_name: Optional[str] = None,
        firestore_database: str = "(default)",
        region: str = "us-east4",
    ) -> Dict[str, Any]:
        """Allows dynamic configuration of GCP Project, GCS Bucket, and Firestore Database from the UI."""
        self.project_id = project_id.strip() if project_id else None
        if self.project_id:
            os.environ["GCP_PROJECT_ID"] = self.project_id
        if gcs_bucket_name is not None:
            self.gcs_bucket_name = gcs_bucket_name.strip() or None
            if self.gcs_bucket_name:
                os.environ["GCS_BUCKET_NAME"] = self.gcs_bucket_name
        if firestore_database:
            self.firestore_database = firestore_database.strip()
            os.environ["FIRESTORE_DATABASE"] = self.firestore_database
        if region:
            self.region = region.strip()
            os.environ["GCP_REGION"] = self.region

        self.last_cloud_error = None
        self._initialize_cloud_clients()
        return self.get_cloud_status()

    def fetch_secret_api_key(self) -> Optional[str]:
        """Attempts to load GEMINI_API_KEY from Google Cloud Secret Manager if running in GCP."""
        if not self.project_id:
            return None
        try:
            from google.cloud import secretmanager

            client = secretmanager.SecretManagerServiceClient()
            name = f"projects/{self.project_id}/secrets/{self.secret_id}/versions/latest"
            response = client.access_secret_version(request={"name": name})
            secret_val = response.payload.data.decode("UTF-8").strip()
            if secret_val:
                os.environ["GEMINI_API_KEY"] = secret_val
                return secret_val
        except Exception as e:
            logger.debug(f"Secret Manager lookup skipped: {e}")
        return None

    def get_cloud_status(self) -> Dict[str, Any]:
        is_cloud_run = bool(os.environ.get("K_SERVICE"))
        return {
            "project_id": self.project_id,
            "region": self.region,
            "gcs_bucket_name": self.gcs_bucket_name,
            "firestore_database": self.firestore_database,
            "firestore_collection": self.firestore_collection,
            "firestore_active": self.firestore_active,
            "gcs_active": self.gcs_active,
            "running_on_cloud_run": is_cloud_run,
            "cloud_run_service": os.environ.get("K_SERVICE"),
            "cloud_run_revision": os.environ.get("K_REVISION"),
            "storage_mode": (
                "Google Cloud (Firestore + GCS)"
                if (self.firestore_active and self.gcs_active)
                else (
                    "Google Cloud Firestore + Local Media"
                    if self.firestore_active
                    else "Hybrid Local Disk (Configure GCP Project to enable Cloud Sync)"
                )
            ),
            "last_cloud_error": self.last_cloud_error,
        }

    # ========================================================================
    # Study Kit Persistence (Cloud Firestore + Local Cache)
    # ========================================================================
    def save_study_kit(self, kit_record: Dict[str, Any]) -> Dict[str, Any]:
        kit_id = kit_record["id"]

        # 1. Always save local JSON cache for zero-latency reads
        local_file = self.local_kits_dir / f"{kit_id}.json"
        local_file.write_text(json.dumps(kit_record, indent=2), encoding="utf-8")

        # 2. Persist to Cloud Firestore if active
        if self.firestore_active and self._firestore_client:
            try:
                doc_ref = self._firestore_client.collection(self.firestore_collection).document(kit_id)
                doc_ref.set(kit_record, merge=True)
                kit_record["synced_to_firestore"] = True
            except Exception as e:
                self.last_cloud_error = f"Firestore write warning: {e}"
                logger.warning(self.last_cloud_error)
                kit_record["synced_to_firestore"] = False
        return kit_record

    def delete_study_kit(self, kit_id: str) -> None:
        local_file = self.local_kits_dir / f"{kit_id}.json"
        if local_file.exists():
            try:
                local_file.unlink()
            except Exception:
                pass
        if self.firestore_active and self._firestore_client:
            try:
                self._firestore_client.collection(self.firestore_collection).document(kit_id).delete()
            except Exception as e:
                logger.warning(f"Firestore delete note: {e}")

    def load_all_study_kits(self) -> Dict[str, Dict[str, Any]]:
        kits: Dict[str, Dict[str, Any]] = {}

        # 1. Load local JSON kits
        for p in sorted(self.local_kits_dir.glob("*.json"), reverse=True):
            try:
                data = json.loads(p.read_text(encoding="utf-8"))
                if "id" in data and data["id"] != "kit_quantum_demo":
                    kits[data["id"]] = data
            except Exception:
                pass

        # 2. Load from Cloud Firestore if active
        if self.firestore_active and self._firestore_client:
            try:
                docs = (
                    self._firestore_client.collection(self.firestore_collection)
                    .limit(100)
                    .stream()
                )
                for doc in docs:
                    data = doc.to_dict()
                    if data and "id" in data and data["id"] != "kit_quantum_demo":
                        data["synced_to_firestore"] = True
                        kits[data["id"]] = data
            except Exception as e:
                err_str = str(e)
                if "SERVICE_DISABLED" in err_str or "firestore.googleapis.com" in err_str:
                    self.last_cloud_error = "Cloud Firestore API is not yet enabled on personal-portfolio-470022 (using local storage fallback)."
                else:
                    self.last_cloud_error = f"Firestore sync note: {err_str[:160]}"
                logger.warning(self.last_cloud_error)

        return kits

    # ========================================================================
    # Media & Asset Storage (Google Cloud Storage + Local Cache)
    # ========================================================================
    def upload_media_file(
        self,
        local_path: Path,
        blob_folder: str = "media",
        content_type: Optional[str] = None,
    ) -> str:
        """
        Uploads a generated WAV audio, MP4 video, or ingested source file to GCS (`gs://<bucket>/<blob_folder>/<filename>`).
        Returns the public/proxy URL to serve the asset.
        """
        filename = local_path.name
        if not content_type:
            content_type, _ = mimetypes.guess_type(filename)
            content_type = content_type or "application/octet-stream"

        if self.gcs_active and self._gcs_bucket and local_path.exists():
            blob_name = f"{blob_folder}/{filename}"
            try:
                blob = self._gcs_bucket.blob(blob_name)
                blob.upload_from_filename(str(local_path), content_type=content_type)
                logger.info(f"Uploaded {filename} to gs://{self.gcs_bucket_name}/{blob_name}")
            except Exception as e:
                self.last_cloud_error = f"GCS upload warning: {e}"
                logger.warning(self.last_cloud_error)

        return f"/media/{filename}"

    def ensure_media_cached_locally(self, filename: str) -> Optional[Path]:
        """If a media file is requested on a stateless Cloud Run instance and not in local `/media`, fetches it from GCS."""
        local_target = self.local_media_dir / filename
        if local_target.exists():
            return local_target

        if self.gcs_active and self._gcs_bucket:
            blob_name = f"media/{filename}"
            try:
                blob = self._gcs_bucket.blob(blob_name)
                if blob.exists():
                    blob.download_to_filename(str(local_target))
                    return local_target
            except Exception as e:
                logger.warning(f"GCS download fallback warning for {filename}: {e}")

        return None
