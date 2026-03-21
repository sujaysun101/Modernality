import React, { useState, useCallback } from 'react';
import { Camera, Upload, ClipboardPaste, Keyboard, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Problem } from '../App';

interface ProblemCaptureProps {
    onProblemSubmit: (problem: Problem) => void;
}

const ProblemCapture: React.FC<ProblemCaptureProps> = ({ onProblemSubmit }) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [textInput, setTextInput] = useState('');
    const [isOcrWorking, setIsOcrWorking] = useState(false);

    const handleCapture = async () => {
        if (window.electronAPI?.openCaptureWindow) {
            await window.electronAPI.openCaptureWindow();
            return;
        }
        if (window.electronAPI?.captureScreen) {
            const imageData = await window.electronAPI.captureScreen();
            if (imageData) {
                setPreviewImage(imageData);
            }
        }
    };

    const handleFileUpload = useCallback((file: File) => {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const imageData = e.target?.result as string;
                setPreviewImage(imageData);
            };
            reader.readAsDataURL(file);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);

        const file = e.dataTransfer.files[0];
        if (file) {
            handleFileUpload(file);
        }
    }, [handleFileUpload]);

    const handlePaste = async () => {
        try {
            const clipboardItems = await navigator.clipboard.read();
            for (const item of clipboardItems) {
                for (const type of item.types) {
                    if (type.startsWith('image/')) {
                        const blob = await item.getType(type);
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            setPreviewImage(e.target?.result as string);
                        };
                        reader.readAsDataURL(blob);
                        return;
                    }
                }
            }
        } catch {
            console.log('No image in clipboard');
        }
    };

    const handleSubmit = async () => {
        if (!previewImage && !textInput.trim()) return;

        let combinedText = textInput.trim();
        const imageData = previewImage || '';

        if (previewImage && window.electronAPI) {
            const stored = await window.electronAPI.getSettings();
            const ocrOn = stored.ocrOnSubmit !== false;
            if (ocrOn) {
                setIsOcrWorking(true);
                try {
                    const { extractTextFromImage } = await import('../../services/OCRService');
                    const ocr = await extractTextFromImage(previewImage);
                    const t = ocr.text.trim();
                    if (t) {
                        combinedText = combinedText
                            ? `${combinedText}\n\n[Extracted from image]\n${t}`
                            : `[Extracted from image]\n${t}`;
                    }
                } catch {
                    /* OCR optional */
                } finally {
                    setIsOcrWorking(false);
                }
            }
        }

        const problem: Problem = {
            id: Date.now().toString(),
            imageData,
            text: combinedText,
            timestamp: new Date(),
        };
        onProblemSubmit(problem);
        setPreviewImage(null);
        setTextInput('');
    };

    return (
        <div className="flex-1 flex flex-col gap-4">
            {/* Action buttons */}
            <div className="flex gap-3">
                <button
                    onClick={handleCapture}
                    className="btn-primary flex items-center gap-2"
                >
                    <Camera className="w-5 h-5" />
                    Capture Problem
                </button>

                <label className="btn-secondary flex items-center gap-2 cursor-pointer">
                    <Upload className="w-5 h-5" />
                    Load Image
                    <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                    />
                </label>

                <button
                    onClick={handlePaste}
                    className="btn-secondary flex items-center gap-2"
                >
                    <ClipboardPaste className="w-5 h-5" />
                    Paste
                </button>
            </div>

            {/* Drop zone / Preview area */}
            <div
                className={`flex-1 glass flex flex-col items-center justify-center min-h-[300px] transition-all duration-200
          ${isDragOver ? 'border-opal-500 bg-opal-500/10' : 'border-dashed border-2'}
        `}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
            >
                {previewImage ? (
                    <div className="w-full h-full p-4 flex flex-col">
                        <div className="flex-1 flex items-center justify-center overflow-hidden">
                            <img
                                src={previewImage}
                                alt="Problem preview"
                                className="max-w-full max-h-full object-contain rounded-lg shadow-xl"
                            />
                        </div>
                        <div className="flex gap-3 mt-4 justify-center">
                            <button
                                onClick={() => setPreviewImage(null)}
                                className="btn-secondary"
                            >
                                Clear
                            </button>
                            <button
                                onClick={handleSubmit}
                                className="btn-primary"
                            >
                                Analyze Problem
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center space-y-4">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-700/50 flex items-center justify-center">
                            <ImageIcon className="w-8 h-8 text-slate-400" />
                        </div>
                        <div>
                            <p className="text-lg text-slate-300">Drop an image here</p>
                            <p className="text-sm text-slate-500 mt-1">or use the buttons above</p>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500 text-sm">
                            <Keyboard className="w-4 h-4" />
                            <span>Press <kbd className="px-2 py-1 bg-slate-700 rounded text-xs">Ctrl+Shift+S</kbd> to capture screen</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Optional text input */}
            {!previewImage && (
                <div className="glass p-4">
                    <label className="block text-sm text-slate-400 mb-2">
                        Or type/paste your problem:
                    </label>
                    <textarea
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        placeholder="Enter your problem here... (e.g., 'Find the acceleration if v₀ = 10 m/s, v = 25 m/s, and t = 3 s')"
                        className="input-field h-24 resize-none"
                    />
                    {textInput && (
                        <button
                            onClick={() => void handleSubmit()}
                            className="btn-primary mt-3 flex items-center gap-2"
                            disabled={isOcrWorking}
                        >
                            {isOcrWorking && <Loader2 className="w-4 h-4 animate-spin" />}
                            {isOcrWorking ? 'Working…' : 'Analyze Problem'}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default ProblemCapture;
