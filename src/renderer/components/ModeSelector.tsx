import React from 'react';
import { Zap, MessageCircle, GraduationCap, Mic } from 'lucide-react';
import { Mode } from '../App';

interface ModeSelectorProps {
    currentMode: Mode;
    onModeChange: (mode: Mode) => void;
}

const modes = [
    {
        id: 'solution' as Mode,
        label: 'Solution',
        icon: Zap,
        description: 'Get complete step-by-step solutions',
    },
    {
        id: 'guided' as Mode,
        label: 'Guided Learning',
        icon: MessageCircle,
        description: 'Interactive Q&A tutoring',
    },
    {
        id: 'learning' as Mode,
        label: 'Learning Mode',
        icon: GraduationCap,
        description: 'Full demonstration with voice',
    },
];

const ModeSelector: React.FC<ModeSelectorProps> = ({ currentMode, onModeChange }) => {
    return (
        <div className="flex items-center justify-between">
            <div className="flex gap-2 p-1 rounded-2xl bg-slate-800/30 border border-slate-700/50">
                {modes.map((mode) => {
                    const Icon = mode.icon;
                    const isActive = currentMode === mode.id;

                    return (
                        <button
                            key={mode.id}
                            onClick={() => onModeChange(mode.id)}
                            className={`mode-tab flex items-center gap-2 ${isActive ? 'mode-tab-active' : ''}`}
                            title={mode.description}
                        >
                            <Icon className={`w-4 h-4 ${isActive ? 'text-opal-400' : ''}`} />
                            <span>{mode.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Voice Toggle */}
            <button
                className="btn-icon flex items-center gap-2 px-3"
                title="Voice Controls"
            >
                <Mic className="w-4 h-4" />
                <span className="text-sm text-slate-400">Voice</span>
            </button>
        </div>
    );
};

export default ModeSelector;
