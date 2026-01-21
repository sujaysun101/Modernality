import React, { useState, useEffect, useRef } from 'react';
import {
    ArrowLeft, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
    Maximize, Grid3X3, Loader2
} from 'lucide-react';
import { Problem } from '../App';
import { solveWithAI } from '../../services/AIService';
import DrawingCanvas from './DrawingCanvas';
import MathRenderer from './MathRenderer';

interface LearningModeProps {
    problem: Problem | null;
    onBack: () => void;
}

interface LearningStep {
    narration: string;
    action: string;
    visual?: string;
}

const LearningMode: React.FC<LearningModeProps> = ({ problem, onBack }) => {
    const [steps, setSteps] = useState<LearningStep[]>([]);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
    const [isLoading, setIsLoading] = useState(false);
    const [showGrid, setShowGrid] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [totalTime, setTotalTime] = useState(0);

    const canvasRef = useRef<{ clear: () => void; addText: (text: string, x: number, y: number) => void } | null>(null);

    // Load learning content
    useEffect(() => {
        const loadContent = async () => {
            if (problem && steps.length === 0) {
                setIsLoading(true);
                try {
                    const response = await solveWithAI(problem, 'learning');

                    // Parse response into learning steps
                    const parsedSteps = parseLearningSteps(response.rawResponse);
                    setSteps(parsedSteps);
                    setTotalTime(parsedSteps.length * 10); // Estimate 10 seconds per step
                } catch (error) {
                    console.error('Failed to load learning content:', error);
                    // Fallback demo content
                    setSteps([
                        {
                            narration: "Let's analyze this problem step by step.",
                            action: "Identifying key information...",
                        },
                        {
                            narration: "First, we need to identify what we know and what we're looking for.",
                            action: "Given: The provided values from the problem",
                        },
                        {
                            narration: "Now we can apply the relevant formula to solve this.",
                            action: "Applying the formula...",
                        },
                    ]);
                } finally {
                    setIsLoading(false);
                }
            }
        };

        loadContent();
    }, [problem]);

    // Playback control
    useEffect(() => {
        if (!isPlaying || steps.length === 0) return;

        const stepDuration = (10000 / playbackSpeed); // 10 seconds per step, adjusted by speed
        const tickInterval = 100;
        let elapsed = 0;

        const timer = setInterval(() => {
            elapsed += tickInterval;
            setCurrentTime(prev => prev + tickInterval / 1000);

            if (elapsed >= stepDuration) {
                if (currentStepIndex < steps.length - 1) {
                    setCurrentStepIndex(prev => prev + 1);
                    elapsed = 0;
                } else {
                    setIsPlaying(false);
                }
            }
        }, tickInterval);

        return () => clearInterval(timer);
    }, [isPlaying, currentStepIndex, steps.length, playbackSpeed]);

    const parseLearningSteps = (response: string): LearningStep[] => {
        // Simple parser - in production, this would be more sophisticated
        const stepPattern = /Step \d+:([\s\S]*?)(?=Step \d+:|$)/gi;
        const matches = [...response.matchAll(stepPattern)];

        if (matches.length === 0) {
            // Fallback: split by paragraphs
            return response.split('\n\n').filter(p => p.trim()).map(p => ({
                narration: p,
                action: p,
            }));
        }

        return matches.map(match => ({
            narration: match[1].trim(),
            action: match[1].trim(),
        }));
    };

    const goToStep = (index: number) => {
        setCurrentStepIndex(Math.max(0, Math.min(index, steps.length - 1)));
        setCurrentTime((index / steps.length) * totalTime);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const currentStep = steps[currentStepIndex];

    return (
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button onClick={onBack} className="btn-secondary flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </button>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowGrid(!showGrid)}
                        className={`btn-icon ${showGrid ? 'bg-opal-500/20 text-opal-400' : ''}`}
                        title="Toggle grid"
                    >
                        <Grid3X3 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="btn-icon"
                        title="Fullscreen"
                    >
                        <Maximize className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Main content */}
            <div className="flex-1 flex gap-4 overflow-hidden">
                {/* Problem preview */}
                {!isFullscreen && problem?.imageData && (
                    <div className="w-1/4 glass p-4 overflow-hidden">
                        <h3 className="text-sm font-medium text-slate-400 mb-3">Problem</h3>
                        <img
                            src={problem.imageData}
                            alt="Problem"
                            className="w-full h-auto rounded-lg"
                        />
                    </div>
                )}

                {/* Whiteboard */}
                <div className={`flex-1 flex flex-col glass overflow-hidden ${isFullscreen ? 'w-full' : ''}`}>
                    {isLoading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <Loader2 className="w-12 h-12 text-opal-400 animate-spin mx-auto mb-4" />
                                <p className="text-slate-400">Preparing demonstration...</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Canvas area */}
                            <div className="flex-1 relative overflow-hidden">
                                <DrawingCanvas
                                    ref={canvasRef}
                                    showGrid={showGrid}
                                    readOnly={true}
                                />

                                {/* Current step overlay */}
                                {currentStep && (
                                    <div className="absolute bottom-4 left-4 right-4 glass p-4 animate-slide-up">
                                        <div className="text-xs text-slate-400 mb-1">
                                            Step {currentStepIndex + 1} of {steps.length}
                                        </div>
                                        <MathRenderer content={currentStep.action} />
                                    </div>
                                )}
                            </div>

                            {/* Narration bar */}
                            {currentStep && (
                                <div className="p-4 bg-slate-800/50 border-t border-slate-700/50">
                                    <div className="flex items-center gap-3">
                                        <Volume2 className={`w-5 h-5 ${isMuted ? 'text-slate-500' : 'text-opal-400'}`} />
                                        <p className="text-slate-300 italic flex-1">
                                            "{currentStep.narration}"
                                        </p>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Playback controls */}
            <div className="glass p-4">
                <div className="flex items-center gap-4">
                    {/* Play controls */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => goToStep(currentStepIndex - 1)}
                            className="btn-icon"
                            disabled={currentStepIndex === 0}
                        >
                            <SkipBack className="w-5 h-5" />
                        </button>

                        <button
                            onClick={() => setIsPlaying(!isPlaying)}
                            className="btn-primary p-3 rounded-full"
                            disabled={steps.length === 0}
                        >
                            {isPlaying ? (
                                <Pause className="w-6 h-6" />
                            ) : (
                                <Play className="w-6 h-6 ml-0.5" />
                            )}
                        </button>

                        <button
                            onClick={() => goToStep(currentStepIndex + 1)}
                            className="btn-icon"
                            disabled={currentStepIndex === steps.length - 1}
                        >
                            <SkipForward className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Timeline */}
                    <div className="flex-1 flex items-center gap-3">
                        <span className="text-sm text-slate-400 w-12">
                            {formatTime(currentTime)}
                        </span>
                        <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-opal-500 to-opal-400 transition-all"
                                style={{ width: `${(currentStepIndex / Math.max(steps.length - 1, 1)) * 100}%` }}
                            />
                        </div>
                        <span className="text-sm text-slate-400 w-12">
                            {formatTime(totalTime)}
                        </span>
                    </div>

                    {/* Speed and volume */}
                    <div className="flex items-center gap-2">
                        <select
                            value={playbackSpeed}
                            onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                            className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-sm"
                        >
                            <option value={0.5}>0.5x</option>
                            <option value={0.75}>0.75x</option>
                            <option value={1}>1x</option>
                            <option value={1.5}>1.5x</option>
                            <option value={2}>2x</option>
                        </select>

                        <button
                            onClick={() => setIsMuted(!isMuted)}
                            className="btn-icon"
                        >
                            {isMuted ? (
                                <VolumeX className="w-5 h-5" />
                            ) : (
                                <Volume2 className="w-5 h-5" />
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LearningMode;
