import { useState, useRef, useCallback, useEffect } from 'react';
import { extractColors, generateAvatar, type Style, type AvatarParams } from './avatar';

const STYLES: { id: Style; label: string }[] = [
  { id: 'pixel', label: 'Pixel Art' },
  { id: 'mosaic', label: 'Mosaic' },
  { id: 'silhouette', label: 'Silhouette' },
  { id: 'geometric', label: 'Geometric' },
  { id: 'halftone', label: 'Halftone' },
  { id: 'ascii', label: 'ASCII Art' },
  { id: 'stained-glass', label: 'Stained Glass' },
  { id: 'posterize', label: 'Posterize' },
  { id: 'pointillism', label: 'Pointillism' },
  { id: 'low-poly', label: 'Low Poly' },
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

// Default params per style
function defaultParams(style: Style): Partial<AvatarParams> {
  switch (style) {
    case 'pixel': return { gridSize: 16 };
    case 'mosaic': return { tileShape: 'square' };
    case 'silhouette': return { gradientDirection: 'diagonal', invert: false };
    case 'geometric': return { shapeCount: 20 };
    case 'halftone': return { dotSpacing: 4, colorMode: 'bw' };
    case 'ascii': return { fontSize: 8, colorMode: 'terminal' };
    case 'stained-glass': return { pointCount: 150 };
    case 'posterize': return { colorLevels: 4, outline: false };
    case 'pointillism': return { pointCount: 3000 };
    case 'low-poly': return { pointCount: 300 };
  }
}

export default function App() {
  const [sourceCanvas, setSourceCanvas] = useState<HTMLCanvasElement | null>(null);
  const [colors, setColors] = useState<string[]>([]);
  const [style, setStyle] = useState<Style>('pixel');
  const [size, setSize] = useState<number>(256);
  const [params, setParams] = useState<Partial<AvatarParams>>(defaultParams('pixel'));
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number>(0);

  // Generate avatar with current params (debounced)
  const generate = useCallback((src: HTMLCanvasElement, s: Style, sz: number, p: Partial<AvatarParams>) => {
    clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      const result = generateAvatar(src, { ...p, style: s, size: sz } as AvatarParams);
      setResultUrl(result.toDataURL('image/png'));
    }, 100);
  }, []);

  // Re-generate when params change
  useEffect(() => {
    if (sourceCanvas) {
      generate(sourceCanvas, style, size, params);
    }
  }, [sourceCanvas, style, size, params, generate]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const canvas = await loadImageToCanvas(file);
    setSourceCanvas(canvas);
    setOriginalUrl(canvas.toDataURL('image/png'));
    setColors(extractColors(canvas));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleStyleChange = useCallback((s: Style) => {
    setStyle(s);
    setParams(defaultParams(s));
  }, []);

  const handleCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.playsInline = true;
      await video.play();
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
      setColors(extractColors(canvas));
    } catch {
      // User denied camera or not available
    }
  }, []);

  const download = useCallback(() => {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = `avatar-${style}-${size}.png`;
    a.click();
  }, [resultUrl, style, size]);

  const copyToClipboard = useCallback(async () => {
    if (!resultUrl) return;
    try {
      const resp = await fetch(resultUrl);
      const blob = await resp.blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    } catch {
      // Clipboard API not supported or denied
    }
  }, [resultUrl]);

  const updateParam = useCallback(<K extends keyof AvatarParams>(key: K, value: AvatarParams[K]) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  }, []);

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

        {/* Style selector — 2 rows of 5 */}
        <div className="grid grid-cols-5 gap-2">
          {STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => handleStyleChange(s.id)}
              className={`px-2 py-1.5 rounded-full text-xs font-medium transition-colors text-center ${
                style === s.id
                  ? 'bg-violet-600 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Parameters panel */}
        <div className="flex flex-col gap-3 bg-neutral-900 rounded-lg p-3">
          <ParamsPanel style={style} params={params} updateParam={updateParam} />
        </div>

        {/* Size selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500">Size:</span>
          {SIZES.map((sz) => (
            <button
              key={sz}
              onClick={() => setSize(sz)}
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

        {/* Preview: small original + large result */}
        {(originalUrl || resultUrl) && (
          <div className="flex flex-col gap-3">
            {/* Result (large) */}
            {resultUrl && (
              <div>
                <p className="text-xs text-neutral-500 mb-1">{STYLES.find((s) => s.id === style)?.label}</p>
                <img
                  src={resultUrl}
                  alt="Styled avatar"
                  className="rounded-lg w-full max-w-md object-contain bg-neutral-900"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={download}
                    className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-colors"
                  >
                    Download PNG
                  </button>
                  <button
                    onClick={copyToClipboard}
                    className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                  >
                    Copy to Clipboard
                  </button>
                </div>
              </div>
            )}
            {/* Original (small) */}
            {originalUrl && (
              <div className="flex items-center gap-3">
                <img
                  src={originalUrl}
                  alt="Original"
                  className="w-16 h-16 rounded-lg object-cover bg-neutral-900"
                />
                <span className="text-xs text-neutral-500">Original</span>
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

// ---------------------------------------------------------------------------
// Parameters panel — renders controls for the currently selected style
// ---------------------------------------------------------------------------

function ParamsPanel({
  style,
  params,
  updateParam,
}: {
  style: Style;
  params: Partial<AvatarParams>;
  updateParam: <K extends keyof AvatarParams>(key: K, value: AvatarParams[K]) => void;
}) {
  switch (style) {
    case 'pixel':
      return (
        <>
          <SliderRow label="Grid Size" value={params.gridSize ?? 16} min={8} max={32} step={8}
            display={`${params.gridSize ?? 16}x${params.gridSize ?? 16}`}
            onChange={(v) => updateParam('gridSize', v)} />
          <ToggleRow label="Pixel Outline" value={params.outline ?? false}
            onChange={(v) => updateParam('outline', v)} />
        </>
      );

    case 'mosaic':
      return (
        <PillRow label="Tile Shape" options={['square', 'circle', 'hexagon']}
          value={params.tileShape ?? 'square'}
          onChange={(v) => updateParam('tileShape', v as 'square' | 'circle' | 'hexagon')} />
      );

    case 'silhouette':
      return (
        <>
          <SliderRow label="Threshold" value={params.threshold ?? 128} min={30} max={220} step={1}
            display={String(params.threshold ?? 'auto')}
            onChange={(v) => updateParam('threshold', v)} />
          <PillRow label="Gradient" options={['diagonal', 'radial', 'horizontal']}
            value={params.gradientDirection ?? 'diagonal'}
            onChange={(v) => updateParam('gradientDirection', v as 'diagonal' | 'radial' | 'horizontal')} />
          <ToggleRow label="Invert (Light on Dark)" value={params.invert ?? false}
            onChange={(v) => updateParam('invert', v)} />
        </>
      );

    case 'geometric':
      return (
        <SliderRow label="Shapes" value={params.shapeCount ?? 20} min={8} max={60} step={1}
          display={String(params.shapeCount ?? 20)}
          onChange={(v) => updateParam('shapeCount', v)} />
      );

    case 'halftone':
      return (
        <>
          <SliderRow label="Dot Spacing" value={params.dotSpacing ?? 4} min={2} max={8} step={1}
            display={`${params.dotSpacing ?? 4}px`}
            onChange={(v) => updateParam('dotSpacing', v)} />
          <PillRow label="Color" options={['bw', 'color']}
            labels={['B&W', 'Color']}
            value={params.colorMode ?? 'bw'}
            onChange={(v) => updateParam('colorMode', v)} />
        </>
      );

    case 'ascii':
      return (
        <>
          <SliderRow label="Font Size" value={params.fontSize ?? 8} min={6} max={14} step={1}
            display={`${params.fontSize ?? 8}px`}
            onChange={(v) => updateParam('fontSize', v)} />
          <PillRow label="Color" options={['terminal', 'mono', 'color']}
            labels={['Terminal', 'Mono', 'Color']}
            value={params.colorMode ?? 'terminal'}
            onChange={(v) => updateParam('colorMode', v)} />
        </>
      );

    case 'stained-glass':
      return (
        <SliderRow label="Cell Count" value={params.pointCount ?? 150} min={50} max={300} step={10}
          display={String(params.pointCount ?? 150)}
          onChange={(v) => updateParam('pointCount', v)} />
      );

    case 'posterize':
      return (
        <>
          <SliderRow label="Color Levels" value={params.colorLevels ?? 4} min={2} max={8} step={1}
            display={String(params.colorLevels ?? 4)}
            onChange={(v) => updateParam('colorLevels', v)} />
          <ToggleRow label="Edge Outline" value={params.outline ?? false}
            onChange={(v) => updateParam('outline', v)} />
        </>
      );

    case 'pointillism':
      return (
        <SliderRow label="Dot Density" value={params.pointCount ?? 3000} min={500} max={8000} step={100}
          display={String(params.pointCount ?? 3000)}
          onChange={(v) => updateParam('pointCount', v)} />
      );

    case 'low-poly':
      return (
        <SliderRow label="Point Count" value={params.pointCount ?? 300} min={100} max={500} step={10}
          display={String(params.pointCount ?? 300)}
          onChange={(v) => updateParam('pointCount', v)} />
      );
  }
}

// ---------------------------------------------------------------------------
// Reusable control components
// ---------------------------------------------------------------------------

function SliderRow({ label, value, min, max, step, display, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-neutral-400 w-24 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-violet-500"
      />
      <span className="text-xs text-neutral-500 w-12 text-right font-mono">{display}</span>
    </div>
  );
}

function PillRow({ label, options, labels, value, onChange }: {
  label: string;
  options: string[];
  labels?: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-neutral-400 w-24 shrink-0">{label}</span>
      <div className="flex gap-1.5">
        {options.map((opt, i) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              value === opt
                ? 'bg-violet-600 text-white'
                : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
            }`}
          >
            {labels?.[i] ?? opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function ToggleRow({ label, value, onChange }: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-neutral-400 w-24 shrink-0">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`w-9 h-5 rounded-full transition-colors relative ${
          value ? 'bg-violet-600' : 'bg-neutral-700'
        }`}
      >
        <span className={`block w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${
          value ? 'translate-x-4' : 'translate-x-0.5'
        }`} />
      </button>
    </div>
  );
}
