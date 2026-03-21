import Store from 'electron-store';

export const store = new Store({
    defaults: {
        overlayOpacity: 0.8,
        overlayPinned: false,
        theme: 'dark' as 'light' | 'dark' | 'auto',
        fontSize: 'medium' as 'small' | 'medium' | 'large',
        showStepNumbers: true,
        colorCodeSections: true,
        voiceEnabled: true,
        voiceSpeed: 1.0,
        voiceVolume: 0.7,
        autoNarrateInLearning: true,
        ocrOnSubmit: true,
        claudeApiKey: '',
        openaiApiKey: '',
        hotkeys: {
            capture: 'CommandOrControl+Shift+S',
            toggleOverlay: 'CommandOrControl+Shift+A',
        },
    },
});
