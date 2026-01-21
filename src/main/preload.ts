import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
    // Window controls
    minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
    maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
    closeWindow: () => ipcRenderer.invoke('window-close'),

    // Settings
    getSettings: () => ipcRenderer.invoke('get-settings'),
    setSetting: (key: string, value: unknown) => ipcRenderer.invoke('set-setting', key, value),

    // Screen capture
    captureScreen: () => ipcRenderer.invoke('capture-screen'),
    closeCaptureWindow: () => ipcRenderer.invoke('close-capture-window'),
    sendCapturedRegion: (imageData: string) => ipcRenderer.invoke('send-captured-region', imageData),

    // Overlay
    showOverlay: (solution: string) => ipcRenderer.invoke('show-overlay', solution),
    hideOverlay: () => ipcRenderer.invoke('hide-overlay'),
    setOverlayOpacity: (opacity: number) => ipcRenderer.invoke('set-overlay-opacity', opacity),

    // Event listeners
    onProblemCaptured: (callback: (imageData: string) => void) => {
        ipcRenderer.on('problem-captured', (_event, imageData) => callback(imageData));
    },
    onDisplaySolution: (callback: (solution: string) => void) => {
        ipcRenderer.on('display-solution', (_event, solution) => callback(solution));
    },
});

// Type declarations for TypeScript
declare global {
    interface Window {
        electronAPI: {
            minimizeWindow: () => Promise<void>;
            maximizeWindow: () => Promise<void>;
            closeWindow: () => Promise<void>;
            getSettings: () => Promise<Record<string, unknown>>;
            setSetting: (key: string, value: unknown) => Promise<boolean>;
            captureScreen: () => Promise<string | null>;
            closeCaptureWindow: () => Promise<void>;
            sendCapturedRegion: (imageData: string) => Promise<void>;
            showOverlay: (solution: string) => Promise<void>;
            hideOverlay: () => Promise<void>;
            setOverlayOpacity: (opacity: number) => Promise<void>;
            onProblemCaptured: (callback: (imageData: string) => void) => void;
            onDisplaySolution: (callback: (solution: string) => void) => void;
        };
    }
}
