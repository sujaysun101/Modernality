import React, { useState, useEffect } from 'react';
import TitleBar from './components/TitleBar';
import ModeSelector from './components/ModeSelector';
import ProblemCapture from './components/ProblemCapture';
import SolutionDisplay from './components/SolutionDisplay';
import GuidedLearning from './components/GuidedLearning';
import LearningMode from './components/LearningMode';
import SettingsPanel from './components/SettingsPanel';
import RecentProblems from './components/RecentProblems';

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

const App: React.FC = () => {
    const [currentMode, setCurrentMode] = useState<Mode>('solution');
    const [showSettings, setShowSettings] = useState(false);
    const [currentProblem, setCurrentProblem] = useState<Problem | null>(null);
    const [solution, setSolution] = useState<Solution | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [recentProblems, setRecentProblems] = useState<Problem[]>([]);

    // Listen for captured problems from main process
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

        // Add to recent problems
        setRecentProblems(prev => [problem, ...prev.slice(0, 9)]);

        // Processing will happen in child components
        setIsProcessing(false);
    };

    const handleSolutionReceived = (newSolution: Solution) => {
        setSolution(newSolution);
    };

    const renderModeContent = () => {
        if (!currentProblem && !isProcessing) {
            return (
                <div className="flex-1 flex flex-col">
                    <ProblemCapture onProblemSubmit={handleProblemSubmit} />
                    {recentProblems.length > 0 && (
                        <RecentProblems
                            problems={recentProblems}
                            onSelect={(problem) => setCurrentProblem(problem)}
                        />
                    )}
                </div>
            );
        }

        switch (currentMode) {
            case 'solution':
                return (
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
                );
            case 'guided':
                return (
                    <GuidedLearning
                        problem={currentProblem}
                        onBack={() => {
                            setCurrentProblem(null);
                            setSolution(null);
                        }}
                    />
                );
            case 'learning':
                return (
                    <LearningMode
                        problem={currentProblem}
                        onBack={() => {
                            setCurrentProblem(null);
                            setSolution(null);
                        }}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div className="h-screen flex flex-col bg-animated">
            <TitleBar onSettingsClick={() => setShowSettings(true)} />

            <div className="flex-1 flex flex-col px-6 pb-6 overflow-hidden">
                <ModeSelector
                    currentMode={currentMode}
                    onModeChange={(mode) => {
                        setCurrentMode(mode);
                        // Reset solution when changing modes
                        setSolution(null);
                    }}
                />

                <div className="flex-1 mt-4 overflow-hidden">
                    {renderModeContent()}
                </div>
            </div>

            {showSettings && (
                <SettingsPanel onClose={() => setShowSettings(false)} />
            )}
        </div>
    );
};

export default App;
