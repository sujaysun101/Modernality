function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

async function blobToBase64(blob: Blob): Promise<string> {
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

export async function setOpenAIApiKey(_key: string): Promise<void> {
    /* Keys live in main process store (Settings). */
}

export async function getOpenAIApiKey(): Promise<string> {
    if (typeof window !== 'undefined' && window.electronAPI) {
        const settings = await window.electronAPI.getSettings();
        return (settings.openaiApiKey as string) || '';
    }
    return '';
}

export async function textToSpeech(
    text: string,
    voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'nova',
    speed: number = 1.0
): Promise<ArrayBuffer | null> {
    if (typeof window !== 'undefined' && window.electronAPI?.openaiSpeech) {
        const b64 = await window.electronAPI.openaiSpeech({
            text,
            voice,
            speed: Math.max(0.25, Math.min(4.0, speed)),
        });
        if (!b64) {
            return null;
        }
        return base64ToArrayBuffer(b64);
    }

    const apiKey = await getOpenAIApiKey();
    if (!apiKey) {
        console.warn('OpenAI API key not configured. Voice features disabled.');
        return null;
    }

    try {
        const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'tts-1',
                input: text,
                voice,
                speed: Math.max(0.25, Math.min(4.0, speed)),
            }),
        });

        if (!response.ok) {
            throw new Error(`TTS API error: ${response.status}`);
        }

        return await response.arrayBuffer();
    } catch (error) {
        console.error('Text-to-speech error:', error);
        return null;
    }
}

export async function speechToText(audioBlob: Blob): Promise<string | null> {
    if (typeof window !== 'undefined' && window.electronAPI?.openaiTranscribe) {
        const base64Audio = await blobToBase64(audioBlob);
        return window.electronAPI.openaiTranscribe({
            base64Audio,
            mimeType: audioBlob.type || 'audio/webm',
        });
    }

    const apiKey = await getOpenAIApiKey();
    if (!apiKey) {
        console.warn('OpenAI API key not configured. Voice input disabled.');
        return null;
    }

    try {
        const formData = new FormData();
        formData.append('file', audioBlob, 'audio.webm');
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
            throw new Error(`Whisper API error: ${response.status}`);
        }

        const data = (await response.json()) as { text?: string };
        return data.text ?? null;
    } catch (error) {
        console.error('Speech-to-text error:', error);
        return null;
    }
}

export class VoicePlayer {
    private audioContext: AudioContext | null = null;
    private currentSource: AudioBufferSourceNode | null = null;
    private isPlaying = false;
    private volume = 1.0;
    private speed = 1.0;

    constructor() {
        if (typeof window !== 'undefined') {
            this.audioContext = new (window.AudioContext ||
                (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        }
    }

    async play(audioData: ArrayBuffer): Promise<void> {
        if (!this.audioContext) return;

        this.stop();

        try {
            const audioBuffer = await this.audioContext.decodeAudioData(audioData.slice(0));

            this.currentSource = this.audioContext.createBufferSource();
            this.currentSource.buffer = audioBuffer;
            this.currentSource.playbackRate.value = this.speed;

            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = this.volume;

            this.currentSource.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            this.currentSource.onended = () => {
                this.isPlaying = false;
                this.currentSource = null;
            };

            this.currentSource.start(0);
            this.isPlaying = true;
        } catch (error) {
            console.error('Error playing audio:', error);
        }
    }

    stop(): void {
        if (this.currentSource) {
            try {
                this.currentSource.stop();
            } catch {
                /* already stopped */
            }
            this.currentSource = null;
        }
        this.isPlaying = false;
    }

    pause(): void {
        if (this.audioContext && this.isPlaying) {
            void this.audioContext.suspend();
        }
    }

    resume(): void {
        if (this.audioContext) {
            void this.audioContext.resume();
        }
    }

    setVolume(vol: number): void {
        this.volume = Math.max(0, Math.min(1, vol));
    }

    setSpeed(spd: number): void {
        this.speed = Math.max(0.25, Math.min(4, spd));
        if (this.currentSource) {
            this.currentSource.playbackRate.value = this.speed;
        }
    }

    getIsPlaying(): boolean {
        return this.isPlaying;
    }
}

export class VoiceRecorder {
    private mediaRecorder: MediaRecorder | null = null;
    private audioChunks: Blob[] = [];
    private isRecording = false;

    async startRecording(): Promise<boolean> {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : 'audio/webm';

            this.mediaRecorder = new MediaRecorder(stream, { mimeType });
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.start(100);
            this.isRecording = true;
            return true;
        } catch (error) {
            console.error('Error starting recording:', error);
            return false;
        }
    }

    async stopRecording(): Promise<Blob | null> {
        return new Promise((resolve) => {
            if (!this.mediaRecorder) {
                resolve(null);
                return;
            }

            this.mediaRecorder.onstop = () => {
                const mime = this.mediaRecorder?.mimeType || 'audio/webm';
                const audioBlob = new Blob(this.audioChunks, { type: mime });
                this.isRecording = false;
                resolve(audioBlob);
            };

            this.mediaRecorder.stop();
            this.mediaRecorder.stream.getTracks().forEach((track) => track.stop());
        });
    }

    getIsRecording(): boolean {
        return this.isRecording;
    }
}

export const voicePlayer = new VoicePlayer();
export const voiceRecorder = new VoiceRecorder();

export async function speak(
    text: string,
    options: { voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'; speed?: number } = {}
): Promise<void> {
    const audioData = await textToSpeech(text, options.voice || 'nova', options.speed || 1.0);
    if (audioData) {
        await voicePlayer.play(audioData);
    }
}

export async function listen(): Promise<string | null> {
    const started = await voiceRecorder.startRecording();
    if (!started) return null;

    await new Promise((resolve) => setTimeout(resolve, 5000));

    const audioBlob = await voiceRecorder.stopRecording();
    if (!audioBlob) return null;

    return await speechToText(audioBlob);
}
