import { contextBridge, ipcRenderer } from 'electron';
import type { IpcGuidedReply, IpcProblem, IpcSolution } from './claudeIpc';

contextBridge.exposeInMainWorld('electronAPI', {
    minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
    maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
    closeWindow: () => ipcRenderer.invoke('window-close'),

    getSettings: () => ipcRenderer.invoke('get-settings'),
    setSetting: (key: string, value: unknown) => ipcRenderer.invoke('set-setting', key, value),
    reregisterHotkeys: () => ipcRenderer.invoke('reregister-hotkeys'),

    captureScreen: () => ipcRenderer.invoke('capture-screen'),
    closeCaptureWindow: () => ipcRenderer.invoke('close-capture-window'),
    sendCapturedRegion: (imageData: string) => ipcRenderer.invoke('send-captured-region', imageData),
    openCaptureWindow: () => ipcRenderer.invoke('open-capture-window'),

    showOverlay: (solution: string) => ipcRenderer.invoke('show-overlay', solution),
    hideOverlay: () => ipcRenderer.invoke('hide-overlay'),
    setOverlayOpacity: (opacity: number) => ipcRenderer.invoke('set-overlay-opacity', opacity),
    setOverlayPinned: (pinned: boolean) => ipcRenderer.invoke('set-overlay-pinned', pinned),
    getOverlayPinned: () => ipcRenderer.invoke('get-overlay-pinned') as Promise<boolean>,

    aiSolve: (problem: IpcProblem, mode: 'solution' | 'guided' | 'learning') =>
        ipcRenderer.invoke('ai-solve', { problem, mode }) as Promise<IpcSolution>,

    aiContinueGuided: (
        conversationHistory: Array<{ role: string; content: string }>,
        currentStep: number
    ) => ipcRenderer.invoke('ai-continue-guided', { conversationHistory, currentStep }) as Promise<IpcGuidedReply>,

    openaiSpeech: (payload: { text: string; voice: string; speed: number }) =>
        ipcRenderer.invoke('openai-speech', payload) as Promise<string | null>,

    openaiTranscribe: (payload: { base64Audio: string; mimeType: string }) =>
        ipcRenderer.invoke('openai-transcribe', payload) as Promise<string | null>,

    onProblemCaptured: (callback: (imageData: string) => void) => {
        ipcRenderer.on('problem-captured', (_event, imageData) => callback(imageData));
    },
    onDisplaySolution: (callback: (solution: string) => void) => {
        ipcRenderer.on('display-solution', (_event, solution) => callback(solution));
    },
});

declare global {
    interface Window {
        electronAPI: {
            minimizeWindow: () => Promise<void>;
            maximizeWindow: () => Promise<void>;
            closeWindow: () => Promise<void>;
            getSettings: () => Promise<Record<string, unknown>>;
            setSetting: (key: string, value: unknown) => Promise<boolean>;
            reregisterHotkeys: () => Promise<boolean>;
            captureScreen: () => Promise<string | null>;
            closeCaptureWindow: () => Promise<void>;
            sendCapturedRegion: (imageData: string) => Promise<void>;
            openCaptureWindow: () => Promise<void>;
            showOverlay: (solution: string) => Promise<void>;
            hideOverlay: () => Promise<void>;
            setOverlayOpacity: (opacity: number) => Promise<void>;
            setOverlayPinned: (pinned: boolean) => Promise<boolean>;
            getOverlayPinned: () => Promise<boolean>;
            aiSolve: (
                problem: IpcProblem,
                mode: 'solution' | 'guided' | 'learning'
            ) => Promise<IpcSolution>;
            aiContinueGuided: (
                conversationHistory: Array<{ role: string; content: string }>,
                currentStep: number
            ) => Promise<IpcGuidedReply>;
            openaiSpeech: (payload: { text: string; voice: string; speed: number }) => Promise<string | null>;
            openaiTranscribe: (payload: {
                base64Audio: string;
                mimeType: string;
            }) => Promise<string | null>;
            onProblemCaptured: (callback: (imageData: string) => void) => void;
            onDisplaySolution: (callback: (solution: string) => void) => void;
        };
    }
}
