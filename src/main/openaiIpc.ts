import { store } from './settingsStore';

export async function openaiTextToSpeech(
    text: string,
    voice: string,
    speed: number
): Promise<string | null> {
    const apiKey = (store.get('openaiApiKey') as string) || '';
    if (!apiKey || !text.trim()) {
        return null;
    }

    const v = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].includes(voice) ? voice : 'nova';
    const spd = Math.max(0.25, Math.min(4.0, speed));

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'tts-1',
            input: text,
            voice: v,
            speed: spd,
        }),
    });

    if (!response.ok) {
        return null;
    }

    const buf = Buffer.from(await response.arrayBuffer());
    return buf.toString('base64');
}

export async function openaiTranscribe(base64Audio: string, mimeType: string): Promise<string | null> {
    const apiKey = (store.get('openaiApiKey') as string) || '';
    if (!apiKey || !base64Audio) {
        return null;
    }

    const buffer = Buffer.from(base64Audio, 'base64');
    const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') ? 'mp4' : 'webm';
    const blob = new Blob([buffer], { type: mimeType || 'audio/webm' });

    const formData = new FormData();
    formData.append('file', blob, `audio.${ext}`);
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
    });

    if (!response.ok) {
        return null;
    }

    const data = (await response.json()) as { text?: string };
    return data.text ?? null;
}
