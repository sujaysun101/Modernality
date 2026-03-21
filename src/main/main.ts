import { app, BrowserWindow, globalShortcut, ipcMain, screen, desktopCapturer } from 'electron';
import * as path from 'path';
import { store } from './settingsStore';
import { claudeSolve, claudeContinueGuided, type IpcProblem } from './claudeIpc';
import { openaiTextToSpeech, openaiTranscribe } from './openaiIpc';

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let captureWindow: BrowserWindow | null = null;

/** When set (e.g. Playwright E2E), load built renderer from disk even if app is not packaged. */
const useDistBuild = process.env.OPAL_USE_DIST === '1';
const isDev =
    (process.env.NODE_ENV === 'development' || !app.isPackaged) && !useDistBuild;

function applyOverlayPinState(): void {
    if (!overlayWindow) return;
    const pinned = store.get('overlayPinned') === true;
    try {
        if (pinned) {
            overlayWindow.setAlwaysOnTop(true, 'screen-saver');
        } else {
            try {
                overlayWindow.setAlwaysOnTop(true, 'floating');
            } catch {
                overlayWindow.setAlwaysOnTop(true);
            }
        }
    } catch {
        overlayWindow.setAlwaysOnTop(true);
    }
}

function createMainWindow(): void {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        frame: false,
        titleBarStyle: 'hidden',
        backgroundColor: '#0f172a',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function createOverlayWindow(): void {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    overlayWindow = new BrowserWindow({
        width: 500,
        height: 700,
        x: width - 520,
        y: 50,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    if (isDev) {
        overlayWindow.loadURL('http://localhost:5173/#/overlay');
    } else {
        overlayWindow.loadFile(path.join(__dirname, '../renderer/index.html'), { hash: '/overlay' });
    }

    const opacity = Number(store.get('overlayOpacity'));
    if (!Number.isNaN(opacity) && opacity >= 0.2 && opacity <= 1) {
        overlayWindow.setOpacity(opacity);
    }

    applyOverlayPinState();

    overlayWindow.on('closed', () => {
        overlayWindow = null;
    });
}

function createCaptureWindow(): void {
    const { width, height } = screen.getPrimaryDisplay().size;

    captureWindow = new BrowserWindow({
        width,
        height,
        x: 0,
        y: 0,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        fullscreen: true,
        skipTaskbar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    if (isDev) {
        captureWindow.loadURL('http://localhost:5173/#/capture');
    } else {
        captureWindow.loadFile(path.join(__dirname, '../renderer/index.html'), { hash: '/capture' });
    }

    captureWindow.on('closed', () => {
        captureWindow = null;
    });
}

function registerGlobalShortcuts(): void {
    globalShortcut.unregisterAll();

    const captureHotkey = store.get('hotkeys.capture') as string;
    const overlayHotkey = store.get('hotkeys.toggleOverlay') as string;

    const reg = (accelerator: string, fn: () => void) => {
        try {
            if (accelerator && globalShortcut.register(accelerator, fn)) {
                return;
            }
        } catch {
            /* invalid accelerator */
        }
        console.warn('Could not register global shortcut:', accelerator);
    };

    reg(captureHotkey, () => {
        if (captureWindow) {
            captureWindow.close();
        } else {
            createCaptureWindow();
        }
    });

    reg(overlayHotkey, () => {
        if (overlayWindow) {
            overlayWindow.isVisible() ? overlayWindow.hide() : overlayWindow.show();
        } else {
            createOverlayWindow();
        }
    });
}

ipcMain.handle('get-settings', () => {
    return store.store;
});

ipcMain.handle('set-setting', (_event, key: string, value: unknown) => {
    store.set(key, value);
    return true;
});

ipcMain.handle('reregister-hotkeys', () => {
    registerGlobalShortcuts();
    return true;
});

ipcMain.handle('ai-solve', async (_e, payload: { problem: IpcProblem; mode: 'solution' | 'guided' | 'learning' }) => {
    return claudeSolve(payload.problem, payload.mode);
});

ipcMain.handle(
    'ai-continue-guided',
    async (
        _e,
        payload: {
            conversationHistory: Array<{ role: string; content: string }>;
            currentStep: number;
        }
    ) => {
        return claudeContinueGuided(payload.conversationHistory, payload.currentStep);
    }
);

ipcMain.handle(
    'openai-speech',
    async (_e, payload: { text: string; voice: string; speed: number }) => {
        return openaiTextToSpeech(payload.text, payload.voice, payload.speed);
    }
);

ipcMain.handle(
    'openai-transcribe',
    async (_e, payload: { base64Audio: string; mimeType: string }) => {
        return openaiTranscribe(payload.base64Audio, payload.mimeType);
    }
);

ipcMain.handle('window-minimize', () => {
    mainWindow?.minimize();
});

ipcMain.handle('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow?.maximize();
    }
});

ipcMain.handle('window-close', () => {
    mainWindow?.close();
});

ipcMain.handle('close-capture-window', () => {
    captureWindow?.close();
});

ipcMain.handle('show-overlay', (_event, solution: string) => {
    if (!overlayWindow) {
        createOverlayWindow();
    }
    overlayWindow?.webContents.send('display-solution', solution);
    overlayWindow?.show();
    applyOverlayPinState();
    const opacity = Number(store.get('overlayOpacity'));
    if (!Number.isNaN(opacity) && opacity >= 0.2 && opacity <= 1) {
        overlayWindow?.setOpacity(opacity);
    }
});

ipcMain.handle('hide-overlay', () => {
    overlayWindow?.hide();
});

ipcMain.handle('set-overlay-opacity', (_event, opacity: number) => {
    overlayWindow?.setOpacity(opacity);
});

ipcMain.handle('capture-screen', async () => {
    const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: screen.getPrimaryDisplay().size,
    });

    if (sources.length > 0) {
        return sources[0].thumbnail.toDataURL();
    }
    return null;
});

ipcMain.handle('send-captured-region', (_event, imageData: string) => {
    mainWindow?.webContents.send('problem-captured', imageData);
    captureWindow?.close();
});

ipcMain.handle('open-capture-window', () => {
    if (captureWindow) {
        captureWindow.focus();
        return;
    }
    createCaptureWindow();
});

app.whenReady().then(() => {
    createMainWindow();
    registerGlobalShortcuts();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createMainWindow();
    }
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});
