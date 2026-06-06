import { useState, useEffect, useCallback, useMemo } from 'react';

type Status = 'checking' | 'ready' | 'unavailable' | 'rewriting';

interface Style {
  id: string;
  label: string;
  prompt: string;
}

const STYLES: Style[] = [
  { id: 'formal', label: 'Formal', prompt: 'Rewrite the following text in a formal, professional business tone. Output ONLY the rewritten text, nothing else.' },
  { id: 'casual', label: 'Casual', prompt: 'Rewrite the following text in a casual, relaxed, friendly tone. Output ONLY the rewritten text, nothing else.' },
  { id: 'poetry', label: 'Poetry', prompt: 'Rewrite the following text as a rhyming poem. Output ONLY the poem, nothing else.' },
  { id: 'pirate', label: 'Pirate', prompt: 'Rewrite the following text as a pirate would say it. Use "Arr!", "matey", etc. Output ONLY the rewritten text, nothing else.' },
  { id: 'eli5', label: 'ELI5', prompt: 'Rewrite the following text as if explaining it to a 5-year-old. Use simple words and short sentences. Output ONLY the rewritten text, nothing else.' },
  { id: 'genz', label: 'Gen Z', prompt: 'Rewrite the following text using Gen Z slang. Use "no cap", "lowkey", "fr", "slay", "bestie", "vibe check", "its giving". Output ONLY the rewritten text, nothing else.' },
  { id: 'shakespeare', label: 'Shakespearean', prompt: 'Rewrite the following text in Shakespearean English. Use "thou", "thee", "henceforth", "verily", "forsooth". Output ONLY the rewritten text, nothing else.' },
  { id: 'sarcastic', label: 'Sarcastic', prompt: 'Rewrite the following text dripping with sarcasm. Be witty and ironic. Output ONLY the rewritten text, nothing else.' },
  { id: 'haiku', label: 'Haiku', prompt: 'Rewrite the following text as one or more haiku poems (5-7-5 syllable pattern). Output ONLY the haiku, nothing else.' },
  { id: 'dramatic', label: 'Dramatic', prompt: 'Rewrite the following text in an overly dramatic, theatrical narration style. Make everything sound epic and consequential. Output ONLY the rewritten text, nothing else.' },
  { id: 'bullets', label: 'Bullet Points', prompt: 'Rewrite the following text as a concise bullet-point list. Output ONLY the bullet points, nothing else.' },
  { id: 'tweet', label: 'Tweet', prompt: 'Rewrite the following text as a tweet under 280 characters. Be punchy and concise. Output ONLY the tweet, nothing else.' },
  { id: 'custom', label: 'Custom', prompt: '' },
];

const SYSTEM_PROMPT = 'You are a text rewriter. Output ONLY the rewritten text in the requested style. No commentary, no explanations, no preamble.';
const MAX_INPUT = 1000;

interface HistoryEntry {
  input: string;
  output: string;
  style: string;
  timestamp: number;
  elapsed: number;
}

function loadHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem('text-rewriter-history') ?? '[]'); } catch { return []; }
}
function saveHistory(h: HistoryEntry[]) { localStorage.setItem('text-rewriter-history', JSON.stringify(h.slice(0, 10))); }

function estimateTime(len: number): string {
  if (len < 100) return '3-8 seconds';
  if (len < 300) return '5-12 seconds';
  return '8-15 seconds';
}

function renderMarkdown(text: string): string {
  let html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h4 style="font-weight:700;margin:0.75rem 0 0.25rem">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="font-weight:700;margin:0.75rem 0 0.25rem">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^\* (.+)$/gm, '<li style="margin-left:1rem;list-style:disc;margin-bottom:0.25rem">$1</li>')
    .replace(/^- (.+)$/gm, '<li style="margin-left:1rem;list-style:disc;margin-bottom:0.25rem">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li style="margin-left:1rem;list-style:decimal;margin-bottom:0.25rem">$1</li>')
    .replace(/`([^`]+)`/g, '<code style="background:#262626;padding:0.1rem 0.3rem;border-radius:3px;font-size:0.85em">$1</code>')
    .replace(/\n\n/g, '</p><p style="margin:0.5rem 0">')
    .replace(/\n/g, '<br/>');
  return `<p style="margin:0">${html}</p>`;
}

export default function App() {
  const [status, setStatus] = useState<Status>('checking');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [activeStyle, setActiveStyle] = useState<string>('formal');
  const [customInstruction, setCustomInstruction] = useState('');
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

  const rewrite = useCallback(async () => {
    if (!input.trim()) return;
    setStatus('rewriting');
    setOutput('');
    setResponseTime(null);
    setCopied(false);

    const style = STYLES.find(s => s.id === activeStyle)!;
    const prompt = activeStyle === 'custom'
      ? (customInstruction.trim() || 'Rewrite the following text. Output ONLY the rewritten text, nothing else.')
      : style.prompt;

    const start = performance.now();

    try {
      const g = globalThis as any;
      const LM = g.LanguageModel ?? g.ai?.languageModel;
      if (!LM?.create) { setStatus('unavailable'); return; }

      const session = await LM.create({ systemPrompt: SYSTEM_PROMPT });
      const result = await session.prompt(prompt + '\n\nText:\n' + input);
      session.destroy?.();

      const elapsed = Math.round(performance.now() - start);
      setResponseTime(elapsed);
      setOutput(result.trim());
      setStatus('ready');

      setHistory(prev => [{
        input: input.slice(0, 80),
        output: result.trim().slice(0, 120),
        style: style.label,
        timestamp: Date.now(),
        elapsed,
      }, ...prev].slice(0, 10));
    } catch (err: any) {
      setOutput(`Error: ${err.message}`);
      setStatus('ready');
    }
  }, [input, activeStyle, customInstruction]);

  const renderedOutput = useMemo(() => {
    if (!output) return null;
    return renderMarkdown(output);
  }, [output]);

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
          Text Rewriter requires Chrome's built-in Gemini Nano model. Enable it at <code className="bg-neutral-800 px-1.5 py-0.5 rounded text-xs">chrome://flags &rarr; Prompt API for Gemini Nano</code> or use Chrome 138+.
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
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>Text Rewriter</h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-emerald-900/40 text-emerald-400">
          {status === 'checking' ? 'Checking...' : status === 'rewriting' ? 'Rewriting...' : 'Gemini Nano ready'}
        </span>
      </header>

      <main className="flex-1 flex flex-col max-w-5xl mx-auto w-full p-4 gap-4">
        {/* Explanation */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <p className="text-sm text-neutral-300 leading-relaxed">
            Rewrite any text in a different style. Paste text, pick a style, get a rewrite. Uses Chrome <a href="https://deepmind.google/technologies/gemini/nano/" target="_blank" rel="noopener" className="underline hover:text-neutral-200">Gemini Nano</a> — runs on your device, nothing sent to any server.
          </p>
        </div>

        {/* Style pills */}
        <div>
          <label className="text-xs text-neutral-500 mb-1.5 block">Pick a style</label>
          <div className="flex flex-wrap gap-1.5">
            {STYLES.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveStyle(s.id)}
                disabled={status === 'rewriting'}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  activeStyle === s.id
                    ? 'bg-violet-600 border-violet-500 text-white'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200'
                } disabled:opacity-50`}
              >
                {s.label}
              </button>
            ))}
          </div>
          {activeStyle === 'custom' && (
            <input
              value={customInstruction}
              onChange={e => setCustomInstruction(e.target.value)}
              placeholder="e.g. 'Rewrite as a recipe with cooking metaphors'"
              maxLength={200}
              className="mt-2 w-full max-w-lg px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-sm focus:outline-none focus:border-violet-600 placeholder:text-neutral-700"
            />
          )}
        </div>

        {/* Two-panel layout */}
        <div className="flex-1 flex flex-col lg:flex-row gap-4">
          {/* Input */}
          <div className="flex-1 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-neutral-400">Input text</label>
              <span className="text-xs text-neutral-600">{input.length}/{MAX_INPUT}</span>
            </div>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value.slice(0, MAX_INPUT))}
              placeholder="Paste or type text to rewrite..."
              disabled={status === 'rewriting'}
              className="flex-1 min-h-[200px] p-4 rounded-lg bg-neutral-900 border border-neutral-800 resize-none focus:outline-none focus:border-violet-600 text-neutral-100 placeholder:text-neutral-600 text-sm disabled:opacity-50"
            />
            <button
              onClick={rewrite}
              disabled={!input.trim() || status === 'rewriting'}
              className="px-4 py-2.5 rounded-lg font-semibold text-white disabled:opacity-40 bg-violet-600 hover:bg-violet-500 transition-colors"
            >
              {status === 'rewriting' ? (
                <span className="flex items-center gap-2 justify-center">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  Rewriting...
                </span>
              ) : 'Rewrite'}
            </button>
          </div>

          {/* Output */}
          <div className="flex-1 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-neutral-400">
                Rewritten
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
            <div className="flex-1 p-4 rounded-lg bg-neutral-900 border border-neutral-800 text-sm min-h-[200px]">
              {status === 'rewriting' ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                  <svg className="animate-spin h-8 w-8 text-violet-400" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  <p className="text-violet-400 text-sm">Gemini Nano is rewriting... {estimateTime(input.length)}</p>
                  <p className="text-neutral-600 text-xs max-w-xs">Running locally on your device. Model: Gemini Nano (~1.8B params).</p>
                </div>
              ) : output && renderedOutput ? (
                <div dangerouslySetInnerHTML={{ __html: renderedOutput }} className="leading-relaxed whitespace-pre-wrap" />
              ) : (
                <span className="text-neutral-600">Rewritten text will appear here. Enter text, pick a style, and click Rewrite.</span>
              )}
            </div>
          </div>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs text-neutral-500 hover:text-neutral-300 flex items-center gap-1"
            >
              <span>{showHistory ? '▼' : '▶'}</span>
              Previous rewrites ({history.length})
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
                      {entry.style} &middot; {(entry.elapsed / 1000).toFixed(1)}s &middot; {timeAgo(entry.timestamp)}
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
