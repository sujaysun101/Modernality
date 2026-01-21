import Tesseract from 'tesseract.js';

export interface OCRResult {
    text: string;
    confidence: number;
    blocks: Array<{
        text: string;
        confidence: number;
        bbox: { x0: number; y0: number; x1: number; y1: number };
    }>;
}

// Initialize worker for better performance
let worker: Tesseract.Worker | null = null;

async function getWorker(): Promise<Tesseract.Worker> {
    if (!worker) {
        worker = await Tesseract.createWorker('eng', 1, {
            logger: (m) => {
                if (m.status === 'recognizing text') {
                    console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
                }
            },
        });
    }
    return worker;
}

// Preprocess image for better OCR results
async function preprocessImage(imageData: string): Promise<string> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                resolve(imageData);
                return;
            }

            // Set canvas size
            canvas.width = img.width;
            canvas.height = img.height;

            // Draw image
            ctx.drawImage(img, 0, 0);

            // Get image data for processing
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;

            // Convert to grayscale and increase contrast
            for (let i = 0; i < data.length; i += 4) {
                // Grayscale conversion
                const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

                // Increase contrast
                const contrast = 1.5;
                const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
                const newGray = factor * (gray - 128) + 128;

                // Apply threshold for better text recognition
                const threshold = newGray > 128 ? 255 : 0;

                data[i] = threshold;     // R
                data[i + 1] = threshold; // G
                data[i + 2] = threshold; // B
                // Alpha remains unchanged
            }

            ctx.putImageData(imgData, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };

        img.onerror = () => resolve(imageData);
        img.src = imageData;
    });
}

// Main OCR function
export async function extractTextFromImage(
    imageData: string,
    options: {
        preprocess?: boolean;
        language?: string;
    } = {}
): Promise<OCRResult> {
    const { preprocess = true } = options;

    try {
        // Preprocess image if requested
        const processedImage = preprocess
            ? await preprocessImage(imageData)
            : imageData;

        const worker = await getWorker();
        const result = await worker.recognize(processedImage);

        return {
            text: result.data.text,
            confidence: result.data.confidence,
            blocks: result.data.blocks?.map(block => ({
                text: block.text,
                confidence: block.confidence,
                bbox: block.bbox,
            })) || [],
        };
    } catch (error) {
        console.error('OCR Error:', error);
        throw new Error('Failed to extract text from image');
    }
}

// Detect if image contains mathematical content
export async function detectMathContent(text: string): Promise<{
    hasMath: boolean;
    equations: string[];
    variables: string[];
}> {
    const mathPatterns = {
        // Common math symbols
        symbols: /[=+\-*/^√∫∑∏∂∇≈≠≤≥±]/g,
        // Variables (single letters optionally with subscripts)
        variables: /\b([a-zA-Z])\s*[₀₁₂₃₄₅₆₇₈₉]?\b/g,
        // Numbers with units
        withUnits: /\d+\.?\d*\s*(m|s|kg|N|J|W|Hz|A|V|Ω|°C|K|mol|g|cm|km|mph|ft|lb)/gi,
        // Fractions
        fractions: /\d+\/\d+/g,
        // Exponents
        exponents: /\^[\d\-\+]+|\²|³/g,
        // Equations
        equations: /[a-zA-Z]\s*=\s*[^,.\n]+/g,
    };

    const symbolMatches = text.match(mathPatterns.symbols) || [];
    const variableMatches = text.match(mathPatterns.variables) || [];
    const equationMatches = text.match(mathPatterns.equations) || [];

    return {
        hasMath: symbolMatches.length > 0 || equationMatches.length > 0,
        equations: [...new Set(equationMatches)],
        variables: [...new Set(variableMatches.map(v => v.trim()))],
    };
}

// Detect problem type based on content
export async function detectProblemType(text: string): Promise<{
    subject: 'math' | 'physics' | 'chemistry' | 'other';
    topic?: string;
    confidence: number;
}> {
    const lowerText = text.toLowerCase();

    // Physics keywords
    const physicsKeywords = [
        'velocity', 'acceleration', 'force', 'mass', 'energy', 'momentum',
        'gravity', 'friction', 'newton', 'm/s', 'kg', 'joule', 'watt',
        'electric', 'magnetic', 'circuit', 'voltage', 'current', 'resistance',
        'wave', 'frequency', 'wavelength', 'speed of light'
    ];

    // Chemistry keywords
    const chemistryKeywords = [
        'mol', 'molar', 'reaction', 'element', 'compound', 'atom', 'molecule',
        'bond', 'solution', 'concentration', 'ph', 'acid', 'base', 'oxidation',
        'reduction', 'equilibrium', 'stoichiometry'
    ];

    // Math keywords
    const mathKeywords = [
        'equation', 'solve', 'derivative', 'integral', 'function', 'graph',
        'polynomial', 'factor', 'simplify', 'calculate', 'evaluate',
        'limit', 'sum', 'product', 'matrix', 'vector', 'probability'
    ];

    let physicsScore = 0;
    let chemistryScore = 0;
    let mathScore = 0;

    for (const keyword of physicsKeywords) {
        if (lowerText.includes(keyword)) physicsScore++;
    }

    for (const keyword of chemistryKeywords) {
        if (lowerText.includes(keyword)) chemistryScore++;
    }

    for (const keyword of mathKeywords) {
        if (lowerText.includes(keyword)) mathScore++;
    }

    const maxScore = Math.max(physicsScore, chemistryScore, mathScore);

    if (maxScore === 0) {
        // Default to math if no specific keywords found
        return { subject: 'math', confidence: 0.3 };
    }

    if (physicsScore === maxScore) {
        return {
            subject: 'physics',
            topic: detectPhysicsTopic(lowerText),
            confidence: physicsScore / physicsKeywords.length
        };
    }

    if (chemistryScore === maxScore) {
        return {
            subject: 'chemistry',
            topic: detectChemistryTopic(lowerText),
            confidence: chemistryScore / chemistryKeywords.length
        };
    }

    return {
        subject: 'math',
        topic: detectMathTopic(lowerText),
        confidence: mathScore / mathKeywords.length
    };
}

function detectPhysicsTopic(text: string): string | undefined {
    if (text.includes('velocity') || text.includes('acceleration') || text.includes('motion')) {
        return 'kinematics';
    }
    if (text.includes('force') || text.includes('newton')) {
        return 'dynamics';
    }
    if (text.includes('energy') || text.includes('work') || text.includes('power')) {
        return 'energy';
    }
    if (text.includes('circuit') || text.includes('voltage') || text.includes('current')) {
        return 'electricity';
    }
    return undefined;
}

function detectChemistryTopic(text: string): string | undefined {
    if (text.includes('stoichiometry') || text.includes('mol') || text.includes('balanced')) {
        return 'stoichiometry';
    }
    if (text.includes('acid') || text.includes('base') || text.includes('ph')) {
        return 'acids-bases';
    }
    if (text.includes('bond') || text.includes('structure')) {
        return 'bonding';
    }
    return undefined;
}

function detectMathTopic(text: string): string | undefined {
    if (text.includes('derivative') || text.includes('differentiate')) {
        return 'calculus-derivatives';
    }
    if (text.includes('integral') || text.includes('integrate')) {
        return 'calculus-integrals';
    }
    if (text.includes('equation') || text.includes('solve for')) {
        return 'algebra';
    }
    if (text.includes('triangle') || text.includes('circle') || text.includes('angle')) {
        return 'geometry';
    }
    return undefined;
}

// Cleanup function
export async function terminateOCR(): Promise<void> {
    if (worker) {
        await worker.terminate();
        worker = null;
    }
}
