import { describe, it, expect } from 'vitest';
import { classifyFile } from './heuristic';

/** Helper: create Uint8Array from hex bytes + optional ASCII padding. */
function bytes(...hex: number[]): Uint8Array {
  return new Uint8Array(hex);
}

/** Helper: create Uint8Array from a string (text files). */
function text(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

/** Helper: pad bytes to a minimum length. */
function padded(data: number[], minLen: number): Uint8Array {
  const arr = new Uint8Array(minLen);
  arr.set(data);
  return arr;
}

describe('magic byte detection', () => {
  it('detects PNG', () => {
    const r = classifyFile(bytes(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0));
    expect(r.format).toBe('PNG');
    expect(r.mime).toBe('image/png');
    expect(r.extension).toBe('png');
    expect(r.method).toBe('magic');
    expect(r.isText).toBe(false);
    expect(r.category).toBe('image');
    expect(r.confidence).toBeGreaterThan(0.9);
  });

  it('detects JPEG', () => {
    const r = classifyFile(bytes(0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10));
    expect(r.format).toBe('JPEG');
    expect(r.mime).toBe('image/jpeg');
  });

  it('detects GIF89a', () => {
    const r = classifyFile(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0));
    expect(r.format).toBe('GIF89a');
    expect(r.mime).toBe('image/gif');
  });

  it('detects PDF', () => {
    const r = classifyFile(text('%PDF-1.7\n'));
    expect(r.format).toBe('PDF');
    expect(r.mime).toBe('application/pdf');
    expect(r.category).toBe('document');
  });

  it('detects ZIP', () => {
    const r = classifyFile(padded([0x50, 0x4B, 0x03, 0x04], 64));
    expect(r.format).toBe('ZIP');
    expect(r.mime).toBe('application/zip');
  });

  it('detects GZIP', () => {
    const r = classifyFile(bytes(0x1F, 0x8B, 0x08, 0x00));
    expect(r.format).toBe('GZIP');
    expect(r.mime).toBe('application/gzip');
  });

  it('detects RAR', () => {
    const r = classifyFile(bytes(0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x00));
    expect(r.format).toBe('RAR');
  });

  it('detects ELF', () => {
    const r = classifyFile(bytes(0x7F, 0x45, 0x4C, 0x46, 0x02, 0x01));
    expect(r.format).toBe('ELF');
    expect(r.category).toBe('executable');
  });

  it('detects WebAssembly', () => {
    const r = classifyFile(bytes(0x00, 0x61, 0x73, 0x6D, 0x01, 0x00, 0x00, 0x00));
    expect(r.format).toBe('WebAssembly');
    expect(r.mime).toBe('application/wasm');
  });

  it('detects PE/EXE', () => {
    const r = classifyFile(bytes(0x4D, 0x5A, 0x90, 0x00));
    expect(r.format).toBe('PE/EXE');
    expect(r.category).toBe('executable');
  });

  it('detects SQLite', () => {
    const r = classifyFile(text('SQLite format 3\x00'));
    expect(r.format).toBe('SQLite');
  });

  it('detects WOFF', () => {
    const r = classifyFile(bytes(0x77, 0x4F, 0x46, 0x46, 0, 0));
    expect(r.format).toBe('WOFF');
    expect(r.category).toBe('font');
  });

  it('detects WOFF2', () => {
    const r = classifyFile(bytes(0x77, 0x4F, 0x46, 0x32, 0, 0));
    expect(r.format).toBe('WOFF2');
  });

  it('detects MP3 (ID3 tag)', () => {
    const r = classifyFile(bytes(0x49, 0x44, 0x33, 0x03, 0x00));
    expect(r.format).toBe('MP3 (ID3)');
    expect(r.category).toBe('audio');
  });

  it('detects FLAC', () => {
    const r = classifyFile(bytes(0x66, 0x4C, 0x61, 0x43, 0, 0));
    expect(r.format).toBe('FLAC');
  });

  it('detects BMP', () => {
    const r = classifyFile(bytes(0x42, 0x4D, 0x36, 0x00));
    expect(r.format).toBe('BMP');
  });
});

describe('RIFF-based formats', () => {
  it('detects WAV', () => {
    // RIFF....WAVE
    const data = padded([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45], 16);
    const r = classifyFile(data);
    expect(r.format).toBe('WAV');
    expect(r.mime).toBe('audio/wav');
  });

  it('detects WebP', () => {
    const data = padded([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50], 16);
    const r = classifyFile(data);
    expect(r.format).toBe('WebP');
    expect(r.mime).toBe('image/webp');
  });

  it('detects AVI', () => {
    const data = padded([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x41, 0x56, 0x49, 0x20], 16);
    const r = classifyFile(data);
    expect(r.format).toBe('AVI');
    expect(r.category).toBe('video');
  });
});

describe('ftyp-based formats', () => {
  it('detects MP4', () => {
    // ....ftypisom
    const data = padded([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6F, 0x6D], 16);
    const r = classifyFile(data);
    expect(r.format).toBe('MP4');
    expect(r.category).toBe('video');
  });

  it('detects AVIF', () => {
    const data = padded([0x00, 0x00, 0x00, 0x1C, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66], 16);
    const r = classifyFile(data);
    expect(r.format).toBe('AVIF');
    expect(r.mime).toBe('image/avif');
  });

  it('detects HEIC', () => {
    const data = padded([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63], 16);
    const r = classifyFile(data);
    expect(r.format).toBe('HEIC');
  });
});

describe('text-based structural detection', () => {
  it('detects HTML with DOCTYPE', () => {
    const r = classifyFile(text('<!DOCTYPE html>\n<html><head><title>Test</title></head></html>'));
    expect(r.format).toBe('HTML');
    expect(r.mime).toBe('text/html');
    expect(r.isText).toBe(true);
  });

  it('detects HTML with <html> tag', () => {
    const r = classifyFile(text('<html>\n<body>hello</body>\n</html>'));
    expect(r.format).toBe('HTML');
  });

  it('detects SVG', () => {
    const r = classifyFile(text('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="100"></svg>'));
    expect(r.format).toBe('SVG');
    expect(r.mime).toBe('image/svg+xml');
    expect(r.category).toBe('image');
  });

  it('detects XML', () => {
    const r = classifyFile(text('<?xml version="1.0" encoding="UTF-8"?>\n<root><item>test</item></root>'));
    expect(r.format).toBe('XML');
  });

  it('detects JSON object', () => {
    const r = classifyFile(text('{"name": "test", "version": "1.0.0", "dependencies": {}}'));
    expect(r.format).toBe('JSON');
    expect(r.mime).toBe('application/json');
  });

  it('detects JSON array', () => {
    const r = classifyFile(text('[{"id": 1}, {"id": 2}]'));
    expect(r.format).toBe('JSON');
  });

  it('detects YAML', () => {
    const r = classifyFile(text('---\nname: test\nversion: 1.0\nitems:\n  - foo\n  - bar\n'));
    expect(r.format).toBe('YAML');
  });

  it('detects TOML', () => {
    const r = classifyFile(text('[package]\nname = "test"\nversion = "1.0.0"\n\n[dependencies]\n'));
    expect(r.format).toBe('TOML');
  });

  it('detects CSV', () => {
    const r = classifyFile(text('name,email,age\nAlice,alice@example.com,30\nBob,bob@example.com,25\n'));
    expect(r.format).toBe('CSV');
  });

  it('detects Markdown', () => {
    const r = classifyFile(text('# Hello World\n\nThis is a [link](https://example.com).\n\n- item 1\n- item 2\n'));
    expect(r.format).toBe('Markdown');
    expect(r.extension).toBe('md');
  });

  it('detects Shell script', () => {
    const r = classifyFile(text('#!/bin/bash\nset -e\necho "hello"\n'));
    expect(r.format).toBe('Shell Script');
    expect(r.confidence).toBeGreaterThan(0.9);
  });

  it('detects Python', () => {
    const r = classifyFile(text('import os\nimport sys\n\ndef main():\n    print("hello")\n\nif __name__ == "__main__":\n    main()\n'));
    expect(r.format).toBe('Python');
  });

  it('detects JavaScript', () => {
    const r = classifyFile(text('import { useState } from "react";\n\nconst App = () => {\n  return <div>hello</div>;\n};\n'));
    expect(r.format).toBe('JavaScript');
  });

  it('detects CSS', () => {
    const r = classifyFile(text(':root {\n  --color: #333;\n}\n\nbody {\n  margin: 0;\n  font-family: sans-serif;\n}\n'));
    expect(r.format).toBe('CSS');
  });

  it('detects SQL', () => {
    const r = classifyFile(text('CREATE TABLE users (\n  id INTEGER PRIMARY KEY,\n  name TEXT NOT NULL\n);\n'));
    expect(r.format).toBe('SQL');
  });

  it('detects .env files', () => {
    const r = classifyFile(text('DATABASE_URL=postgres://localhost/db\nAPI_KEY=sk-abc123\nNODE_ENV=production\n'));
    expect(r.format).toBe('Dotenv');
  });

  it('falls back to Plain Text for unknown text', () => {
    const r = classifyFile(text('This is just some random text that does not match any known pattern at all.'));
    expect(r.format).toBe('Plain Text');
    expect(r.isText).toBe(true);
  });
});

describe('edge cases', () => {
  it('handles empty input', () => {
    const r = classifyFile(new Uint8Array(0));
    expect(r.format).toBe('Binary');
    expect(r.confidence).toBeLessThan(0.5);
  });

  it('handles single byte', () => {
    const r = classifyFile(bytes(0x00));
    expect(r).toBeDefined();
  });

  it('handles pure binary data', () => {
    const data = new Uint8Array(100);
    for (let i = 0; i < 100; i++) data[i] = i;
    const r = classifyFile(data);
    expect(r.isText).toBe(false);
  });

  it('returns alternatives for ambiguous formats', () => {
    // ZIP that contains word/ → DOCX, with ZIP as alternative
    const zipHeader = [0x50, 0x4B, 0x03, 0x04];
    const content = new TextEncoder().encode('word/document.xml');
    const data = new Uint8Array(64);
    data.set(zipHeader);
    data.set(content, 30);
    const r = classifyFile(data);
    expect(r.format).toBe('DOCX');
    expect(r.alternatives.some(a => a.format === 'ZIP')).toBe(true);
  });

  it('confidence is always 0-1', () => {
    const inputs = [
      bytes(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A),
      text('{"a":1}'),
      text('hello world'),
      new Uint8Array(0),
    ];
    for (const input of inputs) {
      const r = classifyFile(input);
      expect(r.confidence).toBeGreaterThanOrEqual(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
    }
  });
});

describe('TAR detection', () => {
  it('detects TAR by magic at offset 257', () => {
    const data = new Uint8Array(263);
    // "ustar" at offset 257
    const ustar = new TextEncoder().encode('ustar');
    data.set(ustar, 257);
    const r = classifyFile(data);
    expect(r.format).toBe('TAR');
  });
});
