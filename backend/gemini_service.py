"""
Gemini AI Service Layer for Lumina Studio.
Strictly adheres to the latest Google GenAI SDK (`google-genai >= 2.30.1`) and Interactions API:
- `client.interactions.create(...)` for structured course synthesis, multi-turn tutoring, grading, TTS, and Omni Flash video generation.
- `client.aio.live.connect(model="gemini-3.8-live", ...)` for real-time bidirectional voice & vision tutoring over WebSockets.
"""

import base64
import json
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from google import genai
from google.genai import types

from backend.ingestion import IngestedItem
from backend.schemas import (
    GradingResult,
    GuidedStepReply,
    InteractiveSolutionResponse,
    StudyKitGeneration,
    WhiteboardDemoResponse,
)


TEXT_REASONING_MODEL = "gemini-3.8-flash"
DEEP_REASONING_MODEL = "gemini-4-argon"
TTS_MODEL = "gemini-3.8-flash-tts"
OMNI_VIDEO_MODEL = "gemini-omni-1.1-flash"
LIVE_VOICE_MODEL = "gemini-3.8-live"


class GeminiTutorService:
    def __init__(self, media_dir: Path):
        self.media_dir = media_dir
        self.media_dir.mkdir(parents=True, exist_ok=True)
        self._runtime_api_key: Optional[str] = None

    def set_api_key(self, key: str) -> None:
        if key and key.strip():
            self._runtime_api_key = key.strip()
            os.environ["GEMINI_API_KEY"] = self._runtime_api_key

    def get_api_key(self) -> Optional[str]:
        return self._runtime_api_key or os.environ.get("GEMINI_API_KEY")

    def has_api_key(self) -> bool:
        key = self.get_api_key()
        return bool(key and len(key.strip()) > 8)

    def get_client(self, timeout_ms: Optional[int] = None) -> genai.Client:
        api_key = self.get_api_key()
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured. Please enter your Gemini API Key in the Studio header or set GEMINI_API_KEY in your environment.")
        if timeout_ms:
            return genai.Client(api_key=api_key, http_options=types.HttpOptions(timeout=timeout_ms))
        return genai.Client(api_key=api_key)

    def build_multimodal_input_parts(
        self,
        items: List[IngestedItem],
        user_prompt: str,
        client: genai.Client,
    ) -> List[Dict[str, Any]]:
        """Constructs the Interactions API input parts array from all ingested documents, images, audio/video, and links."""
        parts: List[Dict[str, Any]] = []
        compiled_text_sections: List[str] = []

        for idx, item in enumerate(items):
            if item.extracted_text:
                compiled_text_sections.append(
                    f"=== SOURCE {idx + 1}: {item.source_name} ({item.source_type}) ===\n{item.extracted_text[:60000]}"
                )

            if item.media_part:
                parts.append(item.media_part)

            if item.local_file_path and os.path.exists(item.local_file_path):
                try:
                    uploaded = client.files.upload(file=item.local_file_path)
                    # Wait briefly if processing
                    for _ in range(15):
                        f_info = client.files.get(name=uploaded.name)
                        state_str = str(getattr(f_info, "state", "")).upper()
                        if "ACTIVE" in state_str or not state_str:
                            break
                        time.sleep(2)
                    mime = item.mime_type or getattr(uploaded, "mime_type", "video/mp4")
                    part_type = "audio" if mime.startswith("audio/") else ("video" if mime.startswith("video/") else "document")
                    parts.append({
                        "type": part_type,
                        "uri": uploaded.uri,
                        "mime_type": mime,
                    })
                except Exception as e:
                    compiled_text_sections.append(f"[Warning uploading media {item.source_name} to Files API: {e}]")

        full_text_block = "\n\n".join(compiled_text_sections)
        parts.append({
            "type": "text",
            "text": f"{user_prompt}\n\n--- INGESTED STUDY MATERIALS ---\n{full_text_block}",
        })
        return parts

    def synthesize_study_kit(
        self,
        items: List[IngestedItem],
        custom_focus: str = "",
        use_deep_model: bool = False,
    ) -> StudyKitGeneration:
        """Synthesizes a complete StudyKitGeneration from ingested materials using Gemini Interactions API structured output."""
        client = self.get_client(timeout_ms=300_000)
        model_name = DEEP_REASONING_MODEL if use_deep_model else TEXT_REASONING_MODEL

        focus_instruction = f"\nStudent's Specific Focus / Goal: {custom_focus}\n" if custom_focus.strip() else ""
        prompt = (
            "You are Lumina, a world-class pedagogical architect, university professor, and visual storyteller.\n"
            "Analyze all attached and extracted study materials thoroughly and synthesize a comprehensive, "
            "crystal-clear, deeply engaging Study Kit.\n"
            f"{focus_instruction}\n"
            "Requirements:\n"
            "1. `explainer_slides` (6-8 slides): Create a cohesive, progressive breakdown video sequence. "
            "Each slide MUST have natural, conversational `narration` (2-4 sentences ready for TTS voiceover), "
            "3-4 crisp `bullets`, an optional `key_formula_or_code` (LaTeX without outer $$ or short code), "
            "a valid `mermaid_diagram` (`flowchart LR` or `flowchart TD` with all node labels in double quotes like `A[\"Node Label\"] --> B[\"Next Step\"]` and no HTML tags), "
            "and a vivid `visual_video_prompt` for Gemini Omni 1.1 Flash to generate a 5-second educational animation.\n"
            "2. `lesson_modules` (3-5 modules): Structured curriculum modules with deep Markdown explanations, "
            "intuitive real-world analogies, learning objectives, and common pitfalls.\n"
            "3. `guided_tutorial_steps` (4-6 steps): Interactive step-by-step problem-solving walkthroughs with worked examples and a quick check-your-understanding micro-question.\n"
            "4. `practice_problems` (6-8 problems): Mix of `multiple_choice` (with 4 options) and `free_response` across Easy, Medium, and Hard difficulties. Include 3 progressive hints and a thorough step-by-step solution.\n"
            "5. `flashcards` (10-14 cards): High-yield active-recall flashcards with mnemonics/tips.\n"
            "6. `concept_nodes` (8-14 nodes) & `concept_edges` (10-20 edges): A connected knowledge graph mapping core concepts, prerequisites, and applications."
        )

        input_parts = self.build_multimodal_input_parts(items, prompt, client)

        interaction = client.interactions.create(
            model=model_name,
            input=input_parts,
            response_format={
                "type": "text",
                "mime_type": "application/json",
                "schema": StudyKitGeneration.model_json_schema(),
            },
        )

        return StudyKitGeneration.model_validate_json(interaction.output_text)

    def generate_slide_tts_audio(
        self,
        narration_text: str,
        output_filename: str,
        voice_name: str = "Kore",
        style_direction: str = "warm, articulate, engaging educator explaining a key concept clearly",
    ) -> str:
        """Generates expressive WAV voiceover narration for a breakdown slide using `gemini-3.8-flash-tts`."""
        client = self.get_client(timeout_ms=120_000)
        output_path = self.media_dir / output_filename

        interaction = client.interactions.create(
            model=TTS_MODEL,
            input=[{
                "type": "user_input",
                "content": [{
                    "type": "text",
                    "text": narration_text,
                    "annotations": [{
                        "type": "speech_metadata",
                        "style": style_direction,
                    }],
                }],
            }],
            response_format={"type": "audio"},
            generation_config={
                "speech_config": [
                    {"voice": voice_name},
                ]
            },
        )

        if not interaction.output_audio or not interaction.output_audio.data:
            raise RuntimeError("No audio data returned by gemini-3.8-flash-tts")

        wav_bytes = base64.b64decode(interaction.output_audio.data)
        output_path.write_bytes(wav_bytes)
        return f"/media/{output_filename}"

    def generate_concept_video(
        self,
        visual_prompt: str,
        output_filename: str,
        duration_seconds: int = 5,
        resolution: str = "720p",
    ) -> str:
        """Generates a generative AI concept animation clip using `gemini-omni-1.1-flash`."""
        client = self.get_client(timeout_ms=600_000)
        output_path = self.media_dir / output_filename

        enhanced_prompt = (
            f"Continuous, unbroken educational visualization clip: {visual_prompt}. "
            "Clean, high-contrast cinematic scientific/conceptual motion graphics, smooth camera movement, "
            "calm ambient educational sound design. No spoken dialogue."
        )

        interaction = client.interactions.create(
            model=OMNI_VIDEO_MODEL,
            input=[{
                "type": "text",
                "text": enhanced_prompt,
            }],
            response_format={
                "type": "video",
                "delivery": "uri",
                "aspect_ratio": "16:9",
                "duration": f"{max(3, min(10, int(duration_seconds)))}s",
                "resolution": resolution,
            },
        )

        output_video = getattr(interaction, "output_video", None)
        if not output_video or not getattr(output_video, "uri", None):
            raise RuntimeError("No video URI returned from gemini-omni-1.1-flash.")

        video_bytes = client.files.download(file=output_video.uri)
        output_path.write_bytes(video_bytes)
        return f"/media/{output_filename}"

    def grade_student_answer(
        self,
        problem: Dict[str, Any],
        student_answer: str,
        course_context_summary: str,
    ) -> GradingResult:
        """Evaluates a student's free-response or multiple-choice explanation with step-by-step rubric feedback."""
        client = self.get_client(timeout_ms=90_000)

        prompt = (
            "You are an encouraging, rigorous AI Tutor grading a student's practice problem submission.\n\n"
            f"Course Context: {course_context_summary}\n"
            f"Question ({problem.get('difficulty', 'Medium')} - {problem.get('topic_tag', '')}):\n{problem.get('question')}\n\n"
            f"Reference Correct Answer: {problem.get('correct_answer')}\n"
            f"Reference Step-by-Step Solution:\n{problem.get('step_by_step_solution')}\n\n"
            f"Student's Submitted Answer:\n{student_answer}\n\n"
            "Grade the student's response fairly from 0 to 100, highlight specific strengths, identify any misconceptions "
            "or missing steps, and provide constructive, step-by-step feedback."
        )

        interaction = client.interactions.create(
            model=TEXT_REASONING_MODEL,
            input=prompt,
            response_format={
                "type": "text",
                "mime_type": "application/json",
                "schema": GradingResult.model_json_schema(),
            },
        )
        return GradingResult.model_validate_json(interaction.output_text)

    def chat_tutor_turn(
        self,
        user_message: str,
        course_context: str,
        previous_interaction_id: Optional[str] = None,
        persona_mode: str = "socratic",
        image_b64: Optional[str] = None,
        image_mime: str = "image/jpeg",
    ) -> Dict[str, Any]:
        """Stateful multi-turn AI Tutor conversation using `previous_interaction_id` on the Interactions API."""
        client = self.get_client(timeout_ms=120_000)

        persona_instructions = {
            "socratic": (
                "Use the Socratic method: guide the student to discover answers through insightful questions, "
                "clear intuition, and concrete examples rather than just dumping rote answers."
            ),
            "eli5": (
                "Explain like the student is a curious beginner: use vivid analogies, zero unnecessary jargon, "
                "and build from everyday intuition up to the formal concept."
            ),
            "deep_dive": (
                "Provide rigorous, graduate-level depth: include formal mathematical derivations, edge cases, "
                "underlying mechanisms, and connections to advanced literature."
            ),
            "exam_coach": (
                "Act as an high-yield exam prep coach: focus on problem-solving patterns, time-saving heuristics, "
                "common trap answers, and how concepts are tested."
            ),
        }
        style_guide = persona_instructions.get(persona_mode, persona_instructions["socratic"])

        system_instruction = (
            "You are Lumina, an interactive AI Tutor pair-studying with the user.\n"
            f"Pedagogical Style: {style_guide}\n"
            "Use clean Markdown and LaTeX math ($...$ inline, $$...$$ block) when helpful.\n\n"
            f"=== ACTIVE STUDY KIT CONTEXT ===\n{course_context[:45000]}"
        )

        input_parts: List[Dict[str, Any]] = []
        if image_b64:
            clean_b64 = image_b64.split(",")[-1] if "," in image_b64 else image_b64
            input_parts.append({
                "type": "image",
                "data": clean_b64,
                "mime_type": image_mime,
            })
        input_parts.append({
            "type": "text",
            "text": user_message,
        })

        kwargs: Dict[str, Any] = {
            "model": TEXT_REASONING_MODEL,
            "input": input_parts,
            "system_instruction": system_instruction,
        }
        if previous_interaction_id:
            kwargs["previous_interaction_id"] = previous_interaction_id

        interaction = client.interactions.create(**kwargs)
        return {
            "interaction_id": interaction.id,
            "reply": interaction.output_text or "I'm here! Could you rephrase that question?",
        }

    # ========================================================================
    # Modernality Interactive Problem Solver & Whiteboard Engine
    # (Combines sujaysun101/Modernality's Solution, Guided, and Whiteboard modes)
    # ========================================================================
    def solve_interactive_problem(
        self,
        problem_text: str,
        image_b64: Optional[str] = None,
        image_mime: str = "image/png",
        course_context: str = "",
    ) -> InteractiveSolutionResponse:
        """Generates structured Given / Find / Formula / Work / Note / Answer steps for a captured or typed problem."""
        client = self.get_client(timeout_ms=90_000)

        prompt = (
            "You are Modernality, an expert interactive tutor analyzing a student's captured or submitted problem.\n"
            "Break the solution down into clear, pedagogical steps using the step types: "
            "'given' (all known values/assumptions), 'find' (what we need to determine), 'formula' (governing equations/principles), "
            "'work' (each intermediate derivation/calculation step with an explanation of WHY we do it), "
            "'note' (common pitfalls or key intuition), and 'answer' (the final boxed answer with units).\n"
            "Use clean LaTeX math ($...$ inline, $$...$$ display) where appropriate.\n\n"
        )
        if course_context:
            prompt += f"Relevant Course Context:\n{course_context[:15000]}\n\n"
        prompt += f"Problem Statement / Notes:\n{problem_text or 'Analyze the problem shown in the attached image.'}"

        input_parts: List[Dict[str, Any]] = []
        if image_b64:
            clean_b64 = image_b64.split(",")[-1] if "," in image_b64 else image_b64
            input_parts.append({"type": "image", "data": clean_b64, "mime_type": image_mime})
        input_parts.append({"type": "text", "text": prompt})

        interaction = client.interactions.create(
            model=TEXT_REASONING_MODEL,
            input=input_parts,
            response_format={
                "type": "text",
                "mime_type": "application/json",
                "schema": InteractiveSolutionResponse.model_json_schema(),
            },
        )
        return InteractiveSolutionResponse.model_validate_json(interaction.output_text)

    def generate_whiteboard_demo(
        self,
        problem_text: str,
        image_b64: Optional[str] = None,
        image_mime: str = "image/png",
        course_context: str = "",
    ) -> WhiteboardDemoResponse:
        """Generates a real-time whiteboard demonstration sequence with spoken narration and board writing per step."""
        client = self.get_client(timeout_ms=90_000)

        prompt = (
            "You are Modernality, demonstrating how to solve a problem step-by-step on an interactive whiteboard while speaking aloud.\n"
            "For each step, provide:\n"
            "- `step_type`: 'given', 'formula', 'work', 'note', or 'answer'\n"
            "- `narration`: Conversational spoken voiceover explaining WHY you make this decision ('First, let's identify what we're given...')\n"
            "- `board_heading`: Short title written on the board for this step\n"
            "- `board_equation_or_text`: The exact equation, work line, or key relation written on the whiteboard canvas.\n\n"
        )
        if course_context:
            prompt += f"Relevant Course Context:\n{course_context[:15000]}\n\n"
        prompt += f"Problem to Demonstrate:\n{problem_text or 'Demonstrate how to solve the problem in the attached image.'}"

        input_parts: List[Dict[str, Any]] = []
        if image_b64:
            clean_b64 = image_b64.split(",")[-1] if "," in image_b64 else image_b64
            input_parts.append({"type": "image", "data": clean_b64, "mime_type": image_mime})
        input_parts.append({"type": "text", "text": prompt})

        interaction = client.interactions.create(
            model=TEXT_REASONING_MODEL,
            input=input_parts,
            response_format={
                "type": "text",
                "mime_type": "application/json",
                "schema": WhiteboardDemoResponse.model_json_schema(),
            },
        )
        return WhiteboardDemoResponse.model_validate_json(interaction.output_text)

    def continue_guided_step(
        self,
        problem_text: str,
        conversation_history: List[Dict[str, str]],
        current_step: int,
        total_steps: int = 6,
        image_b64: Optional[str] = None,
        image_mime: str = "image/png",
    ) -> GuidedStepReply:
        """Socratic Guided Learning mode from Modernality: validates student step, never gives away final answer prematurely."""
        client = self.get_client(timeout_ms=90_000)

        history_str = "\n".join(
            f"{m.get('role', 'user').upper()}: {m.get('content', '')}" for m in conversation_history
        )
        prompt = (
            "You are Modernality's Socratic Guided Learning tutor.\n"
            "RULES:\n"
            "1. Guide the student step-by-step without giving away the final answer directly.\n"
            "2. If this is the start of the session (no student answer yet), show the initial problem setup and ask the first guiding question.\n"
            "3. If the student just answered, validate whether their reasoning/step is correct (`is_correct: true` or `false`), explain why, and ask the next guiding question.\n"
            f"Current Progress: Step {current_step} of {total_steps}\n\n"
            f"Problem: {problem_text or 'See attached problem image.'}\n\n"
            f"Conversation History:\n{history_str or '(Session just started — ask the first guiding question)'}"
        )

        input_parts: List[Dict[str, Any]] = []
        if image_b64:
            clean_b64 = image_b64.split(",")[-1] if "," in image_b64 else image_b64
            input_parts.append({"type": "image", "data": clean_b64, "mime_type": image_mime})
        input_parts.append({"type": "text", "text": prompt})

        interaction = client.interactions.create(
            model=TEXT_REASONING_MODEL,
            input=input_parts,
            response_format={
                "type": "text",
                "mime_type": "application/json",
                "schema": GuidedStepReply.model_json_schema(),
            },
        )
        return GuidedStepReply.model_validate_json(interaction.output_text)
