import { useState, useEffect, useCallback } from 'react';

type Status = 'checking' | 'ready' | 'unavailable' | 'translating';

const LANGUAGES = [
  'Auto-detect', 'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese',
  'Dutch', 'Polish', 'Czech', 'Swedish', 'Norwegian', 'Danish', 'Finnish',
  'Turkish', 'Russian', 'Ukrainian', 'Arabic', 'Hindi', 'Chinese (Simplified)',
  'Japanese', 'Korean', 'Thai', 'Vietnamese', 'Indonesian', 'Malay',
  'Tagalog', 'Swahili', 'Greek',
];

const SYSTEM_PROMPT = 'You are a translator. Output ONLY the translation, nothing else. No explanations, no alternatives, no commentary.';
const MAX_INPUT = 500;

interface HistoryEntry {
  input: string;
  output: string;
  from: string;
  to: string;
  timestamp: number;
  elapsed: number;
}

function loadHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem('nano-translator-history') ?? '[]'); } catch { return []; }
}
function saveHistory(h: HistoryEntry[]) { localStorage.setItem('nano-translator-history', JSON.stringify(h.slice(0, 10))); }

function estimateTime(len: number): string {
  if (len < 50) return '3-8 seconds';
  if (len < 200) return '5-12 seconds';
  return '8-15 seconds';
}

export default function App() {
  const [status, setStatus] = useState<Status>('checking');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [sourceLang, setSourceLang] = useState('Auto-detect');
  const [targetLang, setTargetLang] = useState('English');
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);
  const [responseTime, setResponseTime] = useState<number | null>(null);

  useEffect(() => { saveHistory(history); }, [history]);

  useEffect(() => {
    const g = globalThis as any;
    const LM = g.LanguageModel ?? g.ai?.languageModel;
    setStatus(LM?.create ? 'ready' : 'unavailable');
  }, []);

  const swapLanguages = useCallback(() => {
    if (sourceLang === 'Auto-detect') return;
    const prevSource = sourceLang;
    const prevTarget = targetLang;
    setSourceLang(prevTarget);
    setTargetLang(prevSource);
    if (output) {
      setInput(output);
      setOutput('');
      setResponseTime(null);
      setCopied(false);
    }
  }, [sourceLang, targetLang, output]);

  const translate = useCallback(async () => {
    if (!input.trim()) return;
    setStatus('translating');
    setOutput('');
    setResponseTime(null);
    setCopied(false);

    const userPrompt = sourceLang === 'Auto-detect'
      ? `Translate the following text to ${targetLang}. Output ONLY the translation.\n\nText: ${input}`
      : `Translate the following text from ${sourceLang} to ${targetLang}. Output ONLY the translation.\n\nText: ${input}`;

    const start = performance.now();

    try {
      const g = globalThis as any;
      const LM = g.LanguageModel ?? g.ai?.languageModel;
      if (!LM?.create) { setStatus('unavailable'); return; }

      const session = await LM.create({ systemPrompt: SYSTEM_PROMPT });
      const result = await session.prompt(userPrompt);
      session.destroy?.();

      const elapsed = Math.round(performance.now() - start);
      setResponseTime(elapsed);
      setOutput(result.trim());
      setStatus('ready');

      setHistory(prev => [{
        input: input.slice(0, 60),
        output: result.trim().slice(0, 80),
        from: sourceLang,
        to: targetLang,
        timestamp: Date.now(),
        elapsed,
      }, ...prev].slice(0, 10));
    } catch (err: any) {
      setOutput(`Error: ${err.message}`);
      setStatus('ready');
    }
  }, [input, sourceLang, targetLang]);

  const timeAgo = (ts: number) => {
    const mins = Math.floor((Date.now() - ts) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  if (status === 'unavailable') {
    return (
      <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="text-4xl mb-4">:/</div>
        <h1 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-serif)' }}>Chrome AI Not Available</h1>
        <p className="text-neutral-400 text-sm max-w-md mb-4">
          Nano Translator requires Chrome's built-in Gemini Nano model. Enable it at <code className="bg-neutral-800 px-1.5 py-0.5 rounded text-xs">chrome://flags &rarr; Prompt API for Gemini Nano</code> or use Chrome 138+.
        </p>
        <a href="https://developer.chrome.com/docs/ai/built-in" target="_blank" rel="noopener" className="text-violet-400 underline text-sm">Learn about Chrome Built-in AI</a>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800 shrink-0">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">FreeAgentStore</a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>Nano Translator</h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-emerald-900/40 text-emerald-400">
          {status === 'checking' ? 'Checking...' : status === 'translating' ? 'Translating...' : 'Gemini Nano ready'}
        </span>
      </header>

      <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-4 gap-4">
        {/* Explanation */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <p className="text-sm text-neutral-300 leading-relaxed">
            Translate text between 28 languages. Uses Chrome <a href="https://deepmind.google/technologies/gemini/nano/" target="_blank" rel="noopener" className="underline hover:text-neutral-200">Gemini Nano</a> — runs on your device, nothing sent to any server. Quality varies — best for short texts and common languages.
          </p>
        </div>

        {/* Language selectors + swap */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <label className="text-xs text-neutral-500 mb-1 block">From</label>
            <select
              value={sourceLang}
              onChange={e => setSourceLang(e.target.value)}
              disabled={status === 'translating'}
              className="w-full px-3 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-sm disabled:opacity-50 focus:outline-none focus:border-violet-600"
            >
              {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          <button
            onClick={swapLanguages}
            disabled={sourceLang === 'Auto-detect' || status === 'translating'}
            className="mt-5 w-10 h-10 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200 flex items-center justify-center disabled:opacity-30 shrink-0 transition-colors"
            title="Swap languages"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </button>

          <div className="flex-1">
            <label className="text-xs text-neutral-500 mb-1 block">To</label>
            <select
              value={targetLang}
              onChange={e => setTargetLang(e.target.value)}
              disabled={status === 'translating'}
              className="w-full px-3 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-sm disabled:opacity-50 focus:outline-none focus:border-violet-600"
            >
              {LANGUAGES.filter(l => l !== 'Auto-detect').map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>

        {/* Input */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm text-neutral-400">Source text</label>
            <span className="text-xs text-neutral-600">{input.length}/{MAX_INPUT}</span>
          </div>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value.slice(0, MAX_INPUT))}
            placeholder="Type or paste text to translate..."
            disabled={status === 'translating'}
            className="min-h-[140px] p-4 rounded-lg bg-neutral-900 border border-neutral-800 resize-none focus:outline-none focus:border-violet-600 text-neutral-100 placeholder:text-neutral-600 text-sm disabled:opacity-50"
          />
          <button
            onClick={translate}
            disabled={!input.trim() || status === 'translating'}
            className="px-4 py-2.5 rounded-lg font-semibold text-white disabled:opacity-40 bg-violet-600 hover:bg-violet-500 transition-colors"
          >
            {status === 'translating' ? (
              <span className="flex items-center gap-2 justify-center">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                Translating...
              </span>
            ) : 'Translate'}
          </button>
        </div>

        {/* Output */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm text-neutral-400">
              Translation
              {responseTime !== null && (
                <span className="text-neutral-600 ml-2 text-xs">{(responseTime / 1000).toFixed(1)}s</span>
              )}
            </label>
            {output && (
              <button
                onClick={() => { navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                className="text-xs text-violet-400 hover:text-violet-300"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            )}
          </div>
          <div className="min-h-[140px] p-4 rounded-lg bg-neutral-900 border border-neutral-800 text-sm whitespace-pre-wrap">
            {status === 'translating' ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-8">
                <svg className="animate-spin h-8 w-8 text-violet-400" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                <p className="text-violet-400 text-sm">Translating with Gemini Nano... {estimateTime(input.length)}</p>
                <p className="text-neutral-600 text-xs max-w-xs">Running locally on your device. Model: Gemini Nano (~1.8B params).</p>
              </div>
            ) : output ? (
              <span>{output}</span>
            ) : (
              <span className="text-neutral-600">Translation will appear here. Enter text, pick languages, and click Translate.</span>
            )}
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-[11px] text-neutral-600 leading-relaxed">
          Nano is a small model (1.8B params). Translations may be approximate, especially for rare languages or long texts. For critical translations, use a professional service.
        </p>

        {/* History */}
        {history.length > 0 && (
          <div>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs text-neutral-500 hover:text-neutral-300 flex items-center gap-1"
            >
              <span>{showHistory ? '▼' : '▶'}</span>
              Previous translations ({history.length})
            </button>
            {showHistory && (
              <div className="mt-2 space-y-2">
                {history.map((entry, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-neutral-900 border border-neutral-800 text-left"
                  >
                    <p className="text-xs text-neutral-300 truncate">{entry.input}...</p>
                    <p className="text-xs text-neutral-500 truncate mt-0.5">{entry.output}...</p>
                    <p className="text-[10px] text-neutral-600 mt-0.5">
                      {entry.from} &rarr; {entry.to} &middot; {(entry.elapsed / 1000).toFixed(1)}s &middot; {timeAgo(entry.timestamp)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Uses Chrome Built-in AI (Gemini Nano). Zero download, 100% private.
        <a href="https://developer.chrome.com/docs/ai/built-in" target="_blank" rel="noopener" className="underline ml-1">Chrome AI docs</a>
      </footer>
    </div>
  );
}
