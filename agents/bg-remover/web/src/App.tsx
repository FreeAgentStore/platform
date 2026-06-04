import { useState, useRef, useCallback } from 'react';

type State = 'idle' | 'loading' | 'ready' | 'processing';

export default function App() {
  const [state, setState] = useState<State>('idle');
  const [progress, setProgress] = useState(0);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const pipelineRef = useRef<any>(null);

  const init = useCallback(async () => {
    setState('loading');
    setProgress(0);
    try {
      const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3/+esm');
      env.allowLocalModels = false;
      setProgress(30);
      pipelineRef.current = await pipeline('image-segmentation', 'briaai/RMBG-1.4', {
        device: typeof navigator !== 'undefined' && navigator.gpu ? 'webgpu' : 'wasm',
      });
      setProgress(100);
      setState('ready');
    } catch (e) {
      console.error(e);
      setState('idle');
    }
  }, []);

  const processImage = useCallback(async (file: File) => {
    if (!pipelineRef.current || state !== 'ready') return;
    setState('processing');
    setResultUrl(null);

    const url = URL.createObjectURL(file);
    setOriginalUrl(url);

    try {
      const result = await pipelineRef.current(url);
      if (result?.[0]?.mask) {
        const maskBlob = await result[0].mask.toBlob();
        setResultUrl(URL.createObjectURL(maskBlob));
      }
    } catch (e) {
      console.error(e);
    }
    setState('ready');
  }, [state]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) processImage(file);
  }, [processImage]);

  const download = useCallback(() => {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = 'no-background.png';
    a.click();
  }, [resultUrl]);

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">
          FreeAgentStore
        </a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
          Background Remover
        </h1>
      </header>

      <main className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-4 gap-4">
        {state === 'idle' && (
          <div className="text-center py-12">
            <p className="text-neutral-400 mb-4">
              Remove backgrounds from images using RMBG AI. ~176MB model, cached for next time.
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
            <p className="text-neutral-400 mt-3 text-sm">Loading RMBG model... {progress}%</p>
          </div>
        )}

        {(state === 'ready' || state === 'processing') && (
          <>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-neutral-700 rounded-lg p-8 text-center cursor-pointer hover:border-violet-500 transition-colors"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) processImage(file);
                };
                input.click();
              }}
            >
              {state === 'processing' ? (
                <p className="text-neutral-400">Removing background...</p>
              ) : (
                <p className="text-neutral-400">Drop an image here or click to browse</p>
              )}
            </div>

            {(originalUrl || resultUrl) && (
              <div className="grid grid-cols-2 gap-4">
                {originalUrl && (
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">Original</p>
                    <img src={originalUrl} alt="Original" className="rounded-lg max-h-80 w-full object-contain bg-neutral-900" />
                  </div>
                )}
                {resultUrl && (
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">Result</p>
                    <img src={resultUrl} alt="Background removed" className="rounded-lg max-h-80 w-full object-contain" style={{ background: 'repeating-conic-gradient(#333 0% 25%, #222 0% 50%) 50% / 20px 20px' }} />
                    <button onClick={download} className="mt-2 text-xs px-3 py-1 rounded bg-violet-600 hover:bg-violet-500">
                      Download PNG
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Powered by <a href="https://huggingface.co/briaai/RMBG-1.4" className="underline">RMBG 1.4</a> via Transformers.js.
        Images never leave your device.
      </footer>
    </div>
  );
}
