# Modernality — Interactive AI Tutor, Whiteboard & Multimodal Study Studio

![Modernality Logo](frontend/logo.png)

**Modernality** combines a **Multi-Subject Course Synthesis Studio** with an **Interactive Problem Capture & Whiteboard Tutor**. Upload any lecture slides, textbooks, problem sets, code, or media to organize subjects into isolated Study Kits, or jump straight into the **Interactive Whiteboard & Solver** to capture any problem and work through it step-by-step.

---

## Core Capabilities

### 1. Interactive Whiteboard & Problem Solver (`Whiteboard & Solver`)
Capture any problem via **Screen Capture**, **Clipboard Paste (`Ctrl+V`)**, **Image Upload**, or **Text Input**, and work through it across three interactive modes:
- **Solution Steps Mode**: Breaks problems into color-coded semantic step cards (`GIVEN` in blue, `FIND` in cyan, `FORMULA` in green, `WORK` in indigo, `NOTE` in purple, `ANSWER` in red) with KaTeX math rendering, step-by-step reasoning explanations, per-step copy, and `.txt` export.
- **Guided Learning Mode**: A Socratic step-by-step coach with a visual progress bar (`Step X of Y`) that asks guiding questions without spoiling the final answer, validates each step with `✓ Correct!` or `Let's reconsider...` badges, offers conceptual hints, and supports voice input.
- **Interactive Whiteboard Mode**:
  - **HTML5 Drawing Canvas**: Draw with `Pen`, `Eraser`, `Circle`, `Box`, `Arrow`, and `Text` tools using semantic colors, adjustable stroke widths, grid overlay, and `Undo / Redo / Clear`.
  - **Review My Whiteboard**: Send a snapshot of your handwritten canvas work to the tutor for instant step verification and targeted feedback.
  - **Live AI Board Demo Player**: Watch and listen as the tutor animates color-coded equations and diagrams onto the whiteboard step-by-step with synchronized voice narration, Play/Pause, Skip Back/Forward, Mute, and playback speed (`0.75x–1.5x`) controls.

### 2. Multi-Subject Study Kit Studio
- **Subject Separation & Material Append**: Group Study Kits into custom Subject folders (e.g., *Calculus III*, *Organic Chemistry*, *Algorithms*) and either create new Study Kits or append new files/links into an existing Study Kit at any time.
- **Universal Material Ingestion (`backend/ingestion.py`)**:
  - **Documents & Data**: PDF (`.pdf`), Word (`.docx`), PowerPoint (`.pptx`), Excel (`.xlsx`), CSV/TSV, ZIP archives (`.zip`)
  - **Media & Code**: Images (`.png`, `.jpg`, `.webp`), Audio (`.mp3`, `.wav`), Video (`.mp4`, `.webm`), Jupyter Notebooks (`.ipynb`), source code, Markdown, LaTeX (`.tex`)
  - **Links**: YouTube URLs (transcript extraction), public Google Drive links, and web articles
- **Breakdown Explainer Player**: Synchronized voiceover narration, animated takeaways, KaTeX equations, Mermaid.js diagrams, and 1-click visual concept video generation.
- **Lesson Plans & Guided Tutorials**: Multi-module curriculum with learning objectives, intuitive analogies, exam pitfalls, and interactive comprehension checks.
- **Practice Simulator + 1-Click Whiteboard Bridge**: Auto-generated MCQs and free-response problems across Easy/Medium/Hard tiers with progressive hints, AI rubric grading, and a 1-click **"Open in Interactive Whiteboard & Solver →"** button on every problem.
- **3D Spaced-Repetition Flashcards & Interactive Concept Graph**: SM-2 confidence scheduling (`Again`, `Hard`, `Good`, `Easy`) and an HTML5 physics-based knowledge graph.
- **Multi-Turn & Live Voice/Screen AI Tutor**: Grounded in your active Study Kit with selectable personas (*Socratic Guide*, *ELI5*, *Graduate Deep Dive*, *Exam Coach*) and real-time voice + screen-sharing.

---

## Security & Data Isolation
- **Local-First Storage**: Uploaded files and Study Kits are stored locally in `data/` (excluded via `.gitignore`) with strict path-traversal and upload-size validation.
- **Hardened HTTP Headers**: Enforces `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and `Cache-Control: no-store` on API responses.

---

## Quick Start

```powershell
# 1. Install dependencies and start the server
uv run python main.py
```

Open **http://127.0.0.1:8000** in your browser.
