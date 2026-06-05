import { useState, useRef, useCallback } from 'react';
import { extractColorsFromImage, generateFromText, heuristicPalette, type Color } from './palette';

type Tab = 'image' | 'text';
type Source = 'Image' | 'Chrome AI' | 'Heuristic' | null;

const PRESETS = ['Ocean', 'Sunset', 'Forest', 'Neon', 'Cozy', 'Pastel', 'Moody', 'Arctic'];

export default function App() {
  const [tab, setTab] = useState<Tab>('text');
  const [colors, setColors] = useState<Color[]>([]);
  const [source, setSource] = useState<Source>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleImage = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current!;
      const scale = Math.min(1, 400 / Math.max(img.width, img.height));
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const extracted = extractColorsFromImage(canvas);
      setColors(extracted);
      setSource('Image');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) handleImage(file);
  }, [handleImage]);

  const handleTextSubmit = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const result = await generateFromText(text);
      setColors(result.colors);
      setSource(result.source);
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePreset = useCallback((mood: string) => {
    setTextInput(mood.toLowerCase());
    const result = heuristicPalette(mood.toLowerCase());
    setColors(result);
    setSource('Heuristic');
  }, []);

  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }, []);

  const copyCssVars = useCallback(() => {
    const css = colors.map((c, i) => `  --palette-${i + 1}: ${c.hex};`).join('\n');
    copyToClipboard(`:root {\n${css}\n}`, 'css');
  }, [colors, copyToClipboard]);

  const copyTailwind = useCallback(() => {
    const obj = colors.reduce<Record<string, string>>((acc, c, i) => {
      acc[`palette-${i + 1}`] = c.hex;
      return acc;
    }, {});
    copyToClipboard(`colors: ${JSON.stringify(obj, null, 2)}`, 'tailwind');
  }, [colors, copyToClipboard]);

  const downloadPng = useCallback(() => {
    const w = 600, h = 200;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const sw = w / colors.length;
    colors.forEach((c, i) => {
      ctx.fillStyle = c.hex;
      ctx.fillRect(i * sw, 0, sw, h);
      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 4;
      ctx.fillText(c.hex, i * sw + 10, h - 30);
      ctx.fillText(c.name, i * sw + 10, h - 12);
      ctx.shadowBlur = 0;
    });
    const link = document.createElement('a');
    link.download = 'mood-palette.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [colors]);

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">
          FreeAgentStore
        </a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
          Mood Palette
        </h1>
        {source && (
          <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
            {source}
          </span>
        )}
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 gap-4">
        {/* Tab switcher */}
        <div className="flex gap-1 bg-neutral-900 rounded-lg p-1">
          <button
            onClick={() => setTab('image')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              tab === 'image' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            From Image
          </button>
          <button
            onClick={() => setTab('text')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              tab === 'text' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            From Text
          </button>
        </div>

        {/* Image tab */}
        {tab === 'image' && (
          <div className="space-y-3">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-neutral-700 rounded-lg p-8 text-center cursor-pointer hover:border-neutral-500 transition-colors"
            >
              {imageUrl ? (
                <img src={imageUrl} alt="Uploaded" className="max-h-48 mx-auto rounded" />
              ) : (
                <div className="text-neutral-500">
                  <p className="text-lg mb-1">Drop an image here</p>
                  <p className="text-sm">or click to browse</p>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImage(file);
              }}
            />
          </div>
        )}

        {/* Text tab */}
        {tab === 'text' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleTextSubmit(textInput); }}
                placeholder="Describe a mood... e.g. 'ocean sunrise', 'cozy autumn', 'neon cyberpunk'"
                className="flex-1 px-4 py-3 rounded-lg bg-neutral-900 border border-neutral-800 focus:outline-none focus:border-neutral-600 text-neutral-100 placeholder:text-neutral-600"
              />
              <button
                onClick={() => handleTextSubmit(textInput)}
                disabled={loading || !textInput.trim()}
                className="px-5 py-3 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
              >
                {loading ? '...' : 'Generate'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((mood) => (
                <button
                  key={mood}
                  onClick={() => handlePreset(mood)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 transition-colors"
                >
                  {mood}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Palette display */}
        {colors.length > 0 && (
          <div className="space-y-4">
            <div className="flex gap-3">
              {colors.map((color, i) => (
                <button
                  key={i}
                  onClick={() => copyToClipboard(color.hex, color.hex)}
                  className="flex-1 group"
                  title={`Click to copy ${color.hex}`}
                >
                  <div
                    className="aspect-square rounded-xl mb-2 ring-1 ring-neutral-800 transition-transform group-hover:scale-105"
                    style={{ backgroundColor: color.hex }}
                  />
                  <p className="text-xs font-mono text-neutral-400 group-hover:text-neutral-200 transition-colors">
                    {copied === color.hex ? 'Copied!' : color.hex}
                  </p>
                  <p className="text-xs text-neutral-600 truncate">{color.name}</p>
                </button>
              ))}
            </div>

            {/* Export buttons */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={copyCssVars}
                className="px-3 py-1.5 rounded text-xs font-medium bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 transition-colors"
              >
                {copied === 'css' ? 'Copied!' : 'Copy CSS Variables'}
              </button>
              <button
                onClick={copyTailwind}
                className="px-3 py-1.5 rounded text-xs font-medium bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 transition-colors"
              >
                {copied === 'tailwind' ? 'Copied!' : 'Copy Tailwind Config'}
              </button>
              <button
                onClick={downloadPng}
                className="px-3 py-1.5 rounded text-xs font-medium bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 transition-colors"
              >
                Download as PNG
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Hidden canvas for image processing */}
      <canvas ref={canvasRef} className="hidden" />

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Extract colors from images or generate from mood descriptions. Runs in your browser.
      </footer>
    </div>
  );
}
