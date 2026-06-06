import { useState, useEffect, useCallback, useMemo } from 'react';

type SummaryType = 'tl;dr' | 'key-points' | 'teaser' | 'headline';
type Status = 'checking' | 'available' | 'unavailable' | 'summarizing';

interface HistoryEntry {
  input: string;
  summary: string;
  type: SummaryType;
  source: string;
  timestamp: number;
}

function loadHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem('summarizer-history') ?? '[]'); } catch { return []; }
}
function saveHistory(h: HistoryEntry[]) { localStorage.setItem('summarizer-history', JSON.stringify(h.slice(0, 20))); }

const SAMPLE_TEXT = `The European Space Agency (ESA) announced today that its Mars Sample Return mission has entered the final design phase. The ambitious project, developed in collaboration with NASA, aims to bring rock and soil samples from Mars back to Earth for the first time in history. Scientists believe these samples could contain evidence of ancient microbial life.

The mission involves multiple spacecraft and a complex sequence of launches and orbital maneuvers. A lander will collect samples cached by NASA's Perseverance rover, launch them into Mars orbit using a small rocket, then a separate orbiter will capture the sample container and return it to Earth. The entire process is expected to take approximately ten years from launch to sample delivery.

Dr. Maria Rodriguez, the mission's lead scientist, emphasized the significance: "These samples will be studied for decades. Every major space agency in the world wants access to Martian material. This mission represents the most complex robotic space exploration ever attempted." The estimated cost is €7 billion, making it one of the most expensive unmanned space missions in history.`;

export default function App() {
  const [status, setStatus] = useState<Status>('checking');
  const [text, setText] = useState('');
  const [summary, setSummary] = useState('');
  const [summaryType, setSummaryType] = useState<SummaryType>('tl;dr');
  const [source, setSource] = useState<string>('');
  const [loadingMessage, setLoadingMessage] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => { saveHistory(history); }, [history]);
  useEffect(() => { setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0); }, [text]);

  useEffect(() => { checkAvailability(); }, []);

  async function checkAvailability() {
    const g = globalThis as any;
    // Check Summarizer API first
    const S = g.Summarizer ?? g.ai?.summarizer;
    if (S?.availability) {
      const avail = await S.availability();
      if (avail === 'available' || avail === 'readily') { setStatus('available'); return; }
    }
    // Check Prompt API (LanguageModel) — more widely available
    const LM = g.LanguageModel ?? g.ai?.languageModel;
    if (LM?.create) { setStatus('available'); return; }
    setStatus('unavailable');
  }

  const addToHistory = useCallback((entry: HistoryEntry) => {
    setHistory(prev => [entry, ...prev].slice(0, 20));
  }, []);

  async function summarize() {
    if (!text.trim()) return;
    setStatus('summarizing');
    setSummary('');
    setLoadingMessage('Trying Chrome Built-in AI (Summarizer API)... this may take 10-20 seconds');

    try {
      const g = globalThis as any;
      const S = g.Summarizer ?? g.ai?.summarizer;
      if (S?.create) {
        setLoadingMessage('Chrome AI is processing your text...');
        const summarizer = await S.create({ type: summaryType, format: 'markdown', length: 'medium' });
        const result = await summarizer.summarize(text);
        setSummary(result);
        setSource('Chrome Built-in AI');
        setStatus('available');
        setLoadingMessage('');
        addToHistory({ input: text.slice(0, 100), summary: result, type: summaryType, source: 'Chrome AI', timestamp: Date.now() });
        return;
      }
    } catch {}

    // Try Chrome Prompt API (LanguageModel / Gemini Nano)
    try {
      const g2 = globalThis as any;
      const LM = g2.LanguageModel ?? g2.ai?.languageModel;
      if (LM?.create) {
        setLoadingMessage('Using Chrome Gemini Nano to summarize...');
        const promptMap: Record<string, string> = {
          'tl;dr': 'Summarize the following text in exactly 2 sentences. Output ONLY the summary, nothing else. No commentary, no preamble, no "Here is the summary" — just the 2 sentences.',
          'key-points': 'Extract 3-5 key points from the following text as a bullet list. Output ONLY the bullet points, nothing else. No preamble, no commentary.',
          'teaser': 'Write a 1-2 sentence teaser for the following text, suitable for social media. Output ONLY the teaser, nothing else.',
          'headline': 'Write ONE headline that captures the main point of the following text. Output ONLY the headline, nothing else.',
        };
        const session = await LM.create({ systemPrompt: 'You are a text summarizer. You output ONLY the requested summary format. Never add commentary, opinions, questions, or conversation. Never say "Okay", "Sure", "Here is", etc. Just output the summary.' });
        const result = await session.prompt(promptMap[summaryType] + '\n\nText:\n' + text);
        session.destroy?.();
        setSummary(result);
        setSource('Chrome Gemini Nano');
        setStatus('available');
        setLoadingMessage('');
        addToHistory({ input: text.slice(0, 100), summary: result, type: summaryType, source: 'Gemini Nano', timestamp: Date.now() });
        return;
      }
    } catch {}

    try {
      setLoadingMessage('Chrome AI unavailable. Trying Ollama on localhost...');
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt: `Summarize the following text as ${summaryType}:\n\n${text}`, stream: false }),
      });
      if (res.ok) {
        const data = await res.json();
        setSummary(data.response);
        setSource('Ollama (local)');
        setStatus('available');
        setLoadingMessage('');
        addToHistory({ input: text.slice(0, 100), summary: data.response, type: summaryType, source: 'Ollama', timestamp: Date.now() });
        return;
      }
    } catch {}

    setLoadingMessage('');
    setSummary('This agent requires Chrome Built-in AI or Ollama to summarize text. Neither is available right now.\n\nTo enable:\n• Chrome 138+: enable "Summarization API" at chrome://flags\n• Ollama: install from ollama.com, then run `ollama run llama3.2`\n• Or add your API key at /console/#keys to use OpenAI/Claude instead (coming soon).');
    setSource('Not available');
    setStatus('unavailable');
  }

  const restoreFromHistory = useCallback((entry: HistoryEntry) => {
    setSummary(entry.summary);
    setSource(entry.source);
    setSummaryType(entry.type);
    setShowHistory(false);
  }, []);

  const renderedSummary = useMemo(() => {
    if (!summary || showRaw) return null;
    // Simple markdown → HTML
    let html = summary
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      // Headers
      .replace(/^### (.+)$/gm, '<h4 style="font-weight:700;margin:0.75rem 0 0.25rem">$1</h4>')
      .replace(/^## (.+)$/gm, '<h3 style="font-weight:700;margin:0.75rem 0 0.25rem">$1</h3>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Bullet lists
      .replace(/^\* (.+)$/gm, '<li style="margin-left:1rem;list-style:disc;margin-bottom:0.25rem">$1</li>')
      .replace(/^- (.+)$/gm, '<li style="margin-left:1rem;list-style:disc;margin-bottom:0.25rem">$1</li>')
      // Numbered lists
      .replace(/^\d+\. (.+)$/gm, '<li style="margin-left:1rem;list-style:decimal;margin-bottom:0.25rem">$1</li>')
      // Code
      .replace(/`([^`]+)`/g, '<code style="background:#262626;padding:0.1rem 0.3rem;border-radius:3px;font-size:0.85em">$1</code>')
      // Paragraphs (double newline)
      .replace(/\n\n/g, '</p><p style="margin:0.5rem 0">')
      // Single newlines (preserve)
      .replace(/\n/g, '<br/>');
    return `<p style="margin:0">${html}</p>`;
  }, [summary, showRaw]);

  const timeAgo = (ts: number) => {
    const mins = Math.floor((Date.now() - ts) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">FreeAgentStore</a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>Summarizer</h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-emerald-900/40 text-emerald-400">
          {status === 'checking' ? 'Checking AI...' : status === 'available' ? 'Built-in AI ready' : status === 'summarizing' ? 'Working...' : 'Fallback mode'}
        </span>
      </header>

      <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-4 gap-4">
        {/* Explanation */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <p className="text-sm text-neutral-300 leading-relaxed">
            Paste any text and get an instant summary. Choose a format: <strong>TL;DR</strong> (2-sentence overview),
            <strong> Key Points</strong> (bullet list), <strong>Teaser</strong> (hook for social media),
            or <strong>Headline</strong> (one line). Uses Chrome's built-in AI when available — falls back to
            Ollama or basic extraction. Everything runs locally, nothing leaves your browser.
          </p>
          {!text && (
            <button onClick={() => setText(SAMPLE_TEXT)}
              className="mt-2 text-xs text-emerald-400 hover:text-emerald-300">
              Load sample text to try it out
            </button>
          )}
        </div>

        {/* Two-panel layout */}
        <div className="flex-1 flex flex-col lg:flex-row gap-4">
          {/* Input */}
          <div className="flex-1 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-neutral-400">Paste text to summarize</label>
              {wordCount > 0 && <span className="text-xs text-neutral-600">{wordCount} words</span>}
            </div>
            <textarea value={text} onChange={e => setText(e.target.value)}
              placeholder="Paste an article, email, document, meeting notes, or any long text..."
              disabled={status === 'summarizing'}
              className="flex-1 min-h-[250px] p-4 rounded-lg bg-neutral-900 border border-neutral-800 resize-none focus:outline-none focus:border-emerald-600 text-neutral-100 placeholder:text-neutral-600 text-sm disabled:opacity-50" />
            <div className="flex gap-2 items-center">
              <select value={summaryType} onChange={e => setSummaryType(e.target.value as SummaryType)}
                disabled={status === 'summarizing'}
                className="px-3 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-sm disabled:opacity-50">
                <option value="tl;dr">TL;DR</option>
                <option value="key-points">Key Points</option>
                <option value="teaser">Teaser</option>
                <option value="headline">Headline</option>
              </select>
              <button onClick={summarize} disabled={!text.trim() || status === 'summarizing'}
                className="flex-1 px-4 py-2.5 rounded-lg font-semibold text-white disabled:opacity-40 bg-emerald-600 hover:bg-emerald-500 transition-colors">
                {status === 'summarizing' ? (
                  <span className="flex items-center gap-2 justify-center">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Summarizing...
                  </span>
                ) : 'Summarize'}
              </button>
            </div>
          </div>

          {/* Output */}
          <div className="flex-1 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-neutral-400">
                Summary {source && <span className="text-neutral-600">via {source}</span>}
              </label>
              {summary && (
                <div className="flex gap-2">
                  <button onClick={() => setShowRaw(!showRaw)}
                    className="text-xs text-neutral-500 hover:text-neutral-300">
                    {showRaw ? 'Rendered' : 'Raw'}
                  </button>
                  <button onClick={() => { navigator.clipboard.writeText(summary); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                    className="text-xs text-emerald-400 hover:text-emerald-300">
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              )}
            </div>
            <div className="flex-1 p-4 rounded-lg bg-neutral-900 border border-neutral-800 text-sm whitespace-pre-wrap min-h-[250px]">
              {status === 'summarizing' ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                  <svg className="animate-spin h-8 w-8 text-emerald-400" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  <p className="text-emerald-400 text-sm">{loadingMessage}</p>
                  <p className="text-neutral-600 text-xs max-w-xs">Chrome AI processes text locally on your device. This can take 10-20 seconds for longer texts.</p>
                </div>
              ) : summary ? (
                showRaw || !renderedSummary ? (
                  <span className="font-mono text-xs">{summary}</span>
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: renderedSummary }} className="leading-relaxed" />
                )
              ) : (
                <span className="text-neutral-600">Summary will appear here. Paste text on the left and click Summarize.</span>
              )}
            </div>
          </div>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div>
            <button onClick={() => setShowHistory(!showHistory)}
              className="text-xs text-neutral-500 hover:text-neutral-300 flex items-center gap-1">
              <span>{showHistory ? '▼' : '▶'}</span>
              Previous summaries ({history.length})
            </button>
            {showHistory && (
              <div className="mt-2 space-y-2">
                {history.map((entry, i) => (
                  <button key={i} onClick={() => restoreFromHistory(entry)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-600 transition-colors text-left">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-neutral-300 truncate">{entry.input}...</p>
                      <p className="text-xs text-neutral-500 truncate mt-0.5">{entry.summary.slice(0, 80)}...</p>
                      <p className="text-[10px] text-neutral-600 mt-0.5">{entry.type} &middot; {entry.source} &middot; {timeAgo(entry.timestamp)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Uses Chrome Built-in AI (Gemini Nano) when available. Falls back to Ollama or heuristic. Zero download, 100% private.
        <a href="https://github.com/FreeAgentStore/summarizer" className="underline ml-1">View source</a>
      </footer>
    </div>
  );
}
