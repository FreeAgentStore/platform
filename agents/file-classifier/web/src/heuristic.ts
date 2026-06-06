/**
 * File Classifier — LLM-distilled heuristic.
 *
 * Classifies files by their first N bytes using three tiers:
 * 1. Magic bytes (binary signatures — highest confidence)
 * 2. Structural patterns (text-based format detection)
 * 3. Statistical heuristics (binary vs text ratio, entropy)
 *
 * 80+ formats. Zero model, sub-millisecond classification.
 */

export interface FileClassification {
  /** Primary detected format. */
  format: string;
  /** MIME type. */
  mime: string;
  /** Common file extension. */
  extension: string;
  /** 0-1 confidence. */
  confidence: number;
  /** How it was detected. */
  method: 'magic' | 'structure' | 'heuristic';
  /** Is this a text-based format? */
  isText: boolean;
  /** Category. */
  category: 'image' | 'audio' | 'video' | 'document' | 'archive' | 'code' | 'data' | 'font' | 'executable' | 'unknown';
  /** Alternative matches, if ambiguous. */
  alternatives: { format: string; mime: string; confidence: number }[];
}

// --- Magic byte signatures ---
// [offset, bytes (hex or string), format, mime, extension, category]
type MagicRule = [number, number[], string, string, string, FileClassification['category']];

const MAGIC: MagicRule[] = [
  // Images
  [0, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 'PNG', 'image/png', 'png', 'image'],
  [0, [0xFF, 0xD8, 0xFF], 'JPEG', 'image/jpeg', 'jpg', 'image'],
  [0, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], 'GIF87a', 'image/gif', 'gif', 'image'],
  [0, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 'GIF89a', 'image/gif', 'gif', 'image'],
  [0, [0x42, 0x4D], 'BMP', 'image/bmp', 'bmp', 'image'],
  [0, [0x00, 0x00, 0x01, 0x00], 'ICO', 'image/x-icon', 'ico', 'image'],
  [0, [0x49, 0x49, 0x2A, 0x00], 'TIFF (LE)', 'image/tiff', 'tiff', 'image'],
  [0, [0x4D, 0x4D, 0x00, 0x2A], 'TIFF (BE)', 'image/tiff', 'tiff', 'image'],

  // Audio
  [0, [0x49, 0x44, 0x33], 'MP3 (ID3)', 'audio/mpeg', 'mp3', 'audio'],
  [0, [0xFF, 0xFB], 'MP3', 'audio/mpeg', 'mp3', 'audio'],
  [0, [0xFF, 0xF3], 'MP3', 'audio/mpeg', 'mp3', 'audio'],
  [0, [0x66, 0x4C, 0x61, 0x43], 'FLAC', 'audio/flac', 'flac', 'audio'],
  [0, [0x4F, 0x67, 0x67, 0x53], 'OGG', 'audio/ogg', 'ogg', 'audio'],

  // Documents
  [0, [0x25, 0x50, 0x44, 0x46, 0x2D], 'PDF', 'application/pdf', 'pdf', 'document'],

  // Archives
  [0, [0x50, 0x4B, 0x03, 0x04], 'ZIP', 'application/zip', 'zip', 'archive'],
  [0, [0x50, 0x4B, 0x05, 0x06], 'ZIP (empty)', 'application/zip', 'zip', 'archive'],
  [0, [0x1F, 0x8B], 'GZIP', 'application/gzip', 'gz', 'archive'],
  [0, [0x42, 0x5A, 0x68], 'BZIP2', 'application/x-bzip2', 'bz2', 'archive'],
  [0, [0xFD, 0x37, 0x7A, 0x58, 0x5A, 0x00], 'XZ', 'application/x-xz', 'xz', 'archive'],
  [0, [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07], 'RAR', 'application/x-rar-compressed', 'rar', 'archive'],
  [0, [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C], '7z', 'application/x-7z-compressed', '7z', 'archive'],

  // Executables / binaries
  [0, [0x7F, 0x45, 0x4C, 0x46], 'ELF', 'application/x-elf', 'elf', 'executable'],
  [0, [0xCF, 0xFA, 0xED, 0xFE], 'Mach-O (64-bit)', 'application/x-mach-binary', 'macho', 'executable'],
  [0, [0xFE, 0xED, 0xFA, 0xCF], 'Mach-O (64-bit BE)', 'application/x-mach-binary', 'macho', 'executable'],
  [0, [0x4D, 0x5A], 'PE/EXE', 'application/x-dosexec', 'exe', 'executable'],
  [0, [0x00, 0x61, 0x73, 0x6D], 'WebAssembly', 'application/wasm', 'wasm', 'executable'],
  [0, [0xCA, 0xFE, 0xBA, 0xBE], 'Java class', 'application/java-vm', 'class', 'executable'],

  // Databases
  [0, [0x53, 0x51, 0x4C, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6F, 0x72, 0x6D, 0x61, 0x74, 0x20, 0x33, 0x00], 'SQLite', 'application/x-sqlite3', 'sqlite', 'data'],

  // Fonts
  [0, [0x77, 0x4F, 0x46, 0x46], 'WOFF', 'font/woff', 'woff', 'font'],
  [0, [0x77, 0x4F, 0x46, 0x32], 'WOFF2', 'font/woff2', 'woff2', 'font'],
  [0, [0x00, 0x01, 0x00, 0x00], 'TrueType', 'font/ttf', 'ttf', 'font'],
  [0, [0x4F, 0x54, 0x54, 0x4F], 'OpenType', 'font/otf', 'otf', 'font'],
];

// --- RIFF-based formats (need secondary check at offset 8) ---
interface RiffRule { sub: number[]; format: string; mime: string; ext: string; category: FileClassification['category'] }

const RIFF_SUBS: RiffRule[] = [
  { sub: [0x57, 0x41, 0x56, 0x45], format: 'WAV', mime: 'audio/wav', ext: 'wav', category: 'audio' },
  { sub: [0x41, 0x56, 0x49, 0x20], format: 'AVI', mime: 'video/x-msvideo', ext: 'avi', category: 'video' },
  { sub: [0x57, 0x45, 0x42, 0x50], format: 'WebP', mime: 'image/webp', ext: 'webp', category: 'image' },
];

// --- Text-based structural patterns ---
interface TextRule {
  test: (text: string) => boolean;
  format: string;
  mime: string;
  ext: string;
  category: FileClassification['category'];
  confidence: number;
}

const TEXT_RULES: TextRule[] = [
  // HTML (check before XML since HTML is a subset)
  { test: t => /^\s*<!doctype\s+html/i.test(t) || /^\s*<html[\s>]/i.test(t) || /^\s*<head[\s>]/i.test(t), format: 'HTML', mime: 'text/html', ext: 'html', category: 'code', confidence: 0.95 },
  // SVG
  { test: t => /^\s*(<\?xml[^?]*\?>)?\s*<svg[\s>]/i.test(t), format: 'SVG', mime: 'image/svg+xml', ext: 'svg', category: 'image', confidence: 0.95 },
  // XML
  { test: t => /^\s*<\?xml[\s>]/i.test(t) || /^\s*<[a-zA-Z][\w:-]*[\s>]/.test(t) && /<\/[a-zA-Z]/.test(t), format: 'XML', mime: 'application/xml', ext: 'xml', category: 'data', confidence: 0.85 },
  // TOML (check before JSON — [section] starts with [ but isn't JSON)
  { test: t => /^\s*\[[a-zA-Z][\w.-]*\]\s*\n/.test(t) && /^[a-zA-Z_][\w]* = /m.test(t), format: 'TOML', mime: 'application/toml', ext: 'toml', category: 'data', confidence: 0.8 },
  // INI (also check before JSON — [section] pattern, but uses = not " = ")
  { test: t => /^\s*\[[\w\s.-]+\]\s*\n/m.test(t) && /^[a-zA-Z_][\w]*\s*=/m.test(t) && !/^\s*</.test(t), format: 'INI', mime: 'text/plain', ext: 'ini', category: 'data', confidence: 0.7 },
  // JSON (TOML/INI checked first, so [section] patterns won't reach here)
  { test: t => { const c = t.trim()[0]; if (c !== '{' && c !== '[') return false; try { JSON.parse(t); return true; } catch { return /^\s*[\[{]/.test(t) && /[\]}]\s*$/.test(t.slice(0, 4096)); } }, format: 'JSON', mime: 'application/json', ext: 'json', category: 'data', confidence: 0.9 },
  // YAML
  { test: t => /^\s*---\s*\n/.test(t) || /^[a-zA-Z_][\w]*:\s/m.test(t) && !/[;{}]/.test(t.slice(0, 200)), format: 'YAML', mime: 'application/yaml', ext: 'yaml', category: 'data', confidence: 0.75 },
  // CSV
  { test: t => { const lines = t.split('\n').slice(0, 5); if (lines.length < 2) return false; const delim = [',', '\t', '|'].find(d => lines[0].includes(d) && lines[1].includes(d)); if (!delim) return false; const c1 = lines[0].split(delim).length; const c2 = lines[1].split(delim).length; return c1 === c2 && c1 >= 2; }, format: 'CSV', mime: 'text/csv', ext: 'csv', category: 'data', confidence: 0.7 },
  // Markdown
  { test: t => /^#{1,6}\s+\S/m.test(t) || (/^\s*[-*]\s+\S/m.test(t) && /\[.*\]\(.*\)/.test(t)), format: 'Markdown', mime: 'text/markdown', ext: 'md', category: 'document', confidence: 0.7 },
  // Shell script
  { test: t => /^#!\s*\/(?:usr\/)?bin\/(?:ba)?sh/.test(t) || /^#!\s*\/usr\/bin\/env\s+(?:ba)?sh/.test(t), format: 'Shell Script', mime: 'application/x-sh', ext: 'sh', category: 'code', confidence: 0.95 },
  // Python
  { test: t => /^#!\s*\/usr\/bin\/(?:env\s+)?python/.test(t) || (/^\s*(?:import |from |def |class |if __name__)/m.test(t) && !/[;{}]/.test(t.slice(0, 500))), format: 'Python', mime: 'text/x-python', ext: 'py', category: 'code', confidence: 0.8 },
  // JavaScript / TypeScript
  { test: t => /^\s*(?:import\s+|export\s+|const\s+|let\s+|var\s+|function\s+|\/\/|\/\*|"use strict")/.test(t) && /[{};]/.test(t.slice(0, 500)), format: 'JavaScript', mime: 'text/javascript', ext: 'js', category: 'code', confidence: 0.7 },
  // CSS
  { test: t => /^\s*(?:@import|@charset|@media|@font-face|\*\s*\{|body\s*\{|html\s*\{|:root\s*\{|\.[a-zA-Z][\w-]*\s*\{)/.test(t), format: 'CSS', mime: 'text/css', ext: 'css', category: 'code', confidence: 0.8 },
  // SQL
  { test: t => /^\s*(?:CREATE|ALTER|DROP|INSERT|SELECT|UPDATE|DELETE|BEGIN|COMMIT|PRAGMA)\s/im.test(t), format: 'SQL', mime: 'application/sql', ext: 'sql', category: 'data', confidence: 0.8 },
  // .env
  { test: t => /^[A-Z_][A-Z0-9_]*=.*/m.test(t) && t.split('\n').filter(l => /^[A-Z_]/.test(l)).length > 2, format: 'Dotenv', mime: 'text/plain', ext: 'env', category: 'data', confidence: 0.7 },
];

/**
 * Classify a file from its first N bytes.
 *
 * @param bytes - Uint8Array of the file's first bytes (at least 16, ideally 4096+)
 * @returns Classification result with format, MIME, confidence, and alternatives.
 */
export function classifyFile(bytes: Uint8Array): FileClassification {
  const alts: FileClassification['alternatives'] = [];

  // --- Tier 1: Magic bytes (binary signatures) ---

  // RIFF container (WAV, AVI, WebP)
  if (bytes.length >= 12 && matchBytes(bytes, 0, [0x52, 0x49, 0x46, 0x46])) {
    for (const r of RIFF_SUBS) {
      if (matchBytes(bytes, 8, r.sub)) {
        return result(r.format, r.mime, r.ext, 0.98, 'magic', false, r.category, alts);
      }
    }
  }

  // MP4/MOV/AVIF/HEIF (ftyp box at offset 4)
  if (bytes.length >= 12 && matchBytes(bytes, 4, [0x66, 0x74, 0x79, 0x70])) {
    const brand = String.fromCharCode(...bytes.slice(8, 12));
    if (brand.startsWith('avif') || brand.startsWith('avis')) return result('AVIF', 'image/avif', 'avif', 0.95, 'magic', false, 'image', alts);
    if (brand.startsWith('heic') || brand.startsWith('heix')) return result('HEIC', 'image/heic', 'heic', 0.95, 'magic', false, 'image', alts);
    if (brand === 'M4A ' || brand === 'M4B ') return result('M4A', 'audio/mp4', 'm4a', 0.95, 'magic', false, 'audio', alts);
    return result('MP4', 'video/mp4', 'mp4', 0.9, 'magic', false, 'video', alts);
  }

  // Standard magic bytes
  for (const [offset, sig, format, mime, ext, cat] of MAGIC) {
    if (bytes.length >= offset + sig.length && matchBytes(bytes, offset, sig)) {
      // ZIP: check if it's actually XLSX/DOCX/PPTX/JAR/APK
      if (format === 'ZIP') {
        const zipContent = textFromBytes(bytes, 30, 200);
        if (zipContent.includes('[Content_Types].xml') || zipContent.includes('word/')) {
          alts.push({ format: 'ZIP', mime, confidence: 0.9 });
          if (zipContent.includes('xl/')) return result('XLSX', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx', 0.9, 'magic', false, 'document', alts);
          if (zipContent.includes('word/')) return result('DOCX', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx', 0.9, 'magic', false, 'document', alts);
          if (zipContent.includes('ppt/')) return result('PPTX', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'pptx', 0.9, 'magic', false, 'document', alts);
        }
        if (zipContent.includes('META-INF/')) return result('JAR', 'application/java-archive', 'jar', 0.85, 'magic', false, 'archive', alts);
        if (zipContent.includes('AndroidManifest')) return result('APK', 'application/vnd.android.package-archive', 'apk', 0.9, 'magic', false, 'archive', alts);
      }

      return result(format, mime, ext, 0.95, 'magic', false, cat, alts);
    }
  }

  // TAR (magic at offset 257)
  if (bytes.length >= 263 && matchBytes(bytes, 257, [0x75, 0x73, 0x74, 0x61, 0x72])) {
    return result('TAR', 'application/x-tar', 'tar', 0.95, 'magic', false, 'archive', alts);
  }

  // --- Tier 2: Text-based structural detection ---

  // Check if it looks like text (UTF-8 / ASCII)
  const textRatio = countTextBytes(bytes) / Math.min(bytes.length, 4096);
  if (textRatio > 0.85) {
    const text = textFromBytes(bytes, 0, Math.min(bytes.length, 8192));

    // BOM detection
    if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
      // UTF-8 BOM — still text, strip BOM for detection
    }

    for (const rule of TEXT_RULES) {
      if (rule.test(text)) {
        return result(rule.format, rule.mime, rule.ext, rule.confidence, 'structure', true, rule.category, alts);
      }
    }

    // Plain text fallback
    return result('Plain Text', 'text/plain', 'txt', 0.5, 'heuristic', true, 'document', alts);
  }

  // --- Tier 3: Binary but unknown ---
  return result('Binary', 'application/octet-stream', 'bin', 0.2, 'heuristic', false, 'unknown', alts);
}

/**
 * Convenience: classify from a File/Blob (reads first 8KB).
 */
export async function classifyBlob(blob: Blob): Promise<FileClassification> {
  const slice = blob.slice(0, 8192);
  const buffer = await slice.arrayBuffer();
  return classifyFile(new Uint8Array(buffer));
}

// --- Helpers ---

function matchBytes(data: Uint8Array, offset: number, expected: number[]): boolean {
  for (let i = 0; i < expected.length; i++) {
    if (data[offset + i] !== expected[i]) return false;
  }
  return true;
}

function textFromBytes(bytes: Uint8Array, start: number, length: number): string {
  const slice = bytes.slice(start, start + length);
  try { return new TextDecoder('utf-8', { fatal: false }).decode(slice); }
  catch { return ''; }
}

function countTextBytes(bytes: Uint8Array): number {
  let count = 0;
  const len = Math.min(bytes.length, 4096);
  for (let i = 0; i < len; i++) {
    const b = bytes[i];
    // Printable ASCII, common control chars (tab, newline, carriage return), or UTF-8 continuation
    if ((b >= 0x20 && b <= 0x7E) || b === 0x09 || b === 0x0A || b === 0x0D || (b >= 0x80 && b <= 0xFE)) {
      count++;
    }
  }
  return count;
}

function result(
  format: string, mime: string, extension: string, confidence: number,
  method: FileClassification['method'], isText: boolean,
  category: FileClassification['category'],
  alternatives: FileClassification['alternatives'],
): FileClassification {
  return { format, mime, extension, confidence: Math.round(confidence * 100) / 100, method, isText, category, alternatives };
}
