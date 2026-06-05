import { useState, useRef, useCallback } from 'react';

interface RecordedAction {
  type: string;
  timestamp: number;
  selector: string;
  tag: string;
  text?: string;
  value?: string;
}

export default function App() {
  const [recording, setRecording] = useState(false);
  const [actions, setActions] = useState<RecordedAction[]>([]);
  const [condensedCode, setCondensedCode] = useState('');
  const [condensing, setCondensing] = useState(false);
  const [replayResult, setReplayResult] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const cleanupRef = useRef<(() => RecordedAction[]) | null>(null);

  const startRecording = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) {
      alert('Load a same-origin page in the iframe first.');
      return;
    }

    const doc = iframe.contentDocument;
    const recorded: RecordedAction[] = [];
    const start = Date.now();

    function selectorFor(el: Element): string {
      if (el.id) return `#${el.id}`;
      const name = el.getAttribute('name');
      if (name) return `${el.tagName.toLowerCase()}[name="${name}"]`;
      const label = el.getAttribute('aria-label');
      if (label) return `[aria-label="${label}"]`;
      return el.tagName.toLowerCase();
    }

    function onClick(e: Event) {
      const el = e.target as HTMLElement;
      recorded.push({
        type: 'click',
        timestamp: Date.now() - start,
        selector: selectorFor(el),
        tag: el.tagName.toLowerCase(),
        text: el.innerText?.slice(0, 40),
      });
      setActions([...recorded]);
    }

    function onChange(e: Event) {
      const el = e.target as HTMLInputElement;
      recorded.push({
        type: el.tagName === 'SELECT' ? 'select' : 'fill',
        timestamp: Date.now() - start,
        selector: selectorFor(el),
        tag: el.tagName.toLowerCase(),
        value: el.value,
      });
      setActions([...recorded]);
    }

    doc.addEventListener('click', onClick, true);
    doc.addEventListener('change', onChange, true);

    cleanupRef.current = () => {
      doc.removeEventListener('click', onClick, true);
      doc.removeEventListener('change', onChange, true);
      return recorded;
    };

    setRecording(true);
    setActions([]);
    setCondensedCode('');
  }, []);

  const stopRecording = useCallback(() => {
    const final = cleanupRef.current?.() ?? [];
    cleanupRef.current = null;
    setRecording(false);
    setActions(final);
  }, []);

  const condense = useCallback(async () => {
    if (actions.length === 0) return;
    setCondensing(true);

    const lines = actions.map(a => {
      if (a.type === 'click') return `CLICK ${a.selector} // "${a.text ?? ''}"`;
      if (a.type === 'fill') return `FILL ${a.selector} = "${a.value}"`;
      if (a.type === 'select') return `SELECT ${a.selector} = "${a.value}"`;
      return `${a.type} ${a.selector}`;
    });

    const prompt = [
      'Condense these recorded browser actions into a clean async JavaScript function body.',
      'Use document.querySelector(). Add 100ms delays between actions.',
      'The function receives a `data` parameter for configurable values.',
      'Check if elements exist before acting. Return ONLY the function body code.',
      '',
      'Actions:',
      ...lines.map(l => `  ${l}`),
    ].join('\n');

    let code = '';
    try {
      const g = globalThis as any;
      const LM = g.LanguageModel ?? g.ai?.languageModel;
      if (LM?.create) {
        const session = await LM.create({ systemPrompt: 'You write clean JavaScript for browser automation. Return only code.' });
        code = await session.prompt(prompt);
        session.destroy?.();
      }
    } catch {}

    if (!code) {
      try {
        const r = await fetch('http://localhost:11434/api/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        });
        if (r.ok) code = (await r.json()).response;
      } catch {}
    }

    if (!code) {
      // Heuristic: generate basic replay code from actions
      code = actions.map(a => {
        const delay = 'await new Promise(r => setTimeout(r, 100));';
        if (a.type === 'click') return `${delay}\ndocument.querySelector('${a.selector}')?.click();`;
        if (a.type === 'fill') return `${delay}\nconst el = document.querySelector('${a.selector}');\nif (el) { el.value = data['${a.selector}'] ?? '${a.value}'; el.dispatchEvent(new Event('input', {bubbles:true})); }`;
        if (a.type === 'select') return `${delay}\nconst el = document.querySelector('${a.selector}');\nif (el) { el.value = '${a.value}'; el.dispatchEvent(new Event('change', {bubbles:true})); }`;
        return '';
      }).filter(Boolean).join('\n');
    }

    // Extract code from markdown fences if present
    const fence = code.match(/```(?:javascript|js)?\s*\n([\s\S]*?)\n```/);
    setCondensedCode(fence ? fence[1].trim() : code.trim());
    setCondensing(false);
  }, [actions]);

  const replay = useCallback(async () => {
    if (!condensedCode || !iframeRef.current?.contentDocument) return;
    setReplayResult('Running...');
    try {
      const doc = iframeRef.current.contentDocument;
      const script = doc.createElement('script');
      script.textContent = `(async function(data) { ${condensedCode} })({})`;
      doc.body.appendChild(script);
      doc.body.removeChild(script);
      setReplayResult('Replay complete.');
    } catch (e: any) {
      setReplayResult(`Error: ${e.message}`);
    }
  }, [condensedCode]);

  const loadUrl = useCallback(() => {
    if (!targetUrl.trim()) return;
    // Only same-origin URLs work (or use a proxy)
    if (iframeRef.current) {
      iframeRef.current.src = targetUrl;
    }
  }, [targetUrl]);

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col" style={{ fontFamily: "'Manrope',system-ui,sans-serif" }}>
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">FreeAgentStore</a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>Browser Automation</h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
          Record → Condense → Replay
        </span>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row" style={{ minHeight: 0 }}>
        {/* Left: controls + recording */}
        <div className="w-full lg:w-80 flex-shrink-0 p-4 border-r border-neutral-800 overflow-auto" style={{ maxHeight: 'calc(100vh - 52px)' }}>
          {/* URL bar */}
          <div className="flex gap-2 mb-3">
            <input value={targetUrl} onChange={e => setTargetUrl(e.target.value)}
              placeholder="Load a same-origin URL..."
              onKeyDown={e => e.key === 'Enter' && loadUrl()}
              className="flex-1 px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-xs" />
            <button onClick={loadUrl} className="px-3 py-2 rounded-lg bg-neutral-800 text-xs font-medium">Go</button>
          </div>

          {/* Record controls */}
          <div className="flex gap-2 mb-3">
            {recording ? (
              <button onClick={stopRecording} className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold">
                Stop Recording ({actions.length})
              </button>
            ) : (
              <button onClick={startRecording} className="flex-1 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold">
                Start Recording
              </button>
            )}
          </div>

          {/* Recorded actions */}
          {actions.length > 0 && (
            <div className="mb-3">
              <div className="text-xs text-neutral-500 mb-1">{actions.length} actions recorded</div>
              <div className="space-y-1 max-h-40 overflow-auto">
                {actions.map((a, i) => (
                  <div key={i} className="text-xs p-1.5 rounded bg-neutral-900 font-mono flex gap-2">
                    <span className="text-violet-400 w-10 flex-shrink-0">{a.type}</span>
                    <span className="text-neutral-400 truncate">{a.selector}</span>
                    {a.value && <span className="text-emerald-400 truncate">= "{a.value}"</span>}
                  </div>
                ))}
              </div>

              <button onClick={condense} disabled={condensing}
                className="w-full mt-2 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold disabled:opacity-40">
                {condensing ? 'Condensing...' : 'Condense to Code'}
              </button>
            </div>
          )}

          {/* Condensed code */}
          {condensedCode && (
            <div className="mb-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-neutral-500">Condensed code</span>
                <button onClick={() => navigator.clipboard.writeText(condensedCode)}
                  className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">Copy</button>
              </div>
              <pre className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-xs font-mono overflow-auto max-h-48 text-neutral-300">{condensedCode}</pre>
              <div className="flex gap-2 mt-2">
                <button onClick={replay} className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold">
                  Replay
                </button>
              </div>
              {replayResult && (
                <div className={`mt-1 text-xs ${replayResult.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`}>{replayResult}</div>
              )}
            </div>
          )}

          {!actions.length && !condensedCode && (
            <div className="text-xs text-neutral-600 mt-4">
              <p className="mb-2">How it works:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Load a same-origin page in the iframe</li>
                <li>Click "Start Recording"</li>
                <li>Interact with the page (click, fill forms)</li>
                <li>Click "Stop Recording"</li>
                <li>"Condense" → AI writes clean JS from your actions</li>
                <li>"Replay" → runs the code, no AI needed</li>
              </ol>
              <p className="mt-3 text-neutral-700">Works on same-origin pages. For cross-origin, use PAGS (server-side Playwright).</p>
            </div>
          )}
        </div>

        {/* Right: iframe */}
        <div className="flex-1 bg-neutral-900 relative">
          {recording && (
            <div className="absolute top-2 left-2 z-10 flex items-center gap-2 px-3 py-1 rounded-full bg-red-600 text-white text-xs font-semibold animate-pulse">
              Recording...
            </div>
          )}
          <iframe
            ref={iframeRef}
            className="w-full h-full border-none"
            style={{ minHeight: 500 }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            title="Automation target"
          />
        </div>
      </main>
    </div>
  );
}
