import { useState, useRef, useCallback } from 'react';
import { initModel, scanDocument, type ScanResult } from './scanner';

type State = 'idle' | 'loading' | 'ready' | 'scanning';

export default function App() {
  const [state, setState] = useState<State>('idle');
  const [progress, setProgress] = useState(0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [copied, setCopied] = useState(false);
  const modelReady = useRef(false);

  const init = useCallback(async () => {
    setState('loading');
    setProgress(0);
    try {
      await initModel((pct) => setProgress(pct));
      modelReady.current = true;
      setState('ready');
    } catch (e) {
      console.error(e);
      setState('idle');
    }
  }, []);

  const handleImage = useCallback(async (file: File) => {
    if (!modelReady.current || state !== 'ready') return;

    setState('scanning');
    setResult(null);
    setCopied(false);

    const url = URL.createObjectURL(file);
    setImageUrl(url);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;

    img.onload = async () => {
      try {
        const scanResult = await scanDocument(img);
        setResult(scanResult);
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

  const copyText = useCallback(() => {
    if (!result) return;
    navigator.clipboard.writeText(result.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  const downloadTxt = useCallback(() => {
    if (!result) return;
    const blob = new Blob([result.text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'scanned-document.txt';
    a.click();
  }, [result]);

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">
          FreeAgentStore
        </a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
          Document Scanner
        </h1>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 gap-4">
        {state === 'idle' && (
          <div className="text-center py-12">
            <p className="text-neutral-400 mb-4">
              Photograph a document, get clean extracted text. ~130MB model download, cached for next time.
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
            <p className="text-neutral-400 mt-3 text-sm">Downloading TrOCR model... {progress}%</p>
          </div>
        )}

        {(state === 'ready' || state === 'scanning') && (
          <>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={pickFile}
              className="border-2 border-dashed border-neutral-700 rounded-lg p-8 text-center cursor-pointer hover:border-violet-500 transition-colors"
            >
              {state === 'scanning' ? (
                <div className="space-y-2">
                  <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-neutral-400">Scanning document...</p>
                </div>
              ) : (
                <p className="text-neutral-400">Drop a document image here, click to browse, or take a photo</p>
              )}
            </div>

            {imageUrl && (
              <div className="relative">
                <p className="text-xs text-neutral-500 mb-1">Preview</p>
                <img
                  src={imageUrl}
                  alt="Document preview"
                  className="rounded-lg max-h-64 w-full object-contain bg-neutral-900"
                />
                {state === 'scanning' && (
                  <div className="absolute inset-0 bg-neutral-950/60 rounded-lg flex items-center justify-center">
                    <p className="text-sm text-neutral-300">Scanning...</p>
                  </div>
                )}
              </div>
            )}

            {result && (
              <div className="space-y-3">
                {/* Stats */}
                <div className="flex flex-wrap gap-3 text-xs">
                  <span className="px-2 py-1 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">
                    {result.wordCount} words
                  </span>
                  <span className="px-2 py-1 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">
                    {result.paragraphs.length} paragraph{result.paragraphs.length !== 1 ? 's' : ''}
                  </span>
                  <span className="px-2 py-1 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">
                    {Math.round(result.confidence * 100)}% confidence
                  </span>
                  {result.language && (
                    <span className="px-2 py-1 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">
                      {result.language.toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Extracted text */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm text-neutral-500">Extracted Text</span>
                    <div className="flex gap-2">
                      <button
                        onClick={copyText}
                        className="text-xs px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400"
                      >
                        {copied ? 'Copied' : 'Copy Text'}
                      </button>
                      <button
                        onClick={downloadTxt}
                        className="text-xs px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400"
                      >
                        Download .txt
                      </button>
                    </div>
                  </div>
                  <div className="whitespace-pre-wrap text-neutral-200 leading-relaxed text-sm font-mono">
                    {result.text}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Powered by <a href="https://huggingface.co/Xenova/trocr-small-printed" className="underline">TrOCR</a> via Transformers.js.
        Images never leave your device.
      </footer>
    </div>
  );
}
