import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Mic, MicOff, Lightbulb, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Problem } from '../App';
import { solveWithAI, continueGuidedLearning } from '../../services/AIService';
import { speechToText, voiceRecorder } from '../../services/VoiceService';
import MathRenderer from './MathRenderer';

interface GuidedLearningProps {
    problem: Problem | null;
    onBack: () => void;
}

interface ConversationMessage {
    role: 'ai' | 'user';
    content: string;
    type?: 'question' | 'feedback' | 'hint' | 'answer';
    isCorrect?: boolean;
}

interface GuidedState {
    currentStep: number;
    totalSteps: number;
    shownSteps: string[];
    conversationHistory: ConversationMessage[];
}

const GuidedLearning: React.FC<GuidedLearningProps> = ({ problem, onBack }) => {
    const [state, setState] = useState<GuidedState>({
        currentStep: 1,
        totalSteps: 7,
        shownSteps: [],
        conversationHistory: [],
    });
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [showHint, setShowHint] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!problem) return;

        let cancelled = false;
        setState({
            currentStep: 1,
            totalSteps: 7,
            shownSteps: [],
            conversationHistory: [],
        });

        (async () => {
            setIsLoading(true);
            try {
                const response = await solveWithAI(problem, 'guided');
                if (cancelled) return;
                const initialMessage: ConversationMessage = {
                    role: 'ai',
                    content: response.rawResponse,
                    type: 'question',
                };
                setState({
                    currentStep: 1,
                    totalSteps: response.steps.length || 7,
                    shownSteps: [],
                    conversationHistory: [initialMessage],
                });
            } catch (error) {
                console.error('Failed to initialize guided learning:', error);
                if (!cancelled) {
                    setState({
                        currentStep: 1,
                        totalSteps: 7,
                        shownSteps: [],
                        conversationHistory: [
                            {
                                role: 'ai',
                                content:
                                    "Let's work through this problem together! I'll guide you step by step. What information can you identify from the problem?",
                                type: 'question',
                            },
                        ],
                    });
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [problem?.id]);

    // Auto-scroll to bottom
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [state.conversationHistory]);

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!userInput.trim() || isLoading) return;

        const userMessage: ConversationMessage = {
            role: 'user',
            content: userInput,
            type: 'answer',
        };

        const historyForApi = [...state.conversationHistory, userMessage];

        setState(prev => ({
            ...prev,
            conversationHistory: historyForApi,
        }));
        setUserInput('');
        setIsLoading(true);

        try {
            const response = await continueGuidedLearning(
                problem!,
                historyForApi.map((m) => ({ role: m.role, content: m.content })),
                state.currentStep
            );

            const aiMessage: ConversationMessage = {
                role: 'ai',
                content: response.content,
                type: response.type as 'feedback' | 'question',
                isCorrect: response.isCorrect,
            };

            setState(prev => ({
                ...prev,
                conversationHistory: [...historyForApi, aiMessage],
                currentStep: response.isCorrect ? prev.currentStep + 1 : prev.currentStep,
            }));
        } catch (error) {
            console.error('Failed to get AI response:', error);
            setState(prev => ({
                ...prev,
                conversationHistory: [...prev.conversationHistory, {
                    role: 'ai',
                    content: "That's an interesting approach! Can you tell me more about your reasoning?",
                    type: 'question',
                }],
            }));
        } finally {
            setIsLoading(false);
        }
    };

    const toggleVoiceInput = async () => {
        if (isListening) {
            setIsListening(false);
            const blob = await voiceRecorder.stopRecording();
            if (blob) {
                const text = await speechToText(blob);
                if (text?.trim()) {
                    setUserInput((prev) => (prev ? `${prev} ${text.trim()}` : text.trim()));
                }
            }
            return;
        }
        const ok = await voiceRecorder.startRecording();
        setIsListening(ok);
    };

    const requestHint = () => {
        setShowHint(true);
        setState(prev => ({
            ...prev,
            conversationHistory: [...prev.conversationHistory, {
                role: 'ai',
                content: "💡 Hint: Think about what physical principles or formulas relate the quantities you've been given. What do the variables represent?",
                type: 'hint',
            }],
        }));
    };

    const progressPercent = (state.currentStep / state.totalSteps) * 100;

    return (
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button onClick={onBack} className="btn-secondary flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </button>

                <div className="flex items-center gap-4">
                    <div className="text-sm text-slate-400">
                        Step {state.currentStep} of {state.totalSteps}
                    </div>
                    <button
                        onClick={requestHint}
                        className="btn-icon flex items-center gap-2 px-3"
                        disabled={showHint}
                    >
                        <Lightbulb className="w-4 h-4 text-yellow-400" />
                        Hint
                    </button>
                </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-opal-500 to-opal-400 transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                />
            </div>

            {/* Chat area */}
            <div className="flex-1 flex gap-4 overflow-hidden">
                {/* Problem preview */}
                {problem?.imageData && (
                    <div className="w-1/3 glass p-4 overflow-hidden">
                        <h3 className="text-sm font-medium text-slate-400 mb-3">Problem</h3>
                        <img
                            src={problem.imageData}
                            alt="Problem"
                            className="w-full h-auto rounded-lg sticky top-0"
                        />
                    </div>
                )}

                {/* Conversation */}
                <div className="flex-1 flex flex-col glass overflow-hidden">
                    <div className="flex-1 overflow-auto p-4 space-y-4">
                        {state.conversationHistory.map((message, index) => (
                            <div
                                key={index}
                                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                            >
                                <div
                                    className={`max-w-[80%] p-4 rounded-2xl ${message.role === 'user'
                                            ? 'bg-opal-500/20 border border-opal-500/30 ml-8'
                                            : 'bg-slate-700/50 border border-slate-600/30 mr-8'
                                        }`}
                                >
                                    {message.role === 'ai' && message.type === 'feedback' && (
                                        <div className="flex items-center gap-2 mb-2">
                                            {message.isCorrect ? (
                                                <>
                                                    <CheckCircle className="w-4 h-4 text-green-400" />
                                                    <span className="text-sm text-green-400 font-medium">Correct!</span>
                                                </>
                                            ) : (
                                                <>
                                                    <AlertCircle className="w-4 h-4 text-yellow-400" />
                                                    <span className="text-sm text-yellow-400 font-medium">Let's reconsider...</span>
                                                </>
                                            )}
                                        </div>
                                    )}
                                    <MathRenderer content={message.content} />
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex justify-start animate-fade-in">
                                <div className="bg-slate-700/50 p-4 rounded-2xl flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-opal-400" />
                                    <span className="text-slate-400">Thinking...</span>
                                </div>
                            </div>
                        )}

                        <div ref={chatEndRef} />
                    </div>

                    {/* Input area */}
                    <form onSubmit={handleSubmit} className="p-4 border-t border-slate-700/50">
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={toggleVoiceInput}
                                className={`btn-icon ${isListening ? 'bg-red-500/20 text-red-400' : ''}`}
                            >
                                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                            </button>

                            <input
                                type="text"
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                                placeholder="Type your answer..."
                                className="input-field flex-1"
                                disabled={isLoading}
                            />

                            <button
                                type="submit"
                                disabled={!userInput.trim() || isLoading}
                                className="btn-primary px-4"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default GuidedLearning;
