import Anthropic from '@anthropic-ai/sdk';
import { store } from './settingsStore';

export type IpcProblem = {
    id: string;
    imageData: string;
    text: string;
    timestamp?: string;
    subject?: string;
};

export type IpcSolution = {
    steps: unknown[];
    rawResponse: string;
};

export type IpcGuidedReply = {
    content: string;
    type: string;
    isCorrect?: boolean;
};

function dataUrlToImageBlock(imageData: string): Anthropic.ImageBlockParam {
    const match = imageData.match(/^data:image\/([\w+.-]+);base64,(.+)$/);
    if (!match) {
        throw new Error('Invalid image data URL');
    }
    let ext = match[1].toLowerCase();
    if (ext === 'jpg') ext = 'jpeg';
    const mediaType = (ext === 'jpeg' || ext === 'png' || ext === 'gif' || ext === 'webp'
        ? (`image/${ext}` as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp')
        : ('image/png' as const));
    return {
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: match[2] },
    };
}

const SOLUTION_MODE_PROMPT = `You are an expert tutor helping a student understand a problem. The user has captured a problem from their screen and needs a complete step-by-step solution.

TASK: Analyze the provided problem and generate a comprehensive solution with clear, numbered steps.

FORMAT YOUR RESPONSE AS JSON with this structure:
{
  "steps": [
    { "type": "given", "content": "List all provided values", "explanation": "optional explanation" },
    { "type": "find", "content": "What we need to find" },
    { "type": "formula", "content": "Relevant formula or equation" },
    { "type": "work", "content": "Show the work for this step", "explanation": "why we do this" },
    { "type": "answer", "content": "Final answer with units" }
  ]
}

REQUIREMENTS:
- Use proper mathematical notation (LaTeX with $ delimiters where appropriate)
- Show ALL work, including intermediate calculations
- Explain the reasoning behind each step
- Include units throughout
- Highlight the final answer
- Be pedagogically clear`;

const GUIDED_MODE_PROMPT = `You are a Socratic tutor using the Guided Learning approach. Your role is to help the student learn by guiding them through the problem WITHOUT giving away the answer.

RULES YOU MUST FOLLOW:
1. NEVER provide the final answer directly
2. Show only the initial setup and first 1-2 steps
3. Ask guiding questions to prompt student thinking
4. Validate student responses with explanations
5. If student is stuck, provide conceptual hints, not computational steps
6. Use encouraging, patient language

FORMAT YOUR RESPONSE to include:
- What you're showing the student
- A guiding question to ask them
- Hints they can use if stuck

Start by showing the problem setup and asking the first guiding question.`;

const LEARNING_MODE_PROMPT = `You are an expert tutor demonstrating how to solve a problem step-by-step. Your solution will be narrated via voice and written on a whiteboard in real-time.

TASK: Solve this problem completely while explaining your thought process as if thinking aloud.

FORMAT YOUR RESPONSE AS JSON:
{
  "steps": [
    {
      "narration": "What to say (conversational, educational tone)",
      "action": "What to write on the whiteboard",
      "visual": "Optional: diagram or annotation description"
    }
  ]
}

NARRATION STYLE:
- Use conversational, educational tone
- Explain WHY you make each decision
- Think aloud: "First, I need to identify..."
- Point out common mistakes: "Students often forget to..."
- Keep explanations concise but complete`;

function parseRawResponse(response: string): IpcSolution {
    const steps: Array<{ type: string; content: string }> = [];
    const lines = response.split('\n').filter((l) => l.trim());
    let currentType = 'work';

    for (const line of lines) {
        const lowerLine = line.toLowerCase();
        if (lowerLine.includes('given') || lowerLine.includes('known')) {
            currentType = 'given';
        } else if (lowerLine.includes('find') || lowerLine.includes('determine')) {
            currentType = 'find';
        } else if (lowerLine.includes('formula') || lowerLine.includes('equation')) {
            currentType = 'formula';
        } else if (lowerLine.includes('answer') || lowerLine.includes('result') || lowerLine.includes('therefore')) {
            currentType = 'answer';
        } else if (lowerLine.includes('note') || lowerLine.includes('tip')) {
            currentType = 'note';
        }
        steps.push({ type: currentType, content: line });
    }
    return { steps, rawResponse: response };
}

function getDemoSolution(mode: string): IpcSolution {
    if (mode === 'solution') {
        return {
            steps: [
                { type: 'given', content: 'This is a demo solution. Please configure your Claude API key in Settings to enable AI-powered problem solving.' },
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

export async function claudeSolve(
    problem: IpcProblem,
    mode: 'solution' | 'guided' | 'learning'
): Promise<IpcSolution> {
    const apiKey = (store.get('claudeApiKey') as string) || '';
    if (!apiKey) {
        return getDemoSolution(mode);
    }

    const client = new Anthropic({ apiKey });
    const systemPrompt =
        mode === 'solution' ? SOLUTION_MODE_PROMPT : mode === 'guided' ? GUIDED_MODE_PROMPT : LEARNING_MODE_PROMPT;

    const userContent = problem.imageData
        ? [
            dataUrlToImageBlock(problem.imageData),
            { type: 'text' as const, text: problem.text || 'Please analyze this problem.' },
        ]
        : problem.text;

    const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    const rawResponse = textContent && 'text' in textContent ? textContent.text : '';

    if (mode === 'solution' || mode === 'learning') {
        try {
            const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]) as { steps?: unknown[] };
                return { steps: parsed.steps || [], rawResponse };
            }
        } catch {
            return parseRawResponse(rawResponse);
        }
    }

    return { steps: [], rawResponse };
}

export async function claudeContinueGuided(
    conversationHistory: Array<{ role: string; content: string }>,
    currentStep: number
): Promise<IpcGuidedReply> {
    const apiKey = (store.get('claudeApiKey') as string) || '';
    if (!apiKey) {
        return {
            content:
                "That's a good observation! What physical principle relates these quantities? Think about the relationship between force, mass, and acceleration.",
            type: 'question',
            isCorrect: true,
        };
    }

    const client = new Anthropic({ apiKey });
    const systemPrompt = `${GUIDED_MODE_PROMPT}

CURRENT STATE:
- Current step: ${currentStep}
- Student's progress so far is shown in the conversation

RESPOND WITH JSON:
{
  "content": "Your response to the student",
  "type": "feedback" or "question",
  "isCorrect": true/false if validating an answer
}`;

    const messages = conversationHistory.map((msg) => ({
        role: msg.role === 'ai' ? ('assistant' as const) : ('user' as const),
        content: msg.content,
    }));

    try {
        const response = await client.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
            system: systemPrompt,
            messages,
        });

        const textContent = response.content.find((c) => c.type === 'text');
        const rawResponse = textContent && 'text' in textContent ? textContent.text : '';

        try {
            const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]) as IpcGuidedReply;
            }
        } catch {
            return { content: rawResponse, type: 'question' };
        }
        return { content: rawResponse, type: 'question' };
    } catch {
        return {
            content: "Let's think about this step by step. Can you tell me what approach you'd like to try?",
            type: 'question',
        };
    }
}
