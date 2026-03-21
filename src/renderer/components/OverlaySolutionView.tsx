import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import MathRenderer from './MathRenderer';

interface OverlayStep {
    type?: string;
    content?: string;
    explanation?: string;
}

function parsePayload(raw: string): { steps: OverlayStep[]; title: string } {
    try {
        const parsed = JSON.parse(raw) as { steps?: OverlayStep[] };
        if (parsed?.steps && Array.isArray(parsed.steps)) {
            return { steps: parsed.steps, title: 'Solution' };
        }
    } catch {
        /* fall through */
    }
    return {
        steps: [{ content: raw }],
        title: 'Solution',
    };
}

/**
 * Compact always-on-top overlay (#/overlay) driven by IPC display-solution.
 */
const OverlaySolutionView: React.FC = () => {
    const [payload, setPayload] = useState<string | null>(null);

    useEffect(() => {
        window.electronAPI?.onDisplaySolution((solution) => {
            setPayload(solution);
        });
    }, []);

    const { steps, title } = payload ? parsePayload(payload) : { steps: [], title: 'Solution' };

    return (
        <div className="h-screen w-screen flex flex-col bg-slate-950/85 text-slate-100 backdrop-blur-md border border-slate-700/40 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50 drag-region">
                <span className="text-sm font-medium text-slate-300">{title}</span>
                <button
                    type="button"
                    className="btn-icon no-drag"
                    title="Hide overlay"
                    onClick={() => window.electronAPI?.hideOverlay()}
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
            <div className="flex-1 overflow-auto p-3 space-y-3">
                {steps.length === 0 && (
                    <p className="text-sm text-slate-400">Waiting for solution…</p>
                )}
                {steps.map((step, i) => (
                    <div
                        key={i}
                        className="rounded-lg border border-slate-700/40 bg-slate-900/60 p-3 text-sm"
                    >
                        {step.type && (
                            <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                                {step.type}
                            </div>
                        )}
                        {step.content && <MathRenderer content={step.content} />}
                        {step.explanation && (
                            <p className="mt-2 text-xs text-slate-400 italic">{step.explanation}</p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default OverlaySolutionView;
