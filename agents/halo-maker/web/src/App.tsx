import { useState, useRef } from 'react';
import { addHalo } from './halo';
import type { HaloStyle } from './halo';

const STYLES: { id: HaloStyle; label: string; desc: string }[] = [
  { id: 'byzantine', label: 'Byzantine', desc: 'Solid gold circle, flat, iconic' },
  { id: 'renaissance', label: 'Renaissance', desc: 'Soft radial glow, warm amber' },
  { id: 'subtle', label: 'Subtle', desc: 'Very light glow, elegant' },
  { id: 'neon', label: 'Neon', desc: 'Electric gold, high contrast' },
];

export default function App() {
  const [style, setStyle] = useState<HaloStyle>('renaissance');
  const [opacity, setOpacity] = useState(0.5);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    setResultUrl(null);
    setFileName(file.name);
    try {
      const canvas = await addHalo(file, { style, opacity });
      canvasRef.current = canvas;
      setResultUrl(canvas.toDataURL('image/png'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to process image');
    } finally {
      setLoading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) handleFile(file);
  }

  function handleDownload() {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = `halo-${fileName || 'image'}.png`;
    a.click();
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="border-b border-neutral-800 px-4 py-3 flex items-center gap-3">
        <span className="text-xl">&#x1f31f;</span>
        <h1 className="font-bold text-lg">Halo Maker</h1>
        <span className="text-xs text-neutral-500 ml-auto">FreeAgentStore</span>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-4 space-y-4">
        {/* Style selector */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {STYLES.map((s) => (
            <button
              type="button"
              key={s.id}
              onClick={() => setStyle(s.id)}
              className={`p-3 rounded-xl border text-left transition-all ${
                style === s.id
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-neutral-800 bg-neutral-900 hover:border-neutral-700'
              }`}
            >
              <div className="font-semibold text-sm">{s.label}</div>
              <div className="text-xs text-neutral-500 mt-0.5">{s.desc}</div>
            </button>
          ))}
        </div>

        {/* Opacity slider */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-neutral-500 w-16">Opacity</label>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
            className="flex-1 accent-amber-500"
          />
          <span className="text-xs text-neutral-400 w-8 text-right">{Math.round(opacity * 100)}%</span>
        </div>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-neutral-700 rounded-2xl p-8 text-center cursor-pointer hover:border-amber-500/50 transition-colors"
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          {loading ? (
            <p className="text-amber-400 animate-pulse">Processing...</p>
          ) : (
            <>
              <p className="text-neutral-400">Drop a portrait photo or click to upload</p>
              <p className="text-xs text-neutral-600 mt-1">Works best with clear face photos</p>
            </>
          )}
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {/* Result */}
        {resultUrl && (
          <div className="space-y-3">
            <img src={resultUrl} alt="Portrait with halo" className="w-full rounded-xl border border-neutral-800" />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDownload}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 font-semibold text-sm transition-colors"
              >
                Download PNG
              </button>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="px-4 py-2.5 rounded-xl border border-neutral-700 text-neutral-400 hover:text-neutral-200 text-sm transition-colors"
              >
                Try another
              </button>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="text-xs text-neutral-600 space-y-1 pt-4 border-t border-neutral-900">
          <p>Uses the FaceDetector API (Chrome) for head positioning. Falls back to center-top on other browsers.</p>
          <p>Everything runs locally in your browser. No image data is uploaded.</p>
        </div>
      </main>
    </div>
  );
}
