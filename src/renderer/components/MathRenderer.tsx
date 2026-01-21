import React, { useMemo } from 'react';
import katex from 'katex';

interface MathRendererProps {
    content: string;
    displayMode?: boolean;
}

const MathRenderer: React.FC<MathRendererProps> = ({ content, displayMode = false }) => {
    const renderedContent = useMemo(() => {
        // Split content by math delimiters and render math parts
        // Supports: $...$ for inline, $$...$$ for display
        const parts: React.ReactNode[] = [];
        let key = 0;

        // First, handle display math ($$...$$)
        const displayMathRegex = /\$\$([\s\S]*?)\$\$/g;
        let lastIndex = 0;
        let match;

        let processedContent = content;

        // Temporarily replace display math
        const displayMaths: string[] = [];
        processedContent = content.replace(displayMathRegex, (m, math) => {
            displayMaths.push(math);
            return `%%DISPLAY_MATH_${displayMaths.length - 1}%%`;
        });

        // Now handle inline math ($...$)
        const inlineMathRegex = /\$(.*?)\$/g;
        const inlineMaths: string[] = [];
        processedContent = processedContent.replace(inlineMathRegex, (m, math) => {
            inlineMaths.push(math);
            return `%%INLINE_MATH_${inlineMaths.length - 1}%%`;
        });

        // Split by placeholders and render
        const segments = processedContent.split(/(%%(?:DISPLAY|INLINE)_MATH_\d+%%)/);

        for (const segment of segments) {
            const displayMatch = segment.match(/%%DISPLAY_MATH_(\d+)%%/);
            const inlineMatch = segment.match(/%%INLINE_MATH_(\d+)%%/);

            if (displayMatch) {
                const index = parseInt(displayMatch[1]);
                const math = displayMaths[index];
                try {
                    const html = katex.renderToString(math, {
                        displayMode: true,
                        throwOnError: false,
                        trust: true,
                    });
                    parts.push(
                        <div
                            key={key++}
                            className="my-2"
                            dangerouslySetInnerHTML={{ __html: html }}
                        />
                    );
                } catch {
                    parts.push(<span key={key++} className="text-red-400">{`$$${math}$$`}</span>);
                }
            } else if (inlineMatch) {
                const index = parseInt(inlineMatch[1]);
                const math = inlineMaths[index];
                try {
                    const html = katex.renderToString(math, {
                        displayMode: false,
                        throwOnError: false,
                        trust: true,
                    });
                    parts.push(
                        <span
                            key={key++}
                            dangerouslySetInnerHTML={{ __html: html }}
                        />
                    );
                } catch {
                    parts.push(<span key={key++} className="text-red-400">{`$${math}$`}</span>);
                }
            } else if (segment) {
                // Plain text - handle subscripts and special formatting
                const formatted = formatSpecialNotation(segment);
                parts.push(<span key={key++}>{formatted}</span>);
            }
        }

        return parts;
    }, [content]);

    return <div className="math-content leading-relaxed">{renderedContent}</div>;
};

// Helper to format common notation patterns
function formatSpecialNotation(text: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    let key = 0;

    // Pattern for subscript notation like v₀, x₁, etc.
    const subscriptMap: Record<string, string> = {
        '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
        '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
    };

    // Pattern for superscript (exponents)
    const superscriptMap: Record<string, string> = {
        '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
        '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
        'n': 'ⁿ',
    };

    // Highlight equations and formulas
    const segments = text.split(/(\b[a-zA-Z]\s*=\s*[^,.\n]+)/g);

    for (const segment of segments) {
        if (/\b[a-zA-Z]\s*=\s*[^,.\n]+/.test(segment)) {
            parts.push(
                <span key={key++} className="font-mono text-opal-300">{segment}</span>
            );
        } else {
            parts.push(segment);
        }
    }

    return parts;
}

export default MathRenderer;
