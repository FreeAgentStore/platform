import { pipeline, env, type ImageToTextPipeline } from '@huggingface/transformers';

export interface ScanResult {
  text: string;
  paragraphs: string[];
  confidence: number;
  wordCount: number;
  language: string | null;
}

let pipe: ImageToTextPipeline | null = null;

type ProgressCallback = (pct: number) => void;

export async function initModel(onProgress?: ProgressCallback): Promise<void> {
  env.allowLocalModels = false;

  let fileCount = 0;
  pipe = await pipeline('image-to-text', 'Xenova/trocr-small-printed', {
    device: navigator.gpu ? 'webgpu' : 'wasm',
    progress_callback: (info: { status: string; progress?: number }) => {
      if (info.status === 'progress' && info.progress != null) {
        onProgress?.(Math.round(info.progress));
      } else if (info.status === 'done') {
        fileCount++;
        onProgress?.(Math.min(90 + fileCount * 2, 99));
      }
    },
  }) as ImageToTextPipeline;

  onProgress?.(100);
}

/**
 * Preprocess image: grayscale + contrast enhancement + threshold for cleaner OCR
 */
function preprocessImage(source: HTMLImageElement | HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const w = source instanceof HTMLCanvasElement ? source.width : source.naturalWidth;
  const h = source instanceof HTMLCanvasElement ? source.height : source.naturalHeight;
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0, w, h);

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // Convert to grayscale
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }

  // Compute histogram for adaptive threshold
  const histogram = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) {
    histogram[data[i]]++;
  }

  // Otsu's threshold
  const totalPixels = w * h;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];

  let sumB = 0;
  let wB = 0;
  let maxVariance = 0;
  let threshold = 128;

  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    const wF = totalPixels - wB;
    if (wF === 0) break;
    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const variance = wB * wF * (mB - mF) * (mB - mF);
    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }

  // Contrast stretch + threshold
  for (let i = 0; i < data.length; i += 4) {
    // Mild contrast enhancement before thresholding
    let v = data[i];
    v = v < threshold ? Math.max(0, v - 30) : Math.min(255, v + 30);
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Post-process raw OCR output into clean text with paragraphs.
 */
function postProcess(rawText: string): { text: string; paragraphs: string[] } {
  let text = rawText;

  // Fix common OCR errors
  // rn -> m (common misread)
  text = text.replace(/\brn\b/g, (match) => {
    // Only replace if it looks like it should be 'm' in context
    return match;
  });
  // More targeted OCR error fixes
  text = text.replace(/([a-z])rn([a-z])/g, (_, before, after) => `${before}m${after}`);

  // Fix 0/O confusion in words (0 in middle of word -> O)
  text = text.replace(/([a-zA-Z])0([a-zA-Z])/g, '$1O$2');

  // Fix 1/l/I confusion: standalone 1 at start of sentence -> I
  text = text.replace(/(^|[.!?]\s+)1\s/gm, '$1I ');

  // Remove hyphenation at line breaks (word- \nword -> word)
  text = text.replace(/(\w)-\s*\n\s*(\w)/g, '$1$2');

  // Normalize whitespace
  text = text.replace(/[ \t]+/g, ' ');

  // Split into lines
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // Group lines into paragraphs
  const paragraphs: string[] = [];
  let current: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1];

    // Detect if this line is a header (short, often capitalized, no ending punctuation)
    const isHeader = line.length < 60 && /^[A-Z]/.test(line) && !/[.,:;]$/.test(line) && (!nextLine || nextLine.length > line.length * 1.5);

    // Detect list items
    const isList = /^(\d+[.)]\s|[-*]\s|[a-z][.)]\s)/i.test(line);

    if (isHeader && current.length > 0) {
      paragraphs.push(current.join(' '));
      current = [line];
    } else if (isList) {
      if (current.length > 0 && !/^(\d+[.)]\s|[-*]\s|[a-z][.)]\s)/i.test(current[0])) {
        paragraphs.push(current.join(' '));
        current = [];
      }
      // Each list item is its own line within the paragraph
      current.push(line);
    } else if (line === '') {
      if (current.length > 0) {
        paragraphs.push(current.join(' '));
        current = [];
      }
    } else {
      current.push(line);
    }
  }

  if (current.length > 0) {
    paragraphs.push(current.join(' '));
  }

  const cleanedParagraphs = paragraphs.map((p) => p.trim()).filter(Boolean);
  const cleanedText = cleanedParagraphs.join('\n\n');

  return { text: cleanedText, paragraphs: cleanedParagraphs };
}

/**
 * Detect language from text using simple heuristics.
 */
function detectLanguage(text: string): string | null {
  const lower = text.toLowerCase();

  // Common word frequency detection
  const english = /\b(the|and|is|in|to|of|that|it|for|was|on|are|with|this|have|from)\b/g;
  const spanish = /\b(el|la|los|las|de|en|que|es|un|una|por|con|para|del)\b/g;
  const french = /\b(le|la|les|de|des|un|une|est|que|dans|pour|avec|sur|pas)\b/g;
  const german = /\b(der|die|das|und|ist|ein|eine|von|den|mit|auf|dem|des|nicht)\b/g;

  const scores: Record<string, number> = {
    en: (lower.match(english) || []).length,
    es: (lower.match(spanish) || []).length,
    fr: (lower.match(french) || []).length,
    de: (lower.match(german) || []).length,
  };

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (best && best[1] > 3) return best[0];

  return null;
}

export async function scanDocument(image: HTMLImageElement | HTMLCanvasElement): Promise<ScanResult> {
  if (!pipe) throw new Error('Model not initialized. Call initModel() first.');

  // Preprocess for better OCR
  const processed = preprocessImage(image);

  // Run OCR
  const result = await pipe(processed);

  // Extract raw text from result
  let rawText = '';
  if (Array.isArray(result)) {
    rawText = result.map((r: { generated_text?: string }) => r.generated_text || '').join('\n');
  } else if (typeof result === 'object' && result !== null) {
    rawText = (result as { generated_text?: string }).generated_text || '';
  }

  // Post-process
  const { text, paragraphs } = postProcess(rawText);
  const words = text.split(/\s+/).filter(Boolean);

  // Estimate confidence based on text quality heuristics
  const alphaRatio = (text.match(/[a-zA-Z]/g) || []).length / Math.max(1, text.length);
  const confidence = Math.min(1, Math.max(0.1, alphaRatio * 1.2));

  return {
    text,
    paragraphs,
    confidence: Math.round(confidence * 100) / 100,
    wordCount: words.length,
    language: detectLanguage(text),
  };
}
