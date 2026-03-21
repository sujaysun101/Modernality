import type { Problem, Solution, SolutionStep } from '../renderer/App';

/** Serializable problem payload for main-process Claude IPC (mirror of main/claudeIpc). */
type IpcProblemPayload = {
    id: string;
    imageData: string;
    text: string;
    timestamp?: string;
    subject?: string;
};

function toIpcProblem(problem: Problem): IpcProblemPayload {
    return {
        id: problem.id,
        imageData: problem.imageData,
        text: problem.text,
        timestamp: problem.timestamp instanceof Date ? problem.timestamp.toISOString() : String(problem.timestamp),
        subject: problem.subject,
    };
}

function normalizeSolution(raw: { steps: unknown[]; rawResponse: string }): Solution {
    const steps = (raw.steps || []) as SolutionStep[];
    return { steps, rawResponse: raw.rawResponse };
}

export async function setClaudeApiKey(_key: string): Promise<void> {
    /* Keys are managed in Settings (main process store). */
}

export async function getClaudeApiKey(): Promise<string> {
    if (typeof window !== 'undefined' && window.electronAPI) {
        const settings = await window.electronAPI.getSettings();
        return (settings.claudeApiKey as string) || '';
    }
    return '';
}

export async function solveWithAI(
    problem: Problem,
    mode: 'solution' | 'guided' | 'learning'
): Promise<Solution> {
    if (typeof window !== 'undefined' && window.electronAPI?.aiSolve) {
        const raw = await window.electronAPI.aiSolve(toIpcProblem(problem), mode);
        return normalizeSolution(raw);
    }

    return getDemoSolution(mode);
}

export async function continueGuidedLearning(
    _problem: Problem,
    conversationHistory: Array<{ role: string; content: string }>,
    currentStep: number
): Promise<{ content: string; type: string; isCorrect?: boolean }> {
    if (typeof window !== 'undefined' && window.electronAPI?.aiContinueGuided) {
        return window.electronAPI.aiContinueGuided(conversationHistory, currentStep);
    }

    return {
        content:
            "That's a good observation! What physical principle relates these quantities? Think about the relationship between force, mass, and acceleration.",
        type: 'question',
        isCorrect: true,
    };
}

function getDemoSolution(mode: string): Solution {
    if (mode === 'solution') {
        return {
            steps: [
                {
                    type: 'given',
                    content:
                        'This is a demo solution. Please configure your Claude API key in Settings to enable AI-powered problem solving.',
                },
                { type: 'note', content: 'Go to Settings → API Keys and enter your Anthropic API key.' },
                { type: 'answer', content: 'Demo mode active - configure API key for full functionality' },
            ],
            rawResponse: 'Demo solution - API key required',
        };
    }

    return {
        steps: [{ type: 'note', content: 'Configure your API key in Settings to enable this feature.' }],
        rawResponse: 'Demo mode',
    };
}
