import { useState, useRef, useCallback } from 'react';
import { initModel, identifyPlant, type PlantResult } from './identifier';

type ModelState = 'idle' | 'downloading' | 'ready' | 'error';

export default function App() {
  const [modelState, setModelState] = useState<ModelState>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<PlantResult | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadModelAndIdentify = useCallback(async (imgEl: HTMLImageElement) => {
    if (modelState !== 'ready') {
      setModelState('downloading');
      try {
        await initModel((p) => setProgress(p));
        setModelState('ready');
      } catch {
        setModelState('error');
        return;
      }
    }
    setAnalyzing(true);
    try {
      const r = await identifyPlant(imgEl);
      setResult(r);
    } finally {
      setAnalyzing(false);
    }
  }, [modelState]);

  const processImage = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setResult(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => loadModelAndIdentify(img);
    img.src = url;
  }, [loadModelAndIdentify]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) processImage(file);
  }, [processImage]);

  const handleCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.playsInline = true;
      await video.play();
      await new Promise((r) => setTimeout(r, 500));

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0);
      stream.getTracks().forEach((t) => t.stop());

      const url = canvas.toDataURL('image/jpeg');
      setImageUrl(url);
      setResult(null);

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => loadModelAndIdentify(img);
      img.src = url;
    } catch {
      // Camera denied or unavailable
    }
  }, [loadModelAndIdentify]);

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">
          FreeAgentStore
        </a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
          Plant Identifier
        </h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
          MobileViT — 20MB model
        </span>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 gap-4">
        {/* Model download progress */}
        {modelState === 'downloading' && (
          <div className="bg-neutral-900 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-300">Downloading model...</span>
              <span className="text-xs text-neutral-500 font-mono">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-neutral-800 rounded-full h-2">
              <div
                className="bg-violet-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-neutral-600 mt-2">First time only — cached for future use</p>
          </div>
        )}

        {modelState === 'error' && (
          <div className="bg-red-950/50 border border-red-800 rounded-lg p-4 text-sm text-red-300">
            Failed to load model. Check your connection and try again.
          </div>
        )}

        {/* Upload area */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-neutral-700 rounded-lg p-8 text-center cursor-pointer hover:border-violet-500 transition-colors"
        >
          <p className="text-neutral-400">Drop a plant photo here or click to browse</p>
          <p className="text-neutral-600 text-sm mt-1">JPG, PNG, WebP</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) processImage(file);
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

        {/* Image preview */}
        {imageUrl && (
          <div className="rounded-lg overflow-hidden bg-neutral-900">
            <img src={imageUrl} alt="Plant" className="w-full max-h-80 object-contain" />
          </div>
        )}

        {/* Analyzing state */}
        {analyzing && (
          <div className="text-center py-4">
            <div className="inline-block w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-neutral-400 mt-2">Identifying plant...</p>
          </div>
        )}

        {/* Result card */}
        {result && !analyzing && (
          <div className="bg-neutral-900 rounded-lg p-5 space-y-4">
            {result.isPlant ? (
              <>
                {/* Plant name */}
                <div>
                  <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-serif)' }}>
                    {result.name}
                  </h2>
                  {result.scientific && result.scientific !== 'Unknown' && (
                    <p className="text-sm text-neutral-400 italic mt-0.5">{result.scientific}</p>
                  )}
                </div>

                {/* Confidence */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-500">Confidence</span>
                  <div className="flex-1 bg-neutral-800 rounded-full h-1.5">
                    <div
                      className="bg-violet-600 h-1.5 rounded-full"
                      style={{ width: `${result.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-neutral-400 font-mono">
                    {(result.confidence * 100).toFixed(1)}%
                  </span>
                </div>

                {/* Toxicity warning */}
                {result.toxic && (
                  <div className="bg-red-950/50 border border-red-800/50 rounded-lg p-3">
                    <p className="text-sm font-semibold text-red-400">Toxic</p>
                    <p className="text-xs text-red-300/80 mt-0.5">
                      Harmful to: {result.toxicTo.join(', ')}
                    </p>
                  </div>
                )}

                {!result.toxic && (
                  <div className="bg-green-950/50 border border-green-800/50 rounded-lg p-3">
                    <p className="text-sm font-semibold text-green-400">Non-toxic</p>
                    <p className="text-xs text-green-300/80 mt-0.5">
                      Generally safe around pets and children.
                    </p>
                  </div>
                )}

                {/* Care card */}
                {result.care.difficulty && result.care.difficulty !== 'Unknown' && (
                  <div className="grid grid-cols-3 gap-3">
                    <CareItem label="Water" value={result.care.water} icon="droplet" />
                    <CareItem label="Light" value={result.care.light} icon="sun" />
                    <CareItem label="Difficulty" value={result.care.difficulty} icon="leaf" />
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-neutral-400">Not a plant.</p>
                <p className="text-sm text-neutral-500 mt-1">
                  Detected: <span className="text-neutral-300">{result.name}</span>
                  {' '}({(result.confidence * 100).toFixed(1)}%)
                </p>
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-neutral-600">
          Model-based agent — MobileViT (20MB) runs locally in your browser. Your images never leave your device.
        </p>
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        MobileViT image classification + botanical database.
        <a href="https://github.com/FreeAgentStore/platform/blob/main/agents/plant-identifier/web/src/identifier.ts" className="underline ml-1">View source</a>
      </footer>
    </div>
  );
}

function CareItem({ label, value, icon }: { label: string; value: string; icon: string }) {
  const iconMap: Record<string, string> = {
    droplet: 'M12 2C12 2 6 8.5 6 13.5C6 17.09 8.69 20 12 20C15.31 20 18 17.09 18 13.5C18 8.5 12 2 12 2Z',
    sun: 'M12 2V4M12 20V22M4 12H2M6.31 6.31L4.9 4.9M17.69 6.31L19.1 4.9M6.31 17.69L4.9 19.1M17.69 17.69L19.1 19.1M22 12H20M17 12C17 14.76 14.76 17 12 17C9.24 17 7 14.76 7 12C7 9.24 9.24 7 12 7C14.76 7 17 9.24 17 12Z',
    leaf: 'M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22L6.66 19.7C7.14 19.87 7.64 20 8 20C19 20 22 3 22 3C21 5 14 5.25 9 6.25C4 7.25 2 11.5 2 13.5C2 15.5 3.75 17.25 3.75 17.25',
  };
  return (
    <div className="bg-neutral-800 rounded-lg p-3 text-center">
      <svg className="w-5 h-5 mx-auto mb-1 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d={iconMap[icon] ?? iconMap.leaf} />
      </svg>
      <p className="text-[10px] text-neutral-500 uppercase tracking-wider">{label}</p>
      <p className="text-xs text-neutral-300 mt-0.5">{value}</p>
    </div>
  );
}
