import { useState, useRef, useCallback } from 'react';

type State = 'idle' | 'loading' | 'ready' | 'transcribing';

export default function App() {
  const [state, setState] = useState<State>('idle');
  const [progress, setProgress] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [fileName, setFileName] = useState('');
  const workerRef = useRef<Worker | null>(null);

  const init = useCallback(() => {
    setState('loading');
    const w = new Worker('/whisper-worker.js', { type: 'module' });
    workerRef.current = w;
    w.onmessage = (e) => {
      if (e.data.type === 'progress') setProgress(e.data.pct);
      if (e.data.type === 'ready') setState('ready');
      if (e.data.type === 'result') {
        setTranscript(e.data.text);
        setState('ready');
      }
      if (e.data.type === 'error') {
        console.error(e.data.error);
        setState('ready');
      }
    };
    w.postMessage({ type: 'init' });
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (!workerRef.current || state !== 'ready') return;
    setState('transcribing');
    setTranscript('');
    setFileName(file.name);
    const arrayBuffer = await file.arrayBuffer();
    const audioData = new Float32Array(arrayBuffer);
    workerRef.current.postMessage(
      { type: 'transcribe', id: crypto.randomUUID(), audio: audioData },
      [audioData.buffer],
    );
  }, [state]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">
          FreeAgentStore
        </a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
          Transcriber
        </h1>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 gap-4">
        {state === 'idle' && (
          <div className="text-center py-12">
            <p className="text-neutral-400 mb-4">
              Transcribe audio to text using Whisper AI. ~244MB model download, cached for next time.
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
            <p className="text-neutral-400 mt-3 text-sm">Downloading Whisper... {progress}%</p>
          </div>
        )}

        {(state === 'ready' || state === 'transcribing') && (
          <>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-neutral-700 rounded-lg p-8 text-center cursor-pointer hover:border-violet-500 transition-colors"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'audio/*';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) handleFile(file);
                };
                input.click();
              }}
            >
              {state === 'transcribing' ? (
                <p className="text-neutral-400">Transcribing {fileName}...</p>
              ) : (
                <p className="text-neutral-400">Drop an audio file here or click to browse</p>
              )}
            </div>

            {transcript && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-neutral-500">{fileName}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(transcript)}
                    className="text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400"
                  >
                    Copy
                  </button>
                </div>
                <p className="whitespace-pre-wrap text-neutral-200 leading-relaxed">{transcript}</p>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Powered by <a href="https://huggingface.co/openai/whisper-small" className="underline">Whisper</a> via Transformers.js.
        Audio never leaves your device.
      </footer>
    </div>
  );
}
