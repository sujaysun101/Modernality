import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import TitleBar from './components/TitleBar';
import ModeSelector from './components/ModeSelector';

const ProblemCapture = lazy(() => import('./components/ProblemCapture'));
const SolutionDisplay = lazy(() => import('./components/SolutionDisplay'));
const GuidedLearning = lazy(() => import('./components/GuidedLearning'));
const LearningMode = lazy(() => import('./components/LearningMode'));
const SettingsPanel = lazy(() => import('./components/SettingsPanel'));
const RecentProblems = lazy(() => import('./components/RecentProblems'));

export type Mode = 'solution' | 'guided' | 'learning';

export interface Problem {
    id: string;
    imageData: string;
    text: string;
    timestamp: Date;
    subject?: string;
}

export interface Solution {
    steps: SolutionStep[];
    rawResponse: string;
}

export interface SolutionStep {
    type: 'given' | 'find' | 'formula' | 'work' | 'answer' | 'note';
    content: string;
    explanation?: string;
}

function resolveEffectiveTheme(settings: Record<string, unknown>): 'light' | 'dark' {
    const t = settings.theme as string | undefined;
    if (t === 'light') return 'light';
    if (t === 'dark') return 'dark';
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light';
    }
    return 'dark';
}

const loadFallback = (
    <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Loading…</div>
);

const App: React.FC = () => {
    const [currentMode, setCurrentMode] = useState<Mode>('solution');
    const [showSettings, setShowSettings] = useState(false);
    const [currentProblem, setCurrentProblem] = useState<Problem | null>(null);
    const [solution, setSolution] = useState<Solution | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [recentProblems, setRecentProblems] = useState<Problem[]>([]);
    const [uiTheme, setUiTheme] = useState<'light' | 'dark'>('dark');

    const applyDocumentSettings = useCallback(async () => {
        let s: Record<string, unknown> = {};
        if (window.electronAPI) {
            s = await window.electronAPI.getSettings();
        }
        const effective = resolveEffectiveTheme(s);
        setUiTheme(effective);
        document.documentElement.dataset.theme = effective;
        const fs = (s.fontSize as string) || 'medium';
        document.documentElement.dataset.fontSize = fs === 'small' || fs === 'large' ? fs : 'medium';
    }, []);

    useEffect(() => {
        void applyDocumentSettings();
        const onChange = () => void applyDocumentSettings();
        window.addEventListener('opal-settings-changed', onChange);
        const mql = window.matchMedia('(prefers-color-scheme: light)');
        mql.addEventListener('change', onChange);
        return () => {
            window.removeEventListener('opal-settings-changed', onChange);
            mql.removeEventListener('change', onChange);
        };
    }, [applyDocumentSettings]);

    useEffect(() => {
        if (window.electronAPI) {
            window.electronAPI.onProblemCaptured((imageData: string) => {
                const newProblem: Problem = {
                    id: Date.now().toString(),
                    imageData,
                    text: '',
                    timestamp: new Date(),
                };
                setCurrentProblem(newProblem);
            });
        }
    }, []);

    const handleProblemSubmit = async (problem: Problem) => {
        setCurrentProblem(problem);
        setIsProcessing(true);

        setRecentProblems((prev) => [problem, ...prev.slice(0, 9)]);

        setIsProcessing(false);
    };

    const handleSolutionReceived = useCallback((newSolution: Solution) => {
        setSolution(newSolution);
    }, []);

    const rootSurface =
        uiTheme === 'light'
            ? 'h-screen flex flex-col bg-animated-light text-slate-900 overflow-hidden'
            : 'h-screen flex flex-col bg-animated text-slate-100 overflow-hidden';

    const renderModeContent = () => {
        if (!currentProblem && !isProcessing) {
            return (
                <Suspense fallback={loadFallback}>
                    <div className="flex-1 flex flex-col">
                        <ProblemCapture onProblemSubmit={handleProblemSubmit} />
                        {recentProblems.length > 0 && (
                            <RecentProblems
                                problems={recentProblems}
                                onSelect={(problem) => setCurrentProblem(problem)}
                            />
                        )}
                    </div>
                </Suspense>
            );
        }

        return (
            <Suspense fallback={loadFallback}>
                {currentMode === 'solution' && (
                    <SolutionDisplay
                        problem={currentProblem}
                        solution={solution}
                        isProcessing={isProcessing}
                        onSolutionReceived={handleSolutionReceived}
                        onBack={() => {
                            setCurrentProblem(null);
                            setSolution(null);
                        }}
                    />
                )}
                {currentMode === 'guided' && (
                    <GuidedLearning
                        problem={currentProblem}
                        onBack={() => {
                            setCurrentProblem(null);
                            setSolution(null);
                        }}
                    />
                )}
                {currentMode === 'learning' && (
                    <LearningMode
                        problem={currentProblem}
                        onBack={() => {
                            setCurrentProblem(null);
                            setSolution(null);
                        }}
                    />
                )}
            </Suspense>
        );
    };

    return (
        <div className={rootSurface}>
            <TitleBar onSettingsClick={() => setShowSettings(true)} />

            <div className="flex-1 flex flex-col px-6 pb-6 overflow-hidden">
                <ModeSelector
                    currentMode={currentMode}
                    onModeChange={(mode) => {
                        setCurrentMode(mode);
                        setSolution(null);
                    }}
                />

                <div className="flex-1 mt-4 overflow-hidden">{renderModeContent()}</div>
            </div>

            {showSettings && (
                <Suspense fallback={null}>
                    <SettingsPanel onClose={() => setShowSettings(false)} />
                </Suspense>
            )}
        </div>
    );
};

export default App;
