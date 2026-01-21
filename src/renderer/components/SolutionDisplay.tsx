import React, { useState, useEffect } from 'react';
import { ArrowLeft, Download, Copy, Pin, ExternalLink, Loader2, CheckCircle2 } from 'lucide-react';
import { Problem, Solution, SolutionStep } from '../App';
import { solveWithAI } from '../../services/AIService';
import MathRenderer from './MathRenderer';

interface SolutionDisplayProps {
    problem: Problem | null;
    solution: Solution | null;
    isProcessing: boolean;
    onSolutionReceived: (solution: Solution) => void;
    onBack: () => void;
}

const SolutionDisplay: React.FC<SolutionDisplayProps> = ({
    problem,
    solution,
    isProcessing,
    onSolutionReceived,
    onBack,
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isPinned, setIsPinned] = useState(false);
    const [copiedStep, setCopiedStep] = useState<number | null>(null);

    // Fetch solution when problem changes
    useEffect(() => {
        const fetchSolution = async () => {
            if (problem && !solution && !isProcessing) {
                setIsLoading(true);
                setError(null);

                try {
                    const result = await solveWithAI(problem, 'solution');
                    onSolutionReceived(result);
                } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to analyze problem');
                } finally {
                    setIsLoading(false);
                }
            }
        };

        fetchSolution();
    }, [problem, solution, isProcessing, onSolutionReceived]);

    const handleCopyStep = async (step: SolutionStep, index: number) => {
        await navigator.clipboard.writeText(step.content);
        setCopiedStep(index);
        setTimeout(() => setCopiedStep(null), 2000);
    };

    const handleExport = () => {
        // Export solution as text file for now
        if (solution) {
            const content = solution.steps.map((step, i) =>
                `Step ${i + 1}: ${step.content}`
            ).join('\n\n');

            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `solution-${Date.now()}.txt`;
            a.click();
            URL.revokeObjectURL(url);
        }
    };

    const handleShowOverlay = () => {
        if (solution) {
            window.electronAPI?.showOverlay(JSON.stringify(solution));
        }
    };

    const getStepClass = (type: SolutionStep['type']) => {
        const classes = {
            given: 'solution-step-given',
            find: 'solution-step-given',
            formula: 'solution-step-formula',
            work: 'solution-step-work',
            answer: 'solution-step-answer',
            note: 'solution-step-note',
        };
        return classes[type] || 'solution-step-work';
    };

    const getStepLabel = (type: SolutionStep['type']) => {
        const labels = {
            given: 'Given',
            find: 'Find',
            formula: 'Formula',
            work: 'Step',
            answer: 'Answer',
            note: 'Note',
        };
        return labels[type] || 'Step';
    };

    return (
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button
                    onClick={onBack}
                    className="btn-secondary flex items-center gap-2"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </button>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsPinned(!isPinned)}
                        className={`btn-icon ${isPinned ? 'bg-opal-500/20 text-opal-400' : ''}`}
                        title={isPinned ? 'Unpin overlay' : 'Pin overlay'}
                    >
                        <Pin className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleShowOverlay}
                        className="btn-icon"
                        title="Show in overlay"
                    >
                        <ExternalLink className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleExport}
                        className="btn-icon"
                        title="Export solution"
                        disabled={!solution}
                    >
                        <Download className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex gap-4 overflow-hidden">
                {/* Problem preview */}
                {problem?.imageData && (
                    <div className="w-1/3 glass p-4 overflow-hidden">
                        <h3 className="text-sm font-medium text-slate-400 mb-3">Problem</h3>
                        <img
                            src={problem.imageData}
                            alt="Problem"
                            className="w-full h-auto rounded-lg"
                        />
                        {problem.text && (
                            <p className="mt-3 text-sm text-slate-300">{problem.text}</p>
                        )}
                    </div>
                )}

                {/* Solution display */}
                <div className={`flex-1 glass p-4 overflow-auto ${!problem?.imageData ? 'w-full' : ''}`}>
                    <h3 className="text-sm font-medium text-slate-400 mb-3">Solution</h3>

                    {isLoading && (
                        <div className="flex flex-col items-center justify-center h-48 gap-3">
                            <Loader2 className="w-8 h-8 text-opal-400 animate-spin" />
                            <p className="text-slate-400">Analyzing problem...</p>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
                            <p>{error}</p>
                            <button
                                onClick={() => setError(null)}
                                className="btn-secondary mt-3 text-sm"
                            >
                                Try Again
                            </button>
                        </div>
                    )}

                    {solution && !isLoading && (
                        <div className="space-y-3">
                            {solution.steps.map((step, index) => (
                                <div
                                    key={index}
                                    className={`solution-step ${getStepClass(step.type)} group`}
                                    style={{ animationDelay: `${index * 100}ms` }}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1">
                                            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                                                {getStepLabel(step.type)}
                                            </span>
                                            <div className="mt-1">
                                                <MathRenderer content={step.content} />
                                            </div>
                                            {step.explanation && (
                                                <p className="mt-2 text-sm text-slate-400 italic">
                                                    {step.explanation}
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleCopyStep(step, index)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity btn-icon"
                                            title="Copy step"
                                        >
                                            {copiedStep === index ? (
                                                <CheckCircle2 className="w-4 h-4 text-green-400" />
                                            ) : (
                                                <Copy className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {!solution && !isLoading && !error && problem?.text && (
                        <div className="text-slate-400">
                            <p>Ready to analyze: {problem.text}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SolutionDisplay;
