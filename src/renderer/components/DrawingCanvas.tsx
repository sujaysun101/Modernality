import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Pencil, Eraser, Circle, Square, ArrowRight, Type, Undo2, Redo2, Trash2 } from 'lucide-react';

interface DrawingCanvasProps {
    showGrid?: boolean;
    readOnly?: boolean;
    onStrokesChange?: (strokes: Stroke[]) => void;
}

interface Point {
    x: number;
    y: number;
}

interface Stroke {
    points: Point[];
    color: string;
    size: number;
    tool: 'pen' | 'eraser';
    timestamp: number;
}

export interface DrawingCanvasRef {
    clear: () => void;
    addText: (text: string, x: number, y: number) => void;
    getStrokes: () => Stroke[];
    replayStrokes: (speed?: number) => void;
}

const tools = [
    { id: 'pen', icon: Pencil, label: 'Pen' },
    { id: 'eraser', icon: Eraser, label: 'Eraser' },
    { id: 'circle', icon: Circle, label: 'Circle' },
    { id: 'square', icon: Square, label: 'Rectangle' },
    { id: 'arrow', icon: ArrowRight, label: 'Arrow' },
    { id: 'text', icon: Type, label: 'Text' },
] as const;

const colors = [
    '#ffffff', // white
    '#3b82f6', // blue (given)
    '#22c55e', // green (formula)
    '#ef4444', // red (answer)
    '#a855f7', // purple (note)
    '#f59e0b', // orange
];

const sizes = [2, 4, 6, 8];

const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(
    ({ showGrid = true, readOnly = false, onStrokesChange }, ref) => {
        const canvasRef = useRef<HTMLCanvasElement>(null);
        const [isDrawing, setIsDrawing] = useState(false);
        const [currentTool, setCurrentTool] = useState<string>('pen');
        const [currentColor, setCurrentColor] = useState(colors[0]);
        const [currentSize, setCurrentSize] = useState(sizes[1]);
        const [strokes, setStrokes] = useState<Stroke[]>([]);
        const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
        const [undoStack, setUndoStack] = useState<Stroke[][]>([]);
        const [redoStack, setRedoStack] = useState<Stroke[][]>([]);

        // Expose methods via ref
        useImperativeHandle(ref, () => ({
            clear: () => {
                setUndoStack([...undoStack, strokes]);
                setStrokes([]);
                setRedoStack([]);
                const canvas = canvasRef.current;
                const ctx = canvas?.getContext('2d');
                if (ctx && canvas) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                }
            },
            addText: (text: string, x: number, y: number) => {
                const canvas = canvasRef.current;
                const ctx = canvas?.getContext('2d');
                if (ctx) {
                    ctx.font = '16px Inter';
                    ctx.fillStyle = currentColor;
                    ctx.fillText(text, x, y);
                }
            },
            getStrokes: () => strokes,
            replayStrokes: (speed = 1) => {
                // Replay animation would go here
                redrawAll(strokes);
            },
        }));

        // Initialize canvas
        useEffect(() => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const resize = () => {
                const rect = canvas.getBoundingClientRect();
                canvas.width = rect.width * window.devicePixelRatio;
                canvas.height = rect.height * window.devicePixelRatio;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
                }
                redrawAll(strokes);
            };

            resize();
            window.addEventListener('resize', resize);
            return () => window.removeEventListener('resize', resize);
        }, [strokes]);

        // Draw grid
        useEffect(() => {
            if (!showGrid) return;
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            if (!ctx || !canvas) return;

            const rect = canvas.getBoundingClientRect();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 1;

            const gridSize = 20;
            for (let x = 0; x <= rect.width; x += gridSize) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, rect.height);
                ctx.stroke();
            }
            for (let y = 0; y <= rect.height; y += gridSize) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(rect.width, y);
                ctx.stroke();
            }
        }, [showGrid, strokes]);

        const redrawAll = (strokesToDraw: Stroke[]) => {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            if (!ctx || !canvas) return;

            const rect = canvas.getBoundingClientRect();
            ctx.clearRect(0, 0, rect.width, rect.height);

            // Redraw grid
            if (showGrid) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
                ctx.lineWidth = 1;
                const gridSize = 20;
                for (let x = 0; x <= rect.width; x += gridSize) {
                    ctx.beginPath();
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, rect.height);
                    ctx.stroke();
                }
                for (let y = 0; y <= rect.height; y += gridSize) {
                    ctx.beginPath();
                    ctx.moveTo(0, y);
                    ctx.lineTo(rect.width, y);
                    ctx.stroke();
                }
            }

            // Redraw strokes
            strokesToDraw.forEach(stroke => {
                ctx.strokeStyle = stroke.tool === 'eraser' ? '#0f172a' : stroke.color;
                ctx.lineWidth = stroke.size;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';

                if (stroke.points.length > 0) {
                    ctx.beginPath();
                    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
                    stroke.points.forEach(point => {
                        ctx.lineTo(point.x, point.y);
                    });
                    ctx.stroke();
                }
            });
        };

        const getMousePos = (e: React.MouseEvent): Point => {
            const canvas = canvasRef.current;
            if (!canvas) return { x: 0, y: 0 };
            const rect = canvas.getBoundingClientRect();
            return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            };
        };

        const startDrawing = (e: React.MouseEvent) => {
            if (readOnly) return;
            setIsDrawing(true);
            const pos = getMousePos(e);
            setCurrentStroke([pos]);

            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            if (ctx) {
                ctx.strokeStyle = currentTool === 'eraser' ? '#0f172a' : currentColor;
                ctx.lineWidth = currentSize;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.beginPath();
                ctx.moveTo(pos.x, pos.y);
            }
        };

        const draw = (e: React.MouseEvent) => {
            if (!isDrawing || readOnly) return;
            const pos = getMousePos(e);
            setCurrentStroke(prev => [...prev, pos]);

            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            if (ctx) {
                ctx.lineTo(pos.x, pos.y);
                ctx.stroke();
            }
        };

        const stopDrawing = () => {
            if (!isDrawing || readOnly) return;
            setIsDrawing(false);

            if (currentStroke.length > 0) {
                const newStroke: Stroke = {
                    points: currentStroke,
                    color: currentColor,
                    size: currentSize,
                    tool: currentTool === 'eraser' ? 'eraser' : 'pen',
                    timestamp: Date.now(),
                };
                const newStrokes = [...strokes, newStroke];
                setStrokes(newStrokes);
                setUndoStack([...undoStack, strokes]);
                setRedoStack([]);
                onStrokesChange?.(newStrokes);
            }
            setCurrentStroke([]);
        };

        const undo = () => {
            if (undoStack.length === 0) return;
            const previousStrokes = undoStack[undoStack.length - 1];
            setRedoStack([...redoStack, strokes]);
            setStrokes(previousStrokes);
            setUndoStack(undoStack.slice(0, -1));
            redrawAll(previousStrokes);
        };

        const redo = () => {
            if (redoStack.length === 0) return;
            const nextStrokes = redoStack[redoStack.length - 1];
            setUndoStack([...undoStack, strokes]);
            setStrokes(nextStrokes);
            setRedoStack(redoStack.slice(0, -1));
            redrawAll(nextStrokes);
        };

        const clearCanvas = () => {
            setUndoStack([...undoStack, strokes]);
            setStrokes([]);
            setRedoStack([]);
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            if (ctx && canvas) {
                const rect = canvas.getBoundingClientRect();
                ctx.clearRect(0, 0, rect.width, rect.height);
            }
            redrawAll([]);
        };

        return (
            <div className="flex-1 flex flex-col">
                {/* Tools bar */}
                {!readOnly && (
                    <div className="flex items-center gap-2 p-2 bg-slate-800/50 border-b border-slate-700/50">
                        {/* Tool selection */}
                        <div className="flex items-center gap-1 p-1 bg-slate-700/50 rounded-lg">
                            {tools.map((tool) => {
                                const Icon = tool.icon;
                                return (
                                    <button
                                        key={tool.id}
                                        onClick={() => setCurrentTool(tool.id)}
                                        className={`p-2 rounded-lg transition-colors ${currentTool === tool.id
                                                ? 'bg-opal-500/20 text-opal-400'
                                                : 'text-slate-400 hover:text-white hover:bg-slate-600/50'
                                            }`}
                                        title={tool.label}
                                    >
                                        <Icon className="w-4 h-4" />
                                    </button>
                                );
                            })}
                        </div>

                        <div className="w-px h-6 bg-slate-700" />

                        {/* Colors */}
                        <div className="flex items-center gap-1">
                            {colors.map((color) => (
                                <button
                                    key={color}
                                    onClick={() => setCurrentColor(color)}
                                    className={`w-6 h-6 rounded-full transition-transform ${currentColor === color ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-slate-800' : ''
                                        }`}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>

                        <div className="w-px h-6 bg-slate-700" />

                        {/* Sizes */}
                        <div className="flex items-center gap-1">
                            {sizes.map((size) => (
                                <button
                                    key={size}
                                    onClick={() => setCurrentSize(size)}
                                    className={`w-8 h-8 flex items-center justify-center rounded-lg ${currentSize === size ? 'bg-opal-500/20' : 'hover:bg-slate-600/50'
                                        }`}
                                >
                                    <div
                                        className="rounded-full bg-white"
                                        style={{ width: size * 2, height: size * 2 }}
                                    />
                                </button>
                            ))}
                        </div>

                        <div className="flex-1" />

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                            <button
                                onClick={undo}
                                disabled={undoStack.length === 0}
                                className="btn-icon"
                                title="Undo"
                            >
                                <Undo2 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={redo}
                                disabled={redoStack.length === 0}
                                className="btn-icon"
                                title="Redo"
                            >
                                <Redo2 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={clearCanvas}
                                className="btn-icon hover:text-red-400"
                                title="Clear all"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Canvas */}
                <canvas
                    ref={canvasRef}
                    className="flex-1 w-full cursor-crosshair"
                    style={{ touchAction: 'none' }}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                />
            </div>
        );
    }
);

DrawingCanvas.displayName = 'DrawingCanvas';

export default DrawingCanvas;
