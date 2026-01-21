import React from 'react';
import { Minus, Square, X, Settings, Sparkles } from 'lucide-react';

interface TitleBarProps {
    onSettingsClick: () => void;
}

const TitleBar: React.FC<TitleBarProps> = ({ onSettingsClick }) => {
    const handleMinimize = () => window.electronAPI?.minimizeWindow();
    const handleMaximize = () => window.electronAPI?.maximizeWindow();
    const handleClose = () => window.electronAPI?.closeWindow();

    return (
        <div className="h-12 flex items-center justify-between px-4 drag-region bg-slate-900/50 border-b border-slate-700/50">
            {/* Logo and Title */}
            <div className="flex items-center gap-3 no-drag">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-opal-400 to-opal-600 flex items-center justify-center shadow-lg shadow-opal-500/30">
                    <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-semibold text-gradient">Opal AI Tutor</span>
            </div>

            {/* Window Controls */}
            <div className="flex items-center gap-2 no-drag">
                <button
                    onClick={onSettingsClick}
                    className="btn-icon hover:bg-slate-600/50"
                    title="Settings"
                >
                    <Settings className="w-4 h-4" />
                </button>

                <div className="w-px h-6 bg-slate-700 mx-1" />

                <button
                    onClick={handleMinimize}
                    className="btn-icon hover:bg-slate-600/50"
                    title="Minimize"
                >
                    <Minus className="w-4 h-4" />
                </button>
                <button
                    onClick={handleMaximize}
                    className="btn-icon hover:bg-slate-600/50"
                    title="Maximize"
                >
                    <Square className="w-3.5 h-3.5" />
                </button>
                <button
                    onClick={handleClose}
                    className="btn-icon hover:bg-red-500/80 hover:text-white"
                    title="Close"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default TitleBar;
