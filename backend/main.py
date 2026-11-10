"""
FastAPI Backend Application for Lumina Studio — AI Tutor & Multimodal Course Engine.
Powered by Google Cloud (Cloud Run, Cloud Firestore, Cloud Storage, Secret Manager) + Gemini 4 Argon & 3.8 Suite.
"""

import asyncio
import base64
import datetime
import json
import os
import re
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from google.genai import types
from pydantic import BaseModel

from backend.gcp_storage import GoogleCloudBackend
from backend.gemini_service import LIVE_VOICE_MODEL, GeminiTutorService
from backend.ingestion import IngestedItem, extract_single_file_bytes, ingest_web_url


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
MEDIA_DIR = DATA_DIR / "media"
KITS_DIR = DATA_DIR / "kits"
FRONTEND_DIR = BASE_DIR / "frontend"

for d in (DATA_DIR, UPLOAD_DIR, MEDIA_DIR, KITS_DIR, FRONTEND_DIR):
    d.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Modernality — AI Study Studio", version="3.1.0")

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        "ALLOWED_ORIGINS", "http://127.0.0.1:8000,http://localhost:8000"
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

MAX_UPLOAD_FILE_BYTES = 50 * 1024 * 1024  # 50 MB per file guard
SAFE_KIT_ID_RE = re.compile(r"^kit_[a-zA-Z0-9_-]{4,40}$")


def validate_safe_kit_id(kit_id: str) -> str:
    cleaned = (kit_id or "").strip()
    if not SAFE_KIT_ID_RE.fullmatch(cleaned):
        raise HTTPException(status_code=400, detail="Invalid study kit identifier.")
    return cleaned


@app.middleware("http")
async def security_and_cache_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if request.url.path == "/" or request.url.path.startswith("/static") or request.url.path.startswith("/api"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

gcp_backend = GoogleCloudBackend(
    local_kits_dir=KITS_DIR,
    local_media_dir=MEDIA_DIR,
    local_uploads_dir=UPLOAD_DIR,
)
gemini_service = GeminiTutorService(media_dir=MEDIA_DIR)

# If GEMINI_API_KEY or ELEVENLABS_API_KEY is not in env, attempt to load from Google Cloud Secret Manager
if not gemini_service.has_api_key():
    secret_key = gcp_backend.fetch_secret_api_key()
    if secret_key:
        gemini_service.set_api_key(secret_key)

if not gemini_service.has_elevenlabs_key():
    el_secret_key = gcp_backend.fetch_secret_elevenlabs_key()
    if el_secret_key:
        gemini_service.set_elevenlabs_key(el_secret_key)

# In-memory registry synced with Cloud Firestore + Local Disk
STUDY_KITS: Dict[str, Dict[str, Any]] = {}


def reload_all_kits() -> None:
    global STUDY_KITS
    STUDY_KITS = gcp_backend.load_all_study_kits()


def persist_kit(kit_record: Dict[str, Any]) -> None:
    kit_id = kit_record["id"]
    saved = gcp_backend.save_study_kit(kit_record)
    STUDY_KITS[kit_id] = saved


reload_all_kits()


class ApiKeyRequest(BaseModel):
    api_key: Optional[str] = None
    elevenlabs_api_key: Optional[str] = None
    elevenlabs_voice_id: Optional[str] = None


class ElevenLabsTtsRequest(BaseModel):
    text: str
    voice_id: Optional[str] = None


class GcpConfigRequest(BaseModel):
    project_id: str
    gcs_bucket_name: Optional[str] = None
    firestore_database: str = "(default)"
    region: str = "us-east4"


class TtsSlideRequest(BaseModel):
    kit_id: str
    slide_number: int
    narration_text: str
    voice_name: str = "Kore"


class VideoSlideRequest(BaseModel):
    kit_id: str
    slide_number: int
    visual_prompt: str
    duration_seconds: int = 5
    resolution: str = "720p"


class GradeSubmissionRequest(BaseModel):
    kit_id: str
    problem_id: str
    student_answer: str


class TutorChatRequest(BaseModel):
    kit_id: str
    message: str
    previous_interaction_id: Optional[str] = None
    persona_mode: str = "socratic"
    image_b64: Optional[str] = None
    image_mime: str = "image/jpeg"


class UpdateKitSubjectRequest(BaseModel):
    subject_area: str
    title: Optional[str] = None


class InteractiveSolveRequest(BaseModel):
    problem_text: str = ""
    image_b64: Optional[str] = None
    image_mime: str = "image/png"
    kit_id: Optional[str] = None


class GuidedStepRequest(BaseModel):
    problem_text: str = ""
    conversation_history: List[Dict[str, str]] = []
    current_step: int = 1
    total_steps: int = 6
    image_b64: Optional[str] = None
    image_mime: str = "image/png"


@app.get("/api/health")
async def health_check() -> Dict[str, Any]:
    """Cloud Run readiness and liveness probe endpoint."""
    return {
        "status": "healthy",
        "service": os.environ.get("K_SERVICE", "lumina-tutor-local"),
        "firestore_active": gcp_backend.firestore_active,
        "gcs_active": gcp_backend.gcs_active,
    }


@app.get("/api/status")
async def get_status() -> Dict[str, Any]:
    return {
        "api_key_configured": gemini_service.has_api_key(),
        "elevenlabs_configured": gemini_service.has_elevenlabs_key(),
        "elevenlabs_voice_id": gemini_service.get_elevenlabs_voice_id(),
        "kit_count": len(STUDY_KITS),
        "gcp": gcp_backend.get_cloud_status(),
    }


@app.get("/api/cloud/status")
async def get_cloud_status_endpoint() -> Dict[str, Any]:
    return gcp_backend.get_cloud_status()


@app.post("/api/cloud/config")
async def configure_gcp_backend(req: GcpConfigRequest) -> Dict[str, Any]:
    status = await asyncio.to_thread(
        gcp_backend.configure_runtime_gcp,
        req.project_id,
        req.gcs_bucket_name,
        req.firestore_database,
        req.region,
    )
    # Re-sync kits with Firestore if newly connected
    await asyncio.to_thread(reload_all_kits)
    return {"status": "ok", "gcp": status, "kit_count": len(STUDY_KITS)}


@app.post("/api/cloud/sync")
async def force_cloud_sync() -> Dict[str, Any]:
    """Pushes all local study kits to Cloud Firestore and pulls remote kits."""
    if not gcp_backend.firestore_active:
        raise HTTPException(
            status_code=400,
            detail="Cloud Firestore is not connected. Configure your GCP Project ID & ADC credentials first.",
        )
    synced_count = 0
    for kit_id, rec in list(STUDY_KITS.items()):
        await asyncio.to_thread(persist_kit, rec)
        synced_count += 1
    await asyncio.to_thread(reload_all_kits)
    return {
        "status": "synced",
        "synced_kits": synced_count,
        "gcp": gcp_backend.get_cloud_status(),
    }


@app.post("/api/config/api-key")
async def configure_api_key(req: ApiKeyRequest) -> Dict[str, Any]:
    if req.api_key and len(req.api_key.strip()) >= 8:
        gemini_service.set_api_key(req.api_key.strip())
    if req.elevenlabs_api_key or req.elevenlabs_voice_id:
        gemini_service.set_elevenlabs_key(
            req.elevenlabs_api_key or "",
            req.elevenlabs_voice_id,
        )
    if not gemini_service.has_api_key() and not gemini_service.has_elevenlabs_key():
        raise HTTPException(status_code=400, detail="Please provide a valid API key.")
    return {
        "status": "ok",
        "api_key_configured": gemini_service.has_api_key(),
        "elevenlabs_configured": gemini_service.has_elevenlabs_key(),
        "elevenlabs_voice_id": gemini_service.get_elevenlabs_voice_id(),
    }


@app.post("/api/tts/elevenlabs")
async def synthesize_elevenlabs_endpoint(req: ElevenLabsTtsRequest) -> Dict[str, Any]:
    """Synthesizes live natural speech using the ElevenLabs API (loaded from .env or Secret Manager)."""
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Text is required for speech synthesis.")
    if not gemini_service.has_elevenlabs_key():
        el_secret = await asyncio.to_thread(gcp_backend.fetch_secret_elevenlabs_key)
        if el_secret:
            gemini_service.set_elevenlabs_key(el_secret)
    if not gemini_service.has_elevenlabs_key():
        raise HTTPException(status_code=400, detail="ElevenLabs secret not yet loaded.")
    try:
        mp3_bytes = await asyncio.to_thread(
            gemini_service.synthesize_elevenlabs_mp3,
            req.text.strip(),
            req.voice_id,
        )
        return {
            "audio_base64": base64.b64encode(mp3_bytes).decode("ascii"),
            "mime_type": "audio/mpeg",
            "provider": "elevenlabs",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ElevenLabs Voice Error: {e}")


@app.get("/api/kits")
async def list_kits() -> List[Dict[str, Any]]:
    summaries = []
    for kit_id, rec in STUDY_KITS.items():
        kit_obj = rec.get("kit", {})
        summaries.append({
            "id": kit_id,
            "title": kit_obj.get("title", "Untitled Study Kit"),
            "subject_area": kit_obj.get("subject_area", "General"),
            "created_at": rec.get("created_at", ""),
            "source_count": len(rec.get("sources", [])),
            "slide_count": len(kit_obj.get("explainer_slides", [])),
            "module_count": len(kit_obj.get("lesson_modules", [])),
            "problem_count": len(kit_obj.get("practice_problems", [])),
            "flashcard_count": len(kit_obj.get("flashcards", [])),
            "synced_to_firestore": bool(rec.get("synced_to_firestore", False)),
        })
    return summaries


@app.get("/api/kits/{kit_id}")
async def get_kit(kit_id: str) -> Dict[str, Any]:
    safe_id = validate_safe_kit_id(kit_id)
    if safe_id not in STUDY_KITS:
        raise HTTPException(status_code=404, detail=f"Study kit '{safe_id}' not found.")
    return STUDY_KITS[safe_id]


@app.delete("/api/kits/{kit_id}")
async def delete_kit_endpoint(kit_id: str) -> Dict[str, Any]:
    safe_id = validate_safe_kit_id(kit_id)
    if safe_id in STUDY_KITS:
        del STUDY_KITS[safe_id]
    await asyncio.to_thread(gcp_backend.delete_study_kit, safe_id)
    return {"status": "deleted", "id": safe_id}


@app.patch("/api/kits/{kit_id}/subject")
async def update_kit_subject(kit_id: str, req: UpdateKitSubjectRequest) -> Dict[str, Any]:
    safe_id = validate_safe_kit_id(kit_id)
    if safe_id not in STUDY_KITS:
        raise HTTPException(status_code=404, detail=f"Study kit '{safe_id}' not found.")
    rec = STUDY_KITS[safe_id]
    if "kit" in rec and isinstance(rec["kit"], dict):
        if req.subject_area and req.subject_area.strip():
            rec["kit"]["subject_area"] = req.subject_area.strip()
        if req.title and req.title.strip():
            rec["kit"]["title"] = req.title.strip()
    await asyncio.to_thread(persist_kit, rec)
    return STUDY_KITS[safe_id]


@app.post("/api/ingest-and-synthesize")
async def ingest_and_synthesize(
    files: List[UploadFile] = File(default=[]),
    urls_json: str = Form(default="[]"),
    raw_notes: str = Form(default=""),
    custom_focus: str = Form(default=""),
    subject_name: str = Form(default=""),
    append_to_kit_id: str = Form(default=""),
    use_deep_model: bool = Form(default=False),
) -> Dict[str, Any]:
    if not gemini_service.has_api_key():
        raise HTTPException(
            status_code=400,
            detail="Gemini API Key required! Click the 'API Key' button in the top bar to enter your GEMINI_API_KEY.",
        )

    ingested_items: List[IngestedItem] = []

    # 1. Process uploaded files & archive raw uploads to GCS if active
    for up_file in files:
        if not up_file.filename:
            continue
        raw_bytes = await up_file.read()
        if not raw_bytes:
            continue
        if len(raw_bytes) > MAX_UPLOAD_FILE_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File '{up_file.filename}' exceeds the 50 MB per-file security limit.",
            )

        # Save raw uploaded file and sync to GCS uploads/ folder if enabled
        safe_up_name = f"{uuid.uuid4().hex[:6]}_{Path(up_file.filename).name}"
        raw_upload_path = UPLOAD_DIR / safe_up_name
        raw_upload_path.write_bytes(raw_bytes)
        if gcp_backend.gcs_active:
            await asyncio.to_thread(
                gcp_backend.upload_media_file,
                raw_upload_path,
                "uploads",
                up_file.content_type,
            )

        extracted = await asyncio.to_thread(
            extract_single_file_bytes, raw_bytes, up_file.filename, UPLOAD_DIR
        )
        ingested_items.extend(extracted)

    # 2. Process URLs (YouTube, Google Drive, Web links)
    try:
        url_list = json.loads(urls_json) if urls_json else []
    except Exception:
        url_list = [u.strip() for u in urls_json.splitlines() if u.strip()]

    for url_str in url_list:
        if isinstance(url_str, str) and url_str.strip():
            url_items = await ingest_web_url(url_str.strip(), UPLOAD_DIR)
            ingested_items.extend(url_items)

    # 3. Process pasted text/notes
    if raw_notes and raw_notes.strip():
        ingested_items.append(
            IngestedItem(
                source_name="Pasted Study Notes / Syllabus",
                source_type="Direct Text Input",
                extracted_text=raw_notes.strip(),
                mime_type="text/plain",
            )
        )

    if not ingested_items:
        raise HTTPException(
            status_code=400,
            detail="Please upload at least one file, add a YouTube/Drive/Web link, or paste study notes.",
        )

    # 4. If appending to an existing Study Kit, prepend its previously stored source items
    target_existing_rec: Optional[Dict[str, Any]] = None
    if append_to_kit_id and append_to_kit_id.strip() in STUDY_KITS:
        target_existing_rec = STUDY_KITS[append_to_kit_id.strip()]
        prior_items: List[IngestedItem] = []
        for src_dict in target_existing_rec.get("sources", []):
            if src_dict.get("extracted_text"):
                prior_items.append(
                    IngestedItem(
                        source_name=src_dict.get("source_name", "Previous Source"),
                        source_type=src_dict.get("source_type", "Stored Material"),
                        extracted_text=src_dict.get("extracted_text", ""),
                        mime_type="text/plain",
                    )
                )
        ingested_items = prior_items + ingested_items

    effective_focus = custom_focus.strip()
    if subject_name and subject_name.strip():
        effective_focus = (
            f"Subject Area: {subject_name.strip()}. {effective_focus}".strip()
        )

    try:
        study_kit = await asyncio.to_thread(
            gemini_service.synthesize_study_kit,
            ingested_items,
            effective_focus,
            use_deep_model,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini Synthesis Error: {e}")

    kit_dump = study_kit.model_dump()
    if subject_name and subject_name.strip():
        kit_dump["subject_area"] = subject_name.strip()
    elif target_existing_rec and target_existing_rec.get("kit", {}).get("subject_area"):
        kit_dump["subject_area"] = target_existing_rec["kit"]["subject_area"]

    kit_id = (
        target_existing_rec["id"]
        if target_existing_rec
        else f"kit_{uuid.uuid4().hex[:8]}"
    )

    sources_serialized = []
    for item in ingested_items:
        s_dict = item.to_summary_dict()
        s_dict["extracted_text"] = item.extracted_text[:40000]
        sources_serialized.append(s_dict)

    kit_record = {
        "id": kit_id,
        "created_at": (
            target_existing_rec.get("created_at")
            if target_existing_rec
            else datetime.datetime.now(datetime.timezone.utc).isoformat()
        ),
        "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "sources": sources_serialized,
        "kit": kit_dump,
        "slide_media": target_existing_rec.get("slide_media", {}) if target_existing_rec else {},
    }
    await asyncio.to_thread(persist_kit, kit_record)
    return STUDY_KITS[kit_id]


@app.post("/api/generate/slide-tts")
async def generate_slide_tts(req: TtsSlideRequest) -> Dict[str, Any]:
    if not gemini_service.has_api_key():
        raise HTTPException(status_code=400, detail="Gemini API Key is not configured.")

    filename = f"tts_{req.kit_id}_slide_{req.slide_number}_{req.voice_name.lower()}.wav"
    out_path = MEDIA_DIR / filename

    if not (out_path.exists() and out_path.stat().st_size > 1000):
        # Check GCS cache first
        cached = await asyncio.to_thread(gcp_backend.ensure_media_cached_locally, filename)
        if not cached:
            try:
                await asyncio.to_thread(
                    gemini_service.generate_slide_tts_audio,
                    req.narration_text,
                    filename,
                    req.voice_name,
                )
                # Upload newly generated WAV to Google Cloud Storage
                await asyncio.to_thread(
                    gcp_backend.upload_media_file, out_path, "media", "audio/wav"
                )
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"TTS Generation Error: {e}")

    audio_url = f"/media/{filename}"
    if req.kit_id in STUDY_KITS:
        STUDY_KITS[req.kit_id].setdefault("slide_media", {}).setdefault(str(req.slide_number), {})["audio_url"] = audio_url
        await asyncio.to_thread(persist_kit, STUDY_KITS[req.kit_id])

    return {"audio_url": audio_url, "slide_number": req.slide_number, "gcs_synced": gcp_backend.gcs_active}


@app.post("/api/generate/slide-video")
async def generate_slide_video(req: VideoSlideRequest) -> Dict[str, Any]:
    if not gemini_service.has_api_key():
        raise HTTPException(status_code=400, detail="Gemini API Key is not configured.")

    filename = f"omni_{req.kit_id}_slide_{req.slide_number}_{uuid.uuid4().hex[:5]}.mp4"
    out_path = MEDIA_DIR / filename
    try:
        video_url = await asyncio.to_thread(
            gemini_service.generate_concept_video,
            req.visual_prompt,
            filename,
            req.duration_seconds,
            req.resolution,
        )
        # Upload generated MP4 to Google Cloud Storage
        await asyncio.to_thread(
            gcp_backend.upload_media_file, out_path, "media", "video/mp4"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini Omni 1.1 Flash Video Error: {e}")

    if req.kit_id in STUDY_KITS:
        STUDY_KITS[req.kit_id].setdefault("slide_media", {}).setdefault(str(req.slide_number), {})["video_url"] = video_url
        await asyncio.to_thread(persist_kit, STUDY_KITS[req.kit_id])

    return {"video_url": video_url, "slide_number": req.slide_number, "gcs_synced": gcp_backend.gcs_active}


@app.post("/api/practice/grade")
async def grade_practice_submission(req: GradeSubmissionRequest) -> Dict[str, Any]:
    if not gemini_service.has_api_key():
        raise HTTPException(status_code=400, detail="Gemini API Key is not configured.")

    kit_rec = STUDY_KITS.get(req.kit_id)
    if not kit_rec:
        raise HTTPException(status_code=404, detail="Study kit not found.")

    kit_data = kit_rec.get("kit", {})
    problems = kit_data.get("practice_problems", [])
    target_prob = next((p for p in problems if p.get("id") == req.problem_id), None)
    if not target_prob:
        raise HTTPException(status_code=404, detail="Practice problem not found.")

    try:
        result = await asyncio.to_thread(
            gemini_service.grade_student_answer,
            target_prob,
            req.student_answer,
            kit_data.get("executive_summary", ""),
        )
        return result.model_dump()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Grading Error: {e}")


@app.post("/api/tutor/chat")
async def tutor_chat_turn(req: TutorChatRequest) -> Dict[str, Any]:
    if not gemini_service.has_api_key():
        raise HTTPException(status_code=400, detail="Gemini API Key is not configured.")

    kit_rec = STUDY_KITS.get(req.kit_id, {})
    kit_json_str = json.dumps(kit_rec.get("kit", {"note": "General tutoring session without a specific loaded study kit."}), indent=2)

    try:
        resp = await asyncio.to_thread(
            gemini_service.chat_tutor_turn,
            req.message,
            kit_json_str,
            req.previous_interaction_id,
            req.persona_mode,
            req.image_b64,
            req.image_mime,
        )
        return resp
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Tutor Error: {e}")


# ============================================================================
# Modernality Interactive Problem Solver & Whiteboard Endpoints
# (Combines sujaysun101/Modernality's Solution, Guided, and Whiteboard modes)
# ============================================================================
@app.post("/api/interactive/solve")
async def interactive_solve_endpoint(req: InteractiveSolveRequest) -> Dict[str, Any]:
    if not gemini_service.has_api_key():
        raise HTTPException(status_code=400, detail="Please configure your API key in Settings first.")
    kit_rec = STUDY_KITS.get(req.kit_id or "", {})
    context_str = kit_rec.get("kit", {}).get("executive_summary", "")
    try:
        res = await asyncio.to_thread(
            gemini_service.solve_interactive_problem,
            req.problem_text,
            req.image_b64,
            req.image_mime,
            context_str,
        )
        return res.model_dump()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Problem analysis failed: {e}")


@app.post("/api/interactive/whiteboard")
async def interactive_whiteboard_endpoint(req: InteractiveSolveRequest) -> Dict[str, Any]:
    if not gemini_service.has_api_key():
        raise HTTPException(status_code=400, detail="Please configure your API key in Settings first.")
    kit_rec = STUDY_KITS.get(req.kit_id or "", {})
    context_str = kit_rec.get("kit", {}).get("executive_summary", "")
    try:
        res = await asyncio.to_thread(
            gemini_service.generate_whiteboard_demo,
            req.problem_text,
            req.image_b64,
            req.image_mime,
            context_str,
        )
        return res.model_dump()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Whiteboard demo failed: {e}")


@app.post("/api/interactive/guided")
async def interactive_guided_endpoint(req: GuidedStepRequest) -> Dict[str, Any]:
    if not gemini_service.has_api_key():
        raise HTTPException(status_code=400, detail="Please configure your API key in Settings first.")
    try:
        res = await asyncio.to_thread(
            gemini_service.continue_guided_step,
            req.problem_text,
            req.conversation_history,
            req.current_step,
            req.total_steps,
            req.image_b64,
            req.image_mime,
        )
        return res.model_dump()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Guided step failed: {e}")


@app.websocket("/ws/live-tutor/{kit_id}")
async def live_tutor_websocket(websocket: WebSocket, kit_id: str) -> None:
    """
    Bidirectional WebSocket relay connecting the browser's microphone, camera/screen share,
    and text stream to real-time multimodal listening + ElevenLabs Live Voice synthesis.
    """
    await websocket.accept()

    if not gemini_service.has_api_key():
        await websocket.send_json({
            "type": "error",
            "message": "Please configure your API key in Settings first.",
        })
        await websocket.close()
        return

    use_elevenlabs = gemini_service.has_elevenlabs_key()
    kit_rec = STUDY_KITS.get(kit_id, {})
    kit_data = kit_rec.get("kit", {})
    system_prompt = (
        "You are Modernality, a warm, articulate, real-time voice and vision AI Tutor.\n"
        f"You are currently tutoring the student on: {kit_data.get('title', 'their study materials')} "
        f"({kit_data.get('subject_area', '')}).\n"
        f"Summary: {kit_data.get('executive_summary', '')}\n"
        "Keep spoken responses clear, conversational, and encouraging (2 to 4 concise spoken sentences per turn). "
        "When the student shares a screen frame or camera snapshot, inspect the equations, diagrams, or code directly and walk them through it."
    )

    client = gemini_service.get_client()
    if use_elevenlabs:
        config = types.LiveConnectConfig(
            response_modalities=[types.Modality.TEXT],
            system_instruction=types.Content(parts=[types.Part(text=system_prompt)]),
            input_audio_transcription=types.AudioTranscriptionConfig(),
        )
    else:
        config = types.LiveConnectConfig(
            response_modalities=[types.Modality.AUDIO],
            system_instruction=types.Content(parts=[types.Part(text=system_prompt)]),
            input_audio_transcription=types.AudioTranscriptionConfig(),
            output_audio_transcription=types.AudioTranscriptionConfig(),
        )

    async def speak_with_elevenlabs(spoken_text: str) -> None:
        cleaned = re.sub(r"[`*_#]+", "", spoken_text or "").strip()
        if not cleaned:
            return
        streamed_any = False
        try:
            async for pcm_chunk in gemini_service.stream_elevenlabs_pcm24k(cleaned):
                streamed_any = True
                await websocket.send_json({
                    "type": "audio",
                    "data": base64.b64encode(pcm_chunk).decode("ascii"),
                    "sample_rate": 24000,
                    "provider": "elevenlabs",
                })
        except Exception:
            pass

        if not streamed_any:
            try:
                mp3_bytes = await asyncio.to_thread(
                    gemini_service.synthesize_elevenlabs_mp3,
                    cleaned,
                )
                await websocket.send_json({
                    "type": "elevenlabs_mp3",
                    "data": base64.b64encode(mp3_bytes).decode("ascii"),
                    "provider": "elevenlabs",
                })
            except Exception as el_err:
                await websocket.send_json({
                    "type": "error",
                    "message": f"ElevenLabs Live Voice error: {el_err}",
                })

    try:
        async with client.aio.live.connect(model=LIVE_VOICE_MODEL, config=config) as session:
            await websocket.send_json({
                "type": "connected",
                "voice_provider": "elevenlabs" if use_elevenlabs else "native",
            })

            async def receive_from_browser() -> None:
                try:
                    while True:
                        raw_msg = await websocket.receive_text()
                        payload = json.loads(raw_msg)
                        msg_type = payload.get("type")

                        if msg_type == "audio":
                            pcm_bytes = base64.b64decode(payload["data"])
                            await session.send_realtime_input(
                                audio=types.Blob(data=pcm_bytes, mime_type="audio/pcm;rate=16000")
                            )
                        elif msg_type == "audio_stream_end":
                            await session.send_realtime_input(audio_stream_end=True)
                        elif msg_type == "video":
                            b64_img = payload["data"].split(",")[-1]
                            img_bytes = base64.b64decode(b64_img)
                            await session.send_realtime_input(
                                video=types.Blob(data=img_bytes, mime_type=payload.get("mime_type", "image/jpeg"))
                            )
                        elif msg_type == "text":
                            await session.send_realtime_input(text=payload.get("text", ""))
                except WebSocketDisconnect:
                    pass
                except Exception as exc:
                    try:
                        await websocket.send_json({"type": "error", "message": f"Input stream error: {exc}"})
                    except Exception:
                        pass

            async def forward_from_gemini() -> None:
                turn_text_buffer: List[str] = []
                try:
                    async for response in session.receive():
                        content = response.server_content
                        if not content:
                            continue

                        if content.model_turn and content.model_turn.parts:
                            for part in content.model_turn.parts:
                                if getattr(part, "text", None):
                                    turn_text_buffer.append(part.text)
                                    await websocket.send_json({
                                        "type": "output_transcript",
                                        "text": part.text,
                                    })
                                if not use_elevenlabs and part.inline_data and part.inline_data.data:
                                    b64_audio = base64.b64encode(part.inline_data.data).decode("ascii")
                                    await websocket.send_json({
                                        "type": "audio",
                                        "data": b64_audio,
                                        "sample_rate": 24000,
                                    })

                        if content.input_transcription and content.input_transcription.text:
                            await websocket.send_json({
                                "type": "input_transcript",
                                "text": content.input_transcription.text,
                            })

                        if content.output_transcription and content.output_transcription.text:
                            await websocket.send_json({
                                "type": "output_transcript",
                                "text": content.output_transcription.text,
                            })
                            if use_elevenlabs:
                                turn_text_buffer.append(content.output_transcription.text)

                        if getattr(content, "turn_complete", False) and use_elevenlabs and turn_text_buffer:
                            full_turn_text = "".join(turn_text_buffer).strip()
                            turn_text_buffer.clear()
                            if full_turn_text:
                                await speak_with_elevenlabs(full_turn_text)

                        if content.interrupted is True:
                            turn_text_buffer.clear()
                            await websocket.send_json({"type": "interrupted"})
                except Exception as exc:
                    try:
                        await websocket.send_json({"type": "error", "message": f"Live voice session ended: {exc}"})
                    except Exception:
                        pass

            browser_task = asyncio.create_task(receive_from_browser())
            gemini_task = asyncio.create_task(forward_from_gemini())
            done, pending = await asyncio.wait(
                [browser_task, gemini_task],
                return_when=asyncio.FIRST_COMPLETED,
            )
            for task in pending:
                task.cancel()

    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": f"Live voice connection failed: {e}"})
        except Exception:
            pass


@app.get("/media/{filename}")
async def serve_media_with_gcs_fallback(filename: str) -> FileResponse:
    """Serves generated WAV/MP4 media from local cache, pulling from Google Cloud Storage if on a new Cloud Run instance."""
    safe_name = Path(filename).name
    resolved = await asyncio.to_thread(gcp_backend.ensure_media_cached_locally, safe_name)
    if not resolved or not resolved.exists():
        raise HTTPException(status_code=404, detail=f"Media asset '{safe_name}' not found.")
    return FileResponse(resolved)


app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


@app.get("/", response_class=HTMLResponse)
async def serve_spa() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "index.html")
