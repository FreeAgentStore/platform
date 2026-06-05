import { useState, useRef, useCallback } from 'react';
import { initModel, analyzeFood, type FoodResult } from './classifier';

type ModelState = 'idle' | 'downloading' | 'ready' | 'error';

export default function App() {
  const [modelState, setModelState] = useState<ModelState>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<FoodResult | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadModelAndAnalyze = useCallback(async (imgEl: HTMLImageElement) => {
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
      const r = await analyzeFood(imgEl);
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
    img.onload = () => loadModelAndAnalyze(img);
    img.src = url;
  }, [loadModelAndAnalyze]);

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
      img.onload = () => loadModelAndAnalyze(img);
      img.src = url;
    } catch {
      // Camera denied or unavailable
    }
  }, [loadModelAndAnalyze]);

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">
          FreeAgentStore
        </a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
          Food Analyzer
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
          <p className="text-neutral-400">Drop a food photo here or click to browse</p>
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
            <img src={imageUrl} alt="Food" className="w-full max-h-80 object-contain" />
          </div>
        )}

        {/* Analyzing state */}
        {analyzing && (
          <div className="text-center py-4">
            <div className="inline-block w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-neutral-400 mt-2">Analyzing food...</p>
          </div>
        )}

        {/* Result card */}
        {result && !analyzing && (
          <div className="bg-neutral-900 rounded-lg p-5 space-y-4">
            {result.isFood ? (
              <>
                {/* Dish name */}
                <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-serif)' }}>
                  {result.dish}
                </h2>

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

                {/* Calories + serving */}
                {result.calories !== null && (
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-bold text-violet-400 font-mono">
                      {result.calories}
                    </span>
                    <span className="text-neutral-400">calories</span>
                    {result.serving && (
                      <span className="text-sm text-neutral-500">per {result.serving}</span>
                    )}
                  </div>
                )}

                {result.calories === null && (
                  <p className="text-sm text-neutral-500">
                    Calorie data not available for this item.
                  </p>
                )}

                {/* Ingredients */}
                {result.ingredients.length > 0 && (
                  <div>
                    <p className="text-xs text-neutral-500 mb-2">Common ingredients</p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.ingredients.map((ing) => (
                        <span
                          key={ing}
                          className="px-2.5 py-1 rounded-full text-xs bg-neutral-800 text-neutral-300"
                        >
                          {ing}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-neutral-400">Not a food item.</p>
                <p className="text-sm text-neutral-500 mt-1">
                  Detected: <span className="text-neutral-300">{result.dish}</span>
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
        MobileViT image classification + nutrition database.
        <a href="https://github.com/FreeAgentStore/platform/blob/main/agents/food-analyzer/web/src/classifier.ts" className="underline ml-1">View source</a>
      </footer>
    </div>
  );
}
