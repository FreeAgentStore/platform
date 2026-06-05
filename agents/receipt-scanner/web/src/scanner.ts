import { pipeline, env, type ImageToTextPipeline } from '@huggingface/transformers';

export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
}

export interface ReceiptResult {
  merchant: string | null;
  date: string | null;
  items: ReceiptItem[];
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  currency: string;
  rawText: string;
  confidence: number;
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

/** Detect currency symbol from text. */
function detectCurrency(text: string): string {
  if (text.includes('\u00a3')) return '\u00a3';
  if (text.includes('\u20ac')) return '\u20ac';
  if (text.includes('\u00a5')) return '\u00a5';
  return '$';
}

/** Fix common OCR errors in price strings. */
function fixPriceOCR(s: string): string {
  return s
    .replace(/^S/g, '$')       // S -> $ at start
    .replace(/O/g, '0')        // O -> 0 in numbers
    .replace(/l/g, '1')        // l -> 1 in numbers
    .replace(/[^0-9.,]/g, ''); // strip non-numeric
}

/** Extract a dollar amount from a string. Returns null if none found. */
function extractAmount(s: string): number | null {
  // Match patterns like $12.34, 12.34, $1,234.56
  const m = s.match(/[\$\u00a3\u20ac\u00a5]?\s*([0-9]{1,3}(?:,?[0-9]{3})*(?:\.[0-9]{1,2})?)/);
  if (!m) return null;
  const cleaned = m[1].replace(/,/g, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

/** Try to parse a date from raw text. Returns the first match or null. */
function parseDate(text: string): string | null {
  const patterns = [
    // MM/DD/YYYY or MM-DD-YYYY
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
    // YYYY-MM-DD
    /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/,
    // DD Mon YYYY or Mon DD, YYYY
    /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i,
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})/i,
    // MM/DD/YY
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})(?!\d)/,
  ];

  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) return m[0];
  }
  return null;
}

/** Extract merchant name from the first few lines of receipt text. */
function parseMerchant(lines: string[]): string | null {
  // The merchant name is typically one of the first lines.
  // Look for a non-trivial line that isn't a date, address, or phone.
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Skip lines that look like dates, addresses, phone numbers
    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(line)) continue;
    if (/^\d{3}[\-\.\s]\d{3}[\-\.\s]\d{4}/.test(line)) continue;
    if (/^\d+\s+(N|S|E|W|North|South|East|West)?\s*\w+\s+(St|Ave|Blvd|Rd|Dr|Ln|Way|Ct)/i.test(line)) continue;
    // Reasonable merchant line: at least 2 chars
    if (line.length >= 2) return line;
  }
  return null;
}

/** Parse line items from receipt lines. */
function parseLineItems(lines: string[]): ReceiptItem[] {
  const items: ReceiptItem[] = [];
  const summaryKeywords = /^(subtotal|sub\s*total|tax|total|amount\s*due|balance|change|cash|credit|visa|mastercard|tip|gratuity|discount)\b/i;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Skip summary lines
    if (summaryKeywords.test(trimmed)) continue;

    // Try pattern: quantity x price  (e.g. "2 x $3.99" or "2x$3.99")
    const qtyMatch = trimmed.match(/^(.+?)\s+(\d+)\s*[xX]\s*[\$\u00a3\u20ac\u00a5]?\s*([0-9,.]+)\s*$/);
    if (qtyMatch) {
      const price = parseFloat(fixPriceOCR(qtyMatch[3]));
      if (!isNaN(price)) {
        items.push({ name: qtyMatch[1].trim(), quantity: parseInt(qtyMatch[2]), price });
        continue;
      }
    }

    // Try pattern: name ... price at end of line
    const priceAtEnd = trimmed.match(/^(.+?)\s{2,}[\$\u00a3\u20ac\u00a5]?\s*([0-9]{1,3}(?:,?[0-9]{3})*\.[0-9]{2})\s*$/);
    if (priceAtEnd) {
      const name = priceAtEnd[1].trim();
      const price = parseFloat(priceAtEnd[2].replace(/,/g, ''));
      if (!isNaN(price) && name.length >= 2) {
        items.push({ name, quantity: 1, price });
        continue;
      }
    }

    // Try pattern: name $X.XX (price preceded by dollar sign)
    const dollarMatch = trimmed.match(/^(.+?)\s+[\$\u00a3\u20ac\u00a5]([0-9]{1,3}(?:,?[0-9]{3})*\.[0-9]{2})\s*$/);
    if (dollarMatch) {
      const name = dollarMatch[1].trim();
      const price = parseFloat(dollarMatch[2].replace(/,/g, ''));
      if (!isNaN(price) && name.length >= 2) {
        items.push({ name, quantity: 1, price });
        continue;
      }
    }
  }

  return items;
}

/** Extract subtotal, tax, and total from receipt lines. */
function parseTotals(lines: string[]): { subtotal: number | null; tax: number | null; total: number | null } {
  let subtotal: number | null = null;
  let tax: number | null = null;
  let total: number | null = null;

  for (const line of lines) {
    const lower = line.toLowerCase().trim();

    if (/^sub\s*total/.test(lower)) {
      subtotal = extractAmount(line);
    } else if (/^tax/.test(lower) || /\bsales\s*tax\b/.test(lower) || /\bhst\b/.test(lower) || /\bgst\b/.test(lower) || /\bvat\b/.test(lower)) {
      tax = extractAmount(line);
    } else if (/^total\b/.test(lower) || /^amount\s*due/.test(lower) || /^balance\s*due/.test(lower) || /^grand\s*total/.test(lower)) {
      total = extractAmount(line);
    }
  }

  return { subtotal, tax, total };
}

export async function scanReceipt(image: HTMLImageElement | HTMLCanvasElement): Promise<ReceiptResult> {
  if (!pipe) throw new Error('Model not initialized. Call initModel() first.');

  // Preprocess: grayscale + contrast for cleaner OCR
  const canvas = document.createElement('canvas');
  const w = image instanceof HTMLCanvasElement ? image.width : image.naturalWidth;
  const h = image instanceof HTMLCanvasElement ? image.height : image.naturalHeight;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0, w, h);

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    // Increase contrast
    const v = gray < 128 ? Math.max(0, gray - 30) : Math.min(255, gray + 30);
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
  }
  ctx.putImageData(imageData, 0, 0);

  // Run OCR
  const result = await pipe(canvas);

  let rawText = '';
  if (Array.isArray(result)) {
    rawText = result.map((r: { generated_text?: string }) => r.generated_text || '').join('\n');
  } else if (typeof result === 'object' && result !== null) {
    rawText = (result as { generated_text?: string }).generated_text || '';
  }

  // Split into lines and clean up
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);

  // Parse receipt fields
  const merchant = parseMerchant(lines);
  const date = parseDate(rawText);
  const items = parseLineItems(lines);
  const { subtotal, tax, total } = parseTotals(lines);
  const currency = detectCurrency(rawText);

  // Confidence: how much structured data did we extract?
  let conf = 0.3; // base for getting any text
  if (merchant) conf += 0.15;
  if (date) conf += 0.1;
  if (items.length > 0) conf += 0.2;
  if (total != null) conf += 0.15;
  if (subtotal != null || tax != null) conf += 0.1;
  conf = Math.min(1, conf);

  return {
    merchant,
    date,
    items,
    subtotal,
    tax,
    total,
    currency,
    rawText,
    confidence: Math.round(conf * 100) / 100,
  };
}
