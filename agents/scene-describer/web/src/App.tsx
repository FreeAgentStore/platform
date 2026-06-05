import { useState, useRef, useCallback, useEffect } from 'react';
import { initModel, describeScene, detectObjects, type SceneDescription } from './describer';

type State = 'idle' | 'loading' | 'ready' | 'processing';

interface RawDetection {
  label: string;
  score: number;
  box: { xmin: number; ymin: number; xmax: number; ymax: number };
}

// Distinct colors for bounding boxes
const BOX_COLORS = [
  '#7c3aed', '#ec4899', '#f97316', '#22c55e', '#3b82f6',
  '#eab308', '#ef4444', '#06b6d4', '#8b5cf6', '#f43f5e',
];

export default function App() {
  const [state, setState] = useState<State>('idle');
  const [progress, setProgress] = useState(0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [result, setResult] = useState<SceneDescription | null>(null);
  const [detections, setDetections] = useState<RawDetection[]>([]);
  const [copiedAlt, setCopiedAlt] = useState(false);
  const [copiedDesc, setCopiedDesc] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const init = useCallback(async () => {
    setState('loading');
    setProgress(0);
    try {
      await initModel((pct) => setProgress(pct));
      setState('ready');
    } catch (e) {
      console.error(e);
      setState('idle');
    }
  }, []);

  // Draw bounding boxes on canvas overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || detections.length === 0) return;

    const w = img.naturalWidth;
    const h = img.naturalHeight;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, w, h);

    // Assign colors by label
    const labelColors: Record<string, string> = {};
    let colorIdx = 0;

    for (const det of detections) {
      if (!labelColors[det.label]) {
        labelColors[det.label] = BOX_COLORS[colorIdx % BOX_COLORS.length];
        colorIdx++;
      }

      const color = labelColors[det.label];
      const { xmin, ymin, xmax, ymax } = det.box;

      // Draw box
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, Math.min(4, w / 300));
      ctx.strokeRect(xmin, ymin, xmax - xmin, ymax - ymin);

      // Draw label background
      const label = `${det.label} ${Math.round(det.score * 100)}%`;
      const fontSize = Math.max(12, Math.min(18, w / 40));
      ctx.font = `bold ${fontSize}px sans-serif`;
      const textMetrics = ctx.measureText(label);
      const textH = fontSize + 6;
      const textW = textMetrics.width + 8;

      ctx.fillStyle = color;
      ctx.fillRect(xmin, ymin - textH, textW, textH);

      ctx.fillStyle = '#fff';
      ctx.fillText(label, xmin + 4, ymin - 4);
    }
  }, [detections]);

  const handleImage = useCallback(async (file: File) => {
    if (state !== 'ready') return;

    setState('processing');
    setResult(null);
    setDetections([]);
    setCopiedAlt(false);
    setCopiedDesc(false);

    const url = URL.createObjectURL(file);
    setImageUrl(url);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;

    img.onload = async () => {
      imgRef.current = img;
      try {
        const [sceneResult, rawDetections] = await Promise.all([
          describeScene(img),
          detectObjects(img),
        ]);
        setResult(sceneResult);
        setDetections(rawDetections);
      } catch (e) {
        console.error(e);
      }
      setState('ready');
    };
  }, [state]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) handleImage(file);
  }, [handleImage]);

  const pickFile = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) handleImage(file);
    };
    input.click();
  }, [handleImage]);

  const copyAlt = useCallback(() => {
    if (!result) return;
    navigator.clipboard.writeText(result.alt);
    setCopiedAlt(true);
    setTimeout(() => setCopiedAlt(false), 2000);
  }, [result]);

  const copyDesc = useCallback(() => {
    if (!result) return;
    navigator.clipboard.writeText(result.description);
    setCopiedDesc(true);
    setTimeout(() => setCopiedDesc(false), 2000);
  }, [result]);

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">
          FreeAgentStore
        </a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
          Scene Describer
        </h1>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 gap-4">
        {state === 'idle' && (
          <div className="text-center py-12">
            <p className="text-neutral-400 mb-4">
              Upload a photo, get a natural language description with detected objects. ~13MB model, cached for next time.
            </p>
            <button onClick={init} className="px-6 py-3 rounded-lg font-semibold text-white bg-violet-600 hover:bg-violet-500">
              Download Model
            </button>
          </div>
        )}

        {state === 'loading' && (
          <div className="text-center py-12">
            <div className="w-48 h-2 bg-neutral-800 rounded-full mx-auto overflow-hidden">
              <div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-neutral-400 mt-3 text-sm">Downloading DETR model... {progress}%</p>
          </div>
        )}

        {(state === 'ready' || state === 'processing') && (
          <>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={pickFile}
              className="border-2 border-dashed border-neutral-700 rounded-lg p-8 text-center cursor-pointer hover:border-violet-500 transition-colors"
            >
              {state === 'processing' ? (
                <div className="space-y-2">
                  <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-neutral-400">Analyzing scene...</p>
                </div>
              ) : (
                <p className="text-neutral-400">Drop a photo here, click to browse, or take a photo</p>
              )}
            </div>

            {/* Image with bounding box overlay */}
            {imageUrl && (
              <div className="relative">
                <img
                  src={imageUrl}
                  alt="Uploaded scene"
                  className="rounded-lg max-h-96 w-full object-contain bg-neutral-900"
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full object-contain rounded-lg pointer-events-none"
                  style={{ objectFit: 'contain' }}
                />
                {state === 'processing' && (
                  <div className="absolute inset-0 bg-neutral-950/60 rounded-lg flex items-center justify-center">
                    <p className="text-sm text-neutral-300">Detecting objects...</p>
                  </div>
                )}
              </div>
            )}

            {/* Results */}
            {result && (
              <div className="space-y-3">
                {/* Description */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-neutral-500">Description</span>
                    <button
                      onClick={copyDesc}
                      className="text-xs px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400"
                    >
                      {copiedDesc ? 'Copied' : 'Copy description'}
                    </button>
                  </div>
                  <p className="text-neutral-200 leading-relaxed">{result.description}</p>
                </div>

                {/* Alt text */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-neutral-500">Alt Text</span>
                    <button
                      onClick={copyAlt}
                      className="text-xs px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400"
                    >
                      {copiedAlt ? 'Copied' : 'Copy alt text'}
                    </button>
                  </div>
                  <p className="text-neutral-300 text-sm font-mono">{result.alt}</p>
                </div>

                {/* Object list */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                  <span className="text-sm text-neutral-500 block mb-2">Detected Objects</span>
                  {result.objects.length === 0 ? (
                    <p className="text-neutral-500 text-sm">No objects detected above confidence threshold.</p>
                  ) : (
                    <div className="space-y-1">
                      {result.objects.map((obj) => (
                        <div key={obj.label} className="flex items-center gap-3 text-sm">
                          <span className="text-neutral-200 font-medium w-32">{obj.label}</span>
                          <span className="text-neutral-500 w-8 text-center">{obj.count}x</span>
                          <span className="text-neutral-500 text-xs">{obj.position}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Meta */}
                <div className="flex flex-wrap gap-3 text-xs">
                  <span className="px-2 py-1 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">
                    {result.sceneType} scene
                  </span>
                  <span className="px-2 py-1 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">
                    {Math.round(result.confidence * 100)}% avg confidence
                  </span>
                  <span className="px-2 py-1 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">
                    {result.objects.reduce((s, o) => s + o.count, 0)} objects detected
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Powered by <a href="https://huggingface.co/facebook/detr-resnet-50" className="underline">DETR</a> via Transformers.js.
        Images never leave your device.
      </footer>
    </div>
  );
}
