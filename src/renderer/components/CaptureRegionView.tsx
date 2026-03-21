import React, { useCallback, useEffect, useRef, useState } from 'react';

type Point = { x: number; y: number };

/**
 * Fullscreen region picker for the Electron capture window (#/capture).
 * Maps selection from displayed (scaled) image back to source pixels for a crisp crop.
 */
const CaptureRegionView: React.FC = () => {
    const [error, setError] = useState<string | null>(null);
    const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
    const [dragging, setDragging] = useState(false);
    const finishingRef = useRef(false);
    const [start, setStart] = useState<Point | null>(null);
    const [current, setCurrent] = useState<Point | null>(null);
    const layoutRef = useRef<{
        ox: number;
        oy: number;
        scale: number;
        nw: number;
        nh: number;
    } | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await window.electronAPI?.captureScreen();
                if (cancelled) return;
                if (!data) {
                    setError('Could not capture screen. Grant screen capture permission and try again.');
                    return;
                }
                setImageDataUrl(data);
            } catch {
                if (!cancelled) setError('Screen capture failed.');
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const close = useCallback(() => {
        window.electronAPI?.closeCaptureWindow();
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [close]);

    const clientToImageRect = useCallback(() => {
        const layout = layoutRef.current;
        const s = start;
        const c = current;
        if (!layout || !s || !c) return null;

        const x1 = Math.min(s.x, c.x);
        const y1 = Math.min(s.y, c.y);
        const x2 = Math.max(s.x, c.x);
        const y2 = Math.max(s.y, c.y);

        const ix1 = Math.round((x1 - layout.ox) / layout.scale);
        const iy1 = Math.round((y1 - layout.oy) / layout.scale);
        const ix2 = Math.round((x2 - layout.ox) / layout.scale);
        const iy2 = Math.round((y2 - layout.oy) / layout.scale);

        const sx = Math.max(0, Math.min(ix1, ix2));
        const sy = Math.max(0, Math.min(iy1, iy2));
        const sw = Math.min(layout.nw - sx, Math.abs(ix2 - ix1));
        const sh = Math.min(layout.nh - sy, Math.abs(iy2 - iy1));

        if (sw < 4 || sh < 4) return null;
        return { sx, sy, sw, sh };
    }, [start, current]);

    const commitCrop = useCallback(async () => {
        const rect = clientToImageRect();
        const src = imageDataUrl;
        if (!rect || !src) return;

        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Image load failed'));
            img.src = src;
        });

        const canvas = document.createElement('canvas');
        canvas.width = rect.sw;
        canvas.height = rect.sh;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, rect.sw, rect.sh);
        const cropped = canvas.toDataURL('image/png');
        await window.electronAPI?.sendCapturedRegion(cropped);
    }, [clientToImageRect, imageDataUrl]);

    const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        const apply = () => {
            const rect = img.getBoundingClientRect();
            const nw = img.naturalWidth;
            const nh = img.naturalHeight;
            if (nw <= 0 || nh <= 0) return;
            layoutRef.current = {
                ox: rect.left,
                oy: rect.top,
                scale: rect.width / nw,
                nw,
                nh,
            };
        };
        requestAnimationFrame(apply);
    };

    const overlayMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        setDragging(true);
        setStart({ x: e.clientX, y: e.clientY });
        setCurrent({ x: e.clientX, y: e.clientY });
    };

    const overlayMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!dragging) return;
        setCurrent({ x: e.clientX, y: e.clientY });
    };

    const overlayMouseUp = async () => {
        if (finishingRef.current || !dragging) return;
        finishingRef.current = true;
        setDragging(false);
        try {
            await commitCrop();
        } catch {
            setError('Could not crop selection.');
        } finally {
            finishingRef.current = false;
        }
        setStart(null);
        setCurrent(null);
    };

    const selectionStyle = (): React.CSSProperties | undefined => {
        if (!start || !current) return undefined;
        const left = Math.min(start.x, current.x);
        const top = Math.min(start.y, current.y);
        const width = Math.abs(current.x - start.x);
        const height = Math.abs(current.y - start.y);
        return {
            position: 'fixed',
            left,
            top,
            width,
            height,
            border: '2px solid rgba(56, 189, 248, 0.95)',
            backgroundColor: 'rgba(56, 189, 248, 0.12)',
            pointerEvents: 'none',
            zIndex: 20,
            boxSizing: 'border-box',
        };
    };

    if (error) {
        return (
            <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/95 text-slate-200 p-8">
                <p className="text-center max-w-md">{error}</p>
                <button type="button" className="btn-primary" onClick={close}>
                    Close
                </button>
            </div>
        );
    }

    if (!imageDataUrl) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-slate-950 text-slate-400">
                <p>Preparing capture…</p>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black overflow-hidden">
            <img
                src={imageDataUrl}
                alt="Screen"
                className="absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 select-none"
                style={{
                    maxWidth: '100vw',
                    maxHeight: '100vh',
                    width: 'auto',
                    height: 'auto',
                }}
                onLoad={onImageLoad}
                draggable={false}
            />
            <div
                className="absolute inset-0 z-10 cursor-crosshair"
                style={{ background: 'rgba(0,0,0,0.25)' }}
                onMouseDown={overlayMouseDown}
                onMouseMove={overlayMouseMove}
                onMouseUp={overlayMouseUp}
                onMouseLeave={overlayMouseUp}
            />
            {selectionStyle() && <div style={selectionStyle()} />}
            <div className="fixed bottom-6 left-0 right-0 z-30 flex justify-center gap-3 pointer-events-auto">
                <button type="button" className="btn-secondary" onClick={close}>
                    Cancel (Esc)
                </button>
            </div>
            <p className="fixed top-4 left-0 right-0 z-30 text-center text-sm text-slate-200 drop-shadow pointer-events-none">
                Drag to select a region. Release to capture.
            </p>
        </div>
    );
};

export default CaptureRegionView;
