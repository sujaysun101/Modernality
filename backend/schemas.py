"""
Pydantic schemas for Lumina Studio — AI Tutor & Multimodal Course Engine.
Used with the Gemini Interactions API (`response_format={"type": "text", "mime_type": "application/json", "schema": ...}`).
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class LessonSlide(BaseModel):
    slide_number: int = Field(description="1-based slide index in the explainer sequence")
    title: str = Field(description="Punchy, clear slide title")
    subtitle: str = Field(description="Concise 1-line subtitle or takeaway")
    narration: str = Field(description="Natural, engaging spoken voiceover script (2-4 sentences) explaining this slide as an expert tutor")
    bullets: List[str] = Field(description="3-4 concise visual bullet points shown on the slide")
    key_formula_or_code: Optional[str] = Field(default=None, description="LaTeX equation (without outer $$) or short code snippet if applicable, else null")
    mermaid_diagram: Optional[str] = Field(default=None, description="Valid Mermaid.js flowchart/sequence diagram (e.g., 'flowchart LR\\n  A[\"Input\"] --> B[\"Process\"]') illustrating this slide's concept, or null")
    visual_video_prompt: str = Field(description="Detailed cinematic prompt for Gemini Omni 1.1 Flash to generate a 5-second visual concept animation for this slide")


class LessonModule(BaseModel):
    module_number: int = Field(description="1-based module number")
    title: str = Field(description="Module title")
    duration_minutes: int = Field(description="Estimated study time in minutes")
    difficulty: str = Field(description="Beginner, Intermediate, or Advanced")
    summary: str = Field(description="2-3 sentence overview of the module")
    learning_objectives: List[str] = Field(description="3-4 specific, measurable learning objectives")
    core_concepts_markdown: str = Field(description="Detailed, well-structured tutorial breakdown in Markdown (with LaTeX math and examples)")
    real_world_analogy: str = Field(description="Memorable real-world analogy that makes the concept click")
    common_pitfalls: List[str] = Field(description="2-3 common misconceptions or mistakes students make")


class TutorialStep(BaseModel):
    step_number: int = Field(description="1-based step number")
    title: str = Field(description="Actionable title of this step")
    explanation: str = Field(description="Clear explanation of what happens in this step and why")
    example_or_walkthrough: str = Field(description="Concrete worked example, math derivation, or code snippet")
    check_understanding_question: str = Field(description="A quick micro-question to verify the student understood this step")
    check_understanding_answer: str = Field(description="The concise answer to the micro-question")


class PracticeProblem(BaseModel):
    id: str = Field(description="Unique identifier like 'prob_1'")
    question_type: str = Field(description="'multiple_choice' or 'free_response'")
    difficulty: str = Field(description="'Easy', 'Medium', or 'Hard'")
    topic_tag: str = Field(description="Specific sub-topic tested")
    question: str = Field(description="The problem statement (supports Markdown and LaTeX)")
    options: Optional[List[str]] = Field(default=None, description="4 options if multiple_choice, else null")
    correct_answer: str = Field(description="Exact correct option text (if multiple_choice) or model answer (if free_response)")
    hints: List[str] = Field(description="3 progressive hints: Hint 1 (nudge), Hint 2 (method/formula), Hint 3 (almost there)")
    step_by_step_solution: str = Field(description="Comprehensive, step-by-step worked solution explaining the reasoning")


class FlashcardItem(BaseModel):
    id: str = Field(description="Unique identifier like 'card_1'")
    category: str = Field(description="Sub-topic or concept category")
    front: str = Field(description="Question, term, or prompt on the front of the card")
    back: str = Field(description="Concise, high-retention answer or definition on the back")
    mnemonic_or_tip: Optional[str] = Field(default=None, description="Memory hook or mnemonic device, or null")


class ConceptNode(BaseModel):
    id: str = Field(description="Short alphanumeric node ID like 'n1', 'n2'")
    label: str = Field(description="Concept name (2-4 words max)")
    category: str = Field(description="'core', 'prerequisite', 'application', or 'detail'")
    description: str = Field(description="2-3 sentence explanation of this concept and how it fits into the material")
    key_takeaway: str = Field(description="1-sentence elevator pitch of this concept")


class ConceptEdge(BaseModel):
    source: str = Field(description="Source node ID")
    target: str = Field(description="Target node ID")
    relationship: str = Field(description="Short verb phrase describing relation, e.g., 'depends on', 'powers', 'generalizes'")


class StudyKitGeneration(BaseModel):
    title: str = Field(description="Captivating title for this complete study course")
    subject_area: str = Field(description="Academic or technical discipline, e.g., 'Quantum Mechanics', 'Distributed Systems', 'Organic Chemistry'")
    executive_summary: str = Field(description="Concise 1-paragraph executive summary of all ingested materials")
    estimated_total_minutes: int = Field(description="Total estimated mastery time in minutes")
    explainer_slides: List[LessonSlide] = Field(description="6 to 8 animated breakdown explainer slides covering the material from intuition to mastery")
    lesson_modules: List[LessonModule] = Field(description="3 to 5 comprehensive lesson modules with deep tutorials")
    guided_tutorial_steps: List[TutorialStep] = Field(description="4 to 6 interactive step-by-step guided tutorial walkthroughs")
    practice_problems: List[PracticeProblem] = Field(description="6 to 8 diverse practice & exam problems (mix of multiple_choice and free_response across Easy, Medium, Hard)")
    flashcards: List[FlashcardItem] = Field(description="10 to 14 high-yield spaced-repetition flashcards")
    concept_nodes: List[ConceptNode] = Field(description="8 to 14 key concept nodes for the interactive knowledge graph")
    concept_edges: List[ConceptEdge] = Field(description="10 to 20 directed edges connecting the concept nodes")


class GradingResult(BaseModel):
    score: int = Field(description="Score from 0 to 100")
    verdict: str = Field(description="'Correct', 'Partially Correct', or 'Needs Review'")
    strengths: List[str] = Field(description="What the student got right in their reasoning")
    missing_or_incorrect: List[str] = Field(description="Specific gaps, errors, or misconceptions in the student's response")
    personalized_feedback: str = Field(description="Warm, constructive tutor explanation guiding the student to the full solution")
    suggested_next_step: str = Field(description="Specific concept or practice area to review next")


# ============================================================================
# Modernality Interactive Problem Solver & Whiteboard Schemas
# (From sujaysun101/Modernality: Solution Mode, Guided Mode, Whiteboard Mode)
# ============================================================================
class InteractiveSolutionStep(BaseModel):
    type: str = Field(description="One of: 'given', 'find', 'formula', 'work', 'note', 'answer'")
    content: str = Field(description="The mathematical or conceptual content of this step (supports LaTeX with $ delimiters)")
    explanation: Optional[str] = Field(default=None, description="Why we perform this step or conceptual reasoning behind it")


class InteractiveSolutionResponse(BaseModel):
    problem_summary: str = Field(description="Clean 1-sentence restatement of the captured/submitted problem")
    subject_tag: str = Field(description="Detected subject area, e.g., 'Physics', 'Calculus', 'Chemistry', 'Algorithms'")
    steps: List[InteractiveSolutionStep] = Field(description="Ordered sequence of 'given', 'find', 'formula', 'work', 'note', and 'answer' steps")


class WhiteboardDemoStep(BaseModel):
    step_number: int = Field(description="1-based step index")
    step_type: str = Field(description="One of: 'given', 'formula', 'work', 'note', 'answer'")
    narration: str = Field(description="Conversational spoken explanation as if thinking aloud at the whiteboard")
    board_heading: str = Field(description="Short label written on the whiteboard for this step")
    board_equation_or_text: str = Field(description="Concise equation, derivation line, or diagram note written on the whiteboard canvas")


class WhiteboardDemoResponse(BaseModel):
    title: str = Field(description="Short title for this whiteboard demonstration")
    total_steps: int = Field(description="Total number of whiteboard steps")
    steps: List[WhiteboardDemoStep] = Field(description="5 to 8 sequential whiteboard demonstration steps with voice narration and board writing")


class GuidedStepReply(BaseModel):
    content: str = Field(description="Socratic response to the student (supports Markdown and LaTeX)")
    reply_type: str = Field(description="'question', 'feedback', or 'hint'")
    is_correct: bool = Field(description="True if the student's latest step/reasoning is valid and advances to the next step")
    next_guiding_hint: str = Field(description="A subtle conceptual hint the student can reveal if they get stuck on this step")
