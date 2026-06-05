import { useState, useRef, useCallback } from 'react';
import { extractColors, generateGeometric, generatePixelArt, generateSilhouette, generateMosaic, type Style } from './avatar';

const STYLES: { id: Style; label: string }[] = [
  { id: 'geometric', label: 'Geometric' },
  { id: 'pixel', label: 'Pixel Art' },
  { id: 'silhouette', label: 'Silhouette' },
  { id: 'mosaic', label: 'Mosaic' },
];

const SIZES = [128, 256, 512] as const;

function loadImageToCanvas(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const side = Math.min(img.width, img.height);
      canvas.width = side;
      canvas.height = side;
      const ctx = canvas.getContext('2d')!;
      // Center-crop to square
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, side, side);
      URL.revokeObjectURL(img.src);
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export default function App() {
  const [sourceCanvas, setSourceCanvas] = useState<HTMLCanvasElement | null>(null);
  const [colors, setColors] = useState<string[]>([]);
  const [style, setStyle] = useState<Style>('geometric');
  const [size, setSize] = useState<number>(256);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generate = useCallback((src: HTMLCanvasElement, palette: string[], s: Style, sz: number) => {
    let result: HTMLCanvasElement;
    switch (s) {
      case 'geometric':
        result = generateGeometric(src, palette, sz);
        break;
      case 'pixel':
        result = generatePixelArt(src, sz);
        break;
      case 'silhouette':
        result = generateSilhouette(src, palette, sz);
        break;
      case 'mosaic':
        result = generateMosaic(src, palette, sz);
        break;
    }
    setResultUrl(result.toDataURL('image/png'));
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;

    const canvas = await loadImageToCanvas(file);
    setSourceCanvas(canvas);
    setOriginalUrl(canvas.toDataURL('image/png'));

    const palette = extractColors(canvas);
    setColors(palette);

    generate(canvas, palette, style, size);
  }, [style, size, generate]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleStyleChange = useCallback((s: Style) => {
    setStyle(s);
    if (sourceCanvas && colors.length) {
      generate(sourceCanvas, colors, s, size);
    }
  }, [sourceCanvas, colors, size, generate]);

  const handleSizeChange = useCallback((sz: number) => {
    setSize(sz);
    if (sourceCanvas && colors.length) {
      generate(sourceCanvas, colors, style, sz);
    }
  }, [sourceCanvas, colors, style, generate]);

  const handleCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.playsInline = true;
      await video.play();

      // Wait a moment for the camera to adjust
      await new Promise((r) => setTimeout(r, 500));

      const canvas = document.createElement('canvas');
      const side = Math.min(video.videoWidth, video.videoHeight);
      canvas.width = side;
      canvas.height = side;
      const ctx = canvas.getContext('2d')!;
      const sx = (video.videoWidth - side) / 2;
      const sy = (video.videoHeight - side) / 2;
      ctx.drawImage(video, sx, sy, side, side, 0, 0, side, side);

      stream.getTracks().forEach((t) => t.stop());

      setSourceCanvas(canvas);
      setOriginalUrl(canvas.toDataURL('image/png'));

      const palette = extractColors(canvas);
      setColors(palette);
      generate(canvas, palette, style, size);
    } catch {
      // User denied camera or not available
    }
  }, [style, size, generate]);

  const download = useCallback(() => {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = `avatar-${style}-${size}.png`;
    a.click();
  }, [resultUrl, style, size]);

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">
          FreeAgentStore
        </a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
          Avatar Maker
        </h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
          Heuristic — no model needed
        </span>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 gap-4">
        {/* Upload area */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-neutral-700 rounded-lg p-8 text-center cursor-pointer hover:border-violet-500 transition-colors"
        >
          <p className="text-neutral-400">Drop an image here or click to browse</p>
          <p className="text-neutral-600 text-sm mt-1">JPG, PNG, WebP</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>

        {/* Camera button */}
        <button
          onClick={handleCamera}
          className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
        >
          Or take a photo with your camera
        </button>

        {/* Style selector */}
        <div className="flex flex-wrap gap-2">
          {STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => handleStyleChange(s.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                style === s.id
                  ? 'bg-violet-600 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Size selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500">Size:</span>
          {SIZES.map((sz) => (
            <button
              key={sz}
              onClick={() => handleSizeChange(sz)}
              className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                size === sz
                  ? 'bg-violet-600 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
              }`}
            >
              {sz}
            </button>
          ))}
        </div>

        {/* Color palette preview */}
        {colors.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500">Palette:</span>
            {colors.map((c, i) => (
              <div
                key={i}
                className="w-6 h-6 rounded-full border border-neutral-700"
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
        )}

        {/* Preview: original + result side by side */}
        {(originalUrl || resultUrl) && (
          <div className="grid grid-cols-2 gap-4">
            {originalUrl && (
              <div>
                <p className="text-xs text-neutral-500 mb-1">Original</p>
                <img
                  src={originalUrl}
                  alt="Original"
                  className="rounded-lg w-full object-contain bg-neutral-900"
                />
              </div>
            )}
            {resultUrl && (
              <div>
                <p className="text-xs text-neutral-500 mb-1">{STYLES.find((s) => s.id === style)?.label}</p>
                <img
                  src={resultUrl}
                  alt="Styled avatar"
                  className="rounded-lg w-full object-contain bg-neutral-900"
                />
                <button
                  onClick={download}
                  className="mt-2 px-4 py-1.5 rounded-lg text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-colors"
                >
                  Download PNG
                </button>
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-neutral-600">
          Heuristic agent — zero model, zero inference, zero cost. Your image never leaves your browser.
        </p>
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Heuristic agent — zero model, zero inference, zero cost.
        <a href="https://github.com/FreeAgentStore/platform/blob/main/agents/avatar-maker/web/src/avatar.ts" className="underline ml-1">View source</a>
      </footer>
    </div>
  );
}
