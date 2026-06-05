import { useState, useRef, useCallback } from 'react';
import { initModel, scanReceipt, type ReceiptResult } from './scanner';

type State = 'idle' | 'loading' | 'ready' | 'scanning';
type Stage = 'Reading text...' | 'Parsing receipt...';

export default function App() {
  const [state, setState] = useState<State>('idle');
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<Stage>('Reading text...');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [result, setResult] = useState<ReceiptResult | null>(null);
  const [showRaw, setShowRaw] = useState(false);
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
    setShowRaw(false);
    setCopied(false);
    setStage('Reading text...');

    const url = URL.createObjectURL(file);
    setImageUrl(url);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;

    img.onload = async () => {
      try {
        setStage('Reading text...');
        // Small delay so UI updates
        await new Promise((r) => setTimeout(r, 50));
        setStage('Parsing receipt...');
        const scanResult = await scanReceipt(img);
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

  const exportCSV = useCallback(() => {
    if (!result) return;
    const rows = [['Item', 'Qty', 'Price']];
    for (const item of result.items) {
      rows.push([item.name, String(item.quantity), item.price.toFixed(2)]);
    }
    if (result.subtotal != null) rows.push(['Subtotal', '', result.subtotal.toFixed(2)]);
    if (result.tax != null) rows.push(['Tax', '', result.tax.toFixed(2)]);
    if (result.total != null) rows.push(['Total', '', result.total.toFixed(2)]);

    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'receipt.csv';
    a.click();
  }, [result]);

  const copyJSON = useCallback(() => {
    if (!result) return;
    const { rawText: _, ...clean } = result;
    navigator.clipboard.writeText(JSON.stringify(clean, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">
          FreeAgentStore
        </a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
          Receipt Scanner
        </h1>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 gap-4">
        {state === 'idle' && (
          <div className="text-center py-12">
            <p className="text-neutral-400 mb-4">
              Photograph a receipt, get structured data. ~130MB model download, cached for next time.
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
                  <p className="text-neutral-400">{stage}</p>
                </div>
              ) : (
                <p className="text-neutral-400">Drop a receipt image here, click to browse, or take a photo</p>
              )}
            </div>

            {imageUrl && (
              <div className="relative">
                <p className="text-xs text-neutral-500 mb-1">Preview</p>
                <img
                  src={imageUrl}
                  alt="Receipt preview"
                  className="rounded-lg max-h-48 w-full object-contain bg-neutral-900"
                />
                {state === 'scanning' && (
                  <div className="absolute inset-0 bg-neutral-950/60 rounded-lg flex items-center justify-center">
                    <p className="text-sm text-neutral-300">{stage}</p>
                  </div>
                )}
              </div>
            )}

            {result && (
              <div className="space-y-3">
                {/* Merchant + Date header */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h2 className="text-lg font-semibold text-neutral-100">
                        {result.merchant || 'Unknown Merchant'}
                      </h2>
                      {result.date && (
                        <p className="text-sm text-neutral-400 mt-0.5">{result.date}</p>
                      )}
                    </div>
                    <span className="text-xs px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-neutral-400">
                      {Math.round(result.confidence * 100)}% confidence
                    </span>
                  </div>

                  {/* Line items */}
                  {result.items.length > 0 ? (
                    <div className="border-t border-neutral-800 pt-3">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-neutral-500 text-xs">
                            <th className="text-left pb-2 font-medium">Item</th>
                            <th className="text-center pb-2 font-medium w-12">Qty</th>
                            <th className="text-right pb-2 font-medium w-20">Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.items.map((item, i) => (
                            <tr key={i} className="border-t border-neutral-800/50">
                              <td className="py-1.5 text-neutral-200">{item.name}</td>
                              <td className="py-1.5 text-center text-neutral-400">{item.quantity}</td>
                              <td className="py-1.5 text-right text-neutral-200 font-mono">
                                {result.currency}{item.price.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-500 border-t border-neutral-800 pt-3">
                      No line items detected.
                    </p>
                  )}

                  {/* Totals */}
                  {(result.subtotal != null || result.tax != null || result.total != null) && (
                    <div className="border-t border-neutral-800 pt-3 mt-3 space-y-1">
                      {result.subtotal != null && (
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Subtotal</span>
                          <span className="font-mono text-neutral-200">{result.currency}{result.subtotal.toFixed(2)}</span>
                        </div>
                      )}
                      {result.tax != null && (
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Tax</span>
                          <span className="font-mono text-neutral-200">{result.currency}{result.tax.toFixed(2)}</span>
                        </div>
                      )}
                      {result.total != null && (
                        <div className="flex justify-between text-sm font-semibold">
                          <span className="text-neutral-200">Total</span>
                          <span className="font-mono text-neutral-100">{result.currency}{result.total.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={exportCSV}
                    className="text-xs px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400"
                  >
                    Export CSV
                  </button>
                  <button
                    onClick={copyJSON}
                    className="text-xs px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400"
                  >
                    {copied ? 'Copied' : 'Copy JSON'}
                  </button>
                  <button
                    onClick={() => setShowRaw(!showRaw)}
                    className="text-xs px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400"
                  >
                    {showRaw ? 'Hide' : 'Show'} Raw Text
                  </button>
                </div>

                {/* Raw OCR text */}
                {showRaw && (
                  <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                    <p className="text-xs text-neutral-500 mb-2">Raw OCR Output</p>
                    <pre className="whitespace-pre-wrap text-neutral-300 text-xs font-mono leading-relaxed">
                      {result.rawText || '(empty)'}
                    </pre>
                  </div>
                )}
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
