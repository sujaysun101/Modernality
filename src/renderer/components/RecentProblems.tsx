import React from 'react';
import { Clock, ChevronRight } from 'lucide-react';
import { Problem } from '../App';

interface RecentProblemsProps {
    problems: Problem[];
    onSelect: (problem: Problem) => void;
}

const RecentProblems: React.FC<RecentProblemsProps> = ({ problems, onSelect }) => {
    const formatTime = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - new Date(date).getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    };

    return (
        <div className="glass p-4 mt-4">
            <h3 className="text-sm font-medium text-slate-400 flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4" />
                Recent Problems
            </h3>

            <div className="space-y-2">
                {problems.slice(0, 5).map((problem) => (
                    <button
                        key={problem.id}
                        onClick={() => onSelect(problem)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-700/30 hover:bg-slate-700/50 transition-all group"
                    >
                        {problem.imageData && (
                            <img
                                src={problem.imageData}
                                alt="Problem thumbnail"
                                className="w-12 h-12 object-cover rounded-lg"
                            />
                        )}
                        <div className="flex-1 text-left">
                            <p className="text-sm text-slate-200 truncate">
                                {problem.text || problem.subject || 'Image problem'}
                            </p>
                            <p className="text-xs text-slate-500">{formatTime(problem.timestamp)}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-opal-400 transition-colors" />
                    </button>
                ))}
            </div>
        </div>
    );
};

export default RecentProblems;
