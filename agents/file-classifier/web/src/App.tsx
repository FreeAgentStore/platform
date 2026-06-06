import { useState, useCallback } from 'react';
import { classifyBlob, classifyFile, type FileClassification } from './heuristic';

const CAT_COLORS: Record<string, string> = {
  image: 'text-pink-400', audio: 'text-amber-400', video: 'text-red-400',
  document: 'text-blue-400', archive: 'text-orange-400', code: 'text-emerald-400',
  data: 'text-cyan-400', font: 'text-violet-400', executable: 'text-red-500',
  unknown: 'text-neutral-400',
};

export default function App() {
  const [result, setResult] = useState<FileClassification | null>(null);
  const [fileName, setFileName] = useState('');
  const [hexPreview, setHexPreview] = useState('');
  const [dragging, setDragging] = useState(false);

  const analyze = useCallback(async (file: File) => {
    setFileName(file.name);
    const r = await classifyBlob(file);
    setResult(r);

    // Hex preview of first 64 bytes
    const slice = await file.slice(0, 64).arrayBuffer();
    const bytes = new Uint8Array(slice);
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
    const ascii = Array.from(bytes).map(b => b >= 0x20 && b <= 0x7E ? String.fromCharCode(b) : '.').join('');
    setHexPreview(`${hex}\n${ascii}`);
  }, []);

  const analyzeText = useCallback((text: string) => {
    setFileName('(pasted text)');
    const bytes = new TextEncoder().encode(text);
    setResult(classifyFile(bytes));
    setHexPreview('');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) analyze(file);
  }, [analyze]);

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">FreeAgentStore</a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>File Classifier</h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">80+ formats</span>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 gap-4">
        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
            dragging ? 'border-violet-500 bg-violet-950/20' : 'border-neutral-800 hover:border-neutral-600'
          }`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.onchange = () => { if (input.files?.[0]) analyze(input.files[0]); };
            input.click();
          }}
        >
          <div className="text-neutral-400 text-sm">Drop any file here or click to browse</div>
          <div className="text-neutral-600 text-xs mt-1">Reads only the first 8KB — file never leaves your device</div>
        </div>

        {/* Or paste text */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-600">or paste raw bytes:</span>
          <input
            type="text"
            placeholder="Paste file content or text..."
            className="flex-1 px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs focus:outline-none focus:border-violet-600"
            onKeyDown={e => {
              if (e.key === 'Enter') analyzeText((e.target as HTMLInputElement).value);
            }}
          />
        </div>

        {/* Result */}
        {result && (
          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-neutral-900 border border-neutral-800">
              <div className="flex items-center gap-3 mb-2">
                <span className={`text-2xl font-bold ${CAT_COLORS[result.category] ?? 'text-neutral-400'}`}>
                  {result.format}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">{result.category}</span>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <div><span className="text-neutral-500">MIME:</span> <span className="font-mono text-neutral-300">{result.mime}</span></div>
                <div><span className="text-neutral-500">Extension:</span> <span className="font-mono text-neutral-300">.{result.extension}</span></div>
                <div><span className="text-neutral-500">Method:</span> <span className="text-neutral-300">{result.method}</span></div>
                <div><span className="text-neutral-500">Text:</span> <span className="text-neutral-300">{result.isText ? 'Yes' : 'No'}</span></div>
                <div>
                  <span className="text-neutral-500">Confidence:</span>
                  <span className={`ml-1 font-mono ${
                    result.confidence > 0.8 ? 'text-emerald-400' : result.confidence > 0.5 ? 'text-amber-400' : 'text-neutral-400'
                  }`}>{(result.confidence * 100).toFixed(0)}%</span>
                </div>
                {fileName && <div><span className="text-neutral-500">File:</span> <span className="text-neutral-300 truncate">{fileName}</span></div>}
              </div>

              {result.alternatives.length > 0 && (
                <div className="mt-3 pt-2 border-t border-neutral-800">
                  <span className="text-xs text-neutral-500">Also possible:</span>
                  {result.alternatives.map((a, i) => (
                    <span key={i} className="ml-2 text-xs text-neutral-400">{a.format} ({(a.confidence * 100).toFixed(0)}%)</span>
                  ))}
                </div>
              )}
            </div>

            {hexPreview && (
              <div className="p-3 rounded-lg bg-neutral-900 border border-neutral-800">
                <div className="text-xs text-neutral-500 mb-1">First 64 bytes</div>
                <pre className="font-mono text-[10px] text-neutral-400 whitespace-pre-wrap break-all">{hexPreview}</pre>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Magic bytes + structural patterns + statistical heuristics. Zero model, sub-millisecond, 80+ formats.
      </footer>
    </div>
  );
}
