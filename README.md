# Opal AI Tutor

An AI-powered desktop tutoring application that provides intelligent tutoring assistance by analyzing on-screen problems, offering step-by-step solutions, and enabling interactive learning through voice guidance and visual annotations.

## Features

- **Solution Display Mode**: Get complete step-by-step solutions with math rendering
- **Guided Learning Mode**: Interactive Socratic tutoring with Q&A
- **Learning Mode**: Full demonstrations with voice narration and whiteboard
- **Screen Capture**: Capture problems directly from your screen
- **OCR**: Extract text from images using Tesseract.js
- **Voice Integration**: Text-to-speech with OpenAI TTS, speech-to-text with Whisper
- **Drawing Canvas**: Full whiteboard with pen, shapes, and colors

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- API Keys (optional, for AI features):
  - [Anthropic Claude API Key](https://console.anthropic.com)
  - [OpenAI API Key](https://platform.openai.com)

### Installation

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Building

```bash
# Build for production
npm run build

# Package for distribution
npm run package
```

## Project Structure

```
src/
├── main/                 # Electron main process
│   ├── main.ts          # Main entry, window management
│   └── preload.ts       # IPC bridge
├── renderer/            # React frontend
│   ├── App.tsx          # Main app component
│   ├── components/      # UI components
│   │   ├── TitleBar.tsx
│   │   ├── ModeSelector.tsx
│   │   ├── ProblemCapture.tsx
│   │   ├── SolutionDisplay.tsx
│   │   ├── GuidedLearning.tsx
│   │   ├── LearningMode.tsx
│   │   ├── DrawingCanvas.tsx
│   │   ├── MathRenderer.tsx
│   │   ├── SettingsPanel.tsx
│   │   └── RecentProblems.tsx
│   └── styles/
│       └── index.css
└── services/            # Core services
    ├── AIService.ts     # Claude API integration
    ├── VoiceService.ts  # OpenAI TTS/Whisper
    └── OCRService.ts    # Tesseract OCR
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+S` | Capture screen region |
| `Ctrl+Shift+A` | Toggle solution overlay |

## Configuration

Open Settings (gear icon) to configure:
- **Display**: Overlay opacity, font size, theme
- **Voice**: Speed, volume, auto-narration
- **Hotkeys**: Customize keyboard shortcuts
- **API Keys**: Claude and OpenAI API keys

## Tech Stack

- **Frontend**: React 18, TypeScript, TailwindCSS
- **Desktop**: Electron 28
- **AI**: Anthropic Claude API
- **Voice**: OpenAI TTS & Whisper
- **OCR**: Tesseract.js
- **Math Rendering**: KaTeX

## License

MIT
