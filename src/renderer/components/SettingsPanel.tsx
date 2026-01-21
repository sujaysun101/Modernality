import React, { useState, useEffect } from 'react';
import { X, Eye, Volume2, Keyboard, Key, Save, RotateCcw } from 'lucide-react';

interface Settings {
    overlayOpacity: number;
    theme: 'light' | 'dark' | 'auto';
    fontSize: 'small' | 'medium' | 'large';
    showStepNumbers: boolean;
    colorCodeSections: boolean;
    voiceEnabled: boolean;
    voiceSpeed: number;
    voiceVolume: number;
    autoNarrateInLearning: boolean;
    claudeApiKey: string;
    openaiApiKey: string;
    hotkeys: {
        capture: string;
        toggleOverlay: string;
    };
}

interface SettingsPanelProps {
    onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose }) => {
    const [settings, setSettings] = useState<Settings>({
        overlayOpacity: 0.8,
        theme: 'dark',
        fontSize: 'medium',
        showStepNumbers: true,
        colorCodeSections: true,
        voiceEnabled: true,
        voiceSpeed: 1.0,
        voiceVolume: 0.7,
        autoNarrateInLearning: true,
        claudeApiKey: '',
        openaiApiKey: '',
        hotkeys: {
            capture: 'Ctrl+Shift+S',
            toggleOverlay: 'Ctrl+Shift+A',
        },
    });

    const [activeTab, setActiveTab] = useState<'display' | 'voice' | 'hotkeys' | 'api'>('display');
    const [isSaving, setIsSaving] = useState(false);

    // Load settings on mount
    useEffect(() => {
        const loadSettings = async () => {
            if (window.electronAPI) {
                const stored = await window.electronAPI.getSettings();
                if (stored) {
                    setSettings(prev => ({ ...prev, ...stored as Partial<Settings> }));
                }
            }
        };
        loadSettings();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        if (window.electronAPI) {
            for (const [key, value] of Object.entries(settings)) {
                await window.electronAPI.setSetting(key, value);
            }
        }
        setIsSaving(false);
        onClose();
    };

    const handleReset = () => {
        setSettings({
            overlayOpacity: 0.8,
            theme: 'dark',
            fontSize: 'medium',
            showStepNumbers: true,
            colorCodeSections: true,
            voiceEnabled: true,
            voiceSpeed: 1.0,
            voiceVolume: 0.7,
            autoNarrateInLearning: true,
            claudeApiKey: settings.claudeApiKey, // Keep API keys
            openaiApiKey: settings.openaiApiKey,
            hotkeys: {
                capture: 'Ctrl+Shift+S',
                toggleOverlay: 'Ctrl+Shift+A',
            },
        });
    };

    const tabs = [
        { id: 'display', label: 'Display', icon: Eye },
        { id: 'voice', label: 'Voice', icon: Volume2 },
        { id: 'hotkeys', label: 'Hotkeys', icon: Keyboard },
        { id: 'api', label: 'API Keys', icon: Key },
    ] as const;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="glass w-full max-w-2xl max-h-[80vh] flex flex-col animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
                    <h2 className="text-lg font-semibold">Settings</h2>
                    <button onClick={onClose} className="btn-icon">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-700/50">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm transition-colors ${activeTab === tab.id
                                        ? 'text-opal-400 border-b-2 border-opal-400'
                                        : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {activeTab === 'display' && (
                        <div className="space-y-6">
                            {/* Overlay Opacity */}
                            <div>
                                <label className="block text-sm text-slate-300 mb-2">
                                    Overlay Opacity: {Math.round(settings.overlayOpacity * 100)}%
                                </label>
                                <input
                                    type="range"
                                    min="0.4"
                                    max="1"
                                    step="0.05"
                                    value={settings.overlayOpacity}
                                    onChange={(e) => setSettings({ ...settings, overlayOpacity: parseFloat(e.target.value) })}
                                    className="w-full"
                                />
                            </div>

                            {/* Font Size */}
                            <div>
                                <label className="block text-sm text-slate-300 mb-2">Font Size</label>
                                <select
                                    value={settings.fontSize}
                                    onChange={(e) => setSettings({ ...settings, fontSize: e.target.value as Settings['fontSize'] })}
                                    className="input-field"
                                >
                                    <option value="small">Small</option>
                                    <option value="medium">Medium</option>
                                    <option value="large">Large</option>
                                </select>
                            </div>

                            {/* Theme */}
                            <div>
                                <label className="block text-sm text-slate-300 mb-2">Theme</label>
                                <select
                                    value={settings.theme}
                                    onChange={(e) => setSettings({ ...settings, theme: e.target.value as Settings['theme'] })}
                                    className="input-field"
                                >
                                    <option value="dark">Dark</option>
                                    <option value="light">Light</option>
                                    <option value="auto">Auto</option>
                                </select>
                            </div>

                            {/* Toggles */}
                            <div className="space-y-3">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.showStepNumbers}
                                        onChange={(e) => setSettings({ ...settings, showStepNumbers: e.target.checked })}
                                        className="w-5 h-5 rounded bg-slate-700 border-slate-600"
                                    />
                                    <span className="text-sm text-slate-300">Show step numbers</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.colorCodeSections}
                                        onChange={(e) => setSettings({ ...settings, colorCodeSections: e.target.checked })}
                                        className="w-5 h-5 rounded bg-slate-700 border-slate-600"
                                    />
                                    <span className="text-sm text-slate-300">Color-code sections</span>
                                </label>
                            </div>
                        </div>
                    )}

                    {activeTab === 'voice' && (
                        <div className="space-y-6">
                            {/* Voice Speed */}
                            <div>
                                <label className="block text-sm text-slate-300 mb-2">
                                    Voice Speed: {settings.voiceSpeed}x
                                </label>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="2"
                                    step="0.25"
                                    value={settings.voiceSpeed}
                                    onChange={(e) => setSettings({ ...settings, voiceSpeed: parseFloat(e.target.value) })}
                                    className="w-full"
                                />
                            </div>

                            {/* Volume */}
                            <div>
                                <label className="block text-sm text-slate-300 mb-2">
                                    Volume: {Math.round(settings.voiceVolume * 100)}%
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={settings.voiceVolume}
                                    onChange={(e) => setSettings({ ...settings, voiceVolume: parseFloat(e.target.value) })}
                                    className="w-full"
                                />
                            </div>

                            {/* Toggles */}
                            <div className="space-y-3">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.voiceEnabled}
                                        onChange={(e) => setSettings({ ...settings, voiceEnabled: e.target.checked })}
                                        className="w-5 h-5 rounded bg-slate-700 border-slate-600"
                                    />
                                    <span className="text-sm text-slate-300">Enable voice features</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.autoNarrateInLearning}
                                        onChange={(e) => setSettings({ ...settings, autoNarrateInLearning: e.target.checked })}
                                        className="w-5 h-5 rounded bg-slate-700 border-slate-600"
                                    />
                                    <span className="text-sm text-slate-300">Auto-narrate in Learning Mode</span>
                                </label>
                            </div>
                        </div>
                    )}

                    {activeTab === 'hotkeys' && (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm text-slate-300 mb-2">Capture Screen</label>
                                <input
                                    type="text"
                                    value={settings.hotkeys.capture}
                                    onChange={(e) => setSettings({
                                        ...settings,
                                        hotkeys: { ...settings.hotkeys, capture: e.target.value }
                                    })}
                                    className="input-field"
                                    placeholder="e.g., Ctrl+Shift+S"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-300 mb-2">Toggle Overlay</label>
                                <input
                                    type="text"
                                    value={settings.hotkeys.toggleOverlay}
                                    onChange={(e) => setSettings({
                                        ...settings,
                                        hotkeys: { ...settings.hotkeys, toggleOverlay: e.target.value }
                                    })}
                                    className="input-field"
                                    placeholder="e.g., Ctrl+Shift+A"
                                />
                            </div>
                            <p className="text-xs text-slate-500">
                                Hot keys will take effect after restarting the application.
                            </p>
                        </div>
                    )}

                    {activeTab === 'api' && (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm text-slate-300 mb-2">Claude API Key</label>
                                <input
                                    type="password"
                                    value={settings.claudeApiKey}
                                    onChange={(e) => setSettings({ ...settings, claudeApiKey: e.target.value })}
                                    className="input-field"
                                    placeholder="sk-ant-..."
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    Required for AI problem solving. Get from console.anthropic.com
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm text-slate-300 mb-2">OpenAI API Key</label>
                                <input
                                    type="password"
                                    value={settings.openaiApiKey}
                                    onChange={(e) => setSettings({ ...settings, openaiApiKey: e.target.value })}
                                    className="input-field"
                                    placeholder="sk-..."
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    Required for voice features. Get from platform.openai.com
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-4 border-t border-slate-700/50">
                    <button onClick={handleReset} className="btn-secondary flex items-center gap-2">
                        <RotateCcw className="w-4 h-4" />
                        Reset to Defaults
                    </button>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="btn-secondary">
                            Cancel
                        </button>
                        <button onClick={handleSave} className="btn-primary flex items-center gap-2" disabled={isSaving}>
                            <Save className="w-4 h-4" />
                            {isSaving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPanel;
