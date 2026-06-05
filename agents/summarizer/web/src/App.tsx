import { useState, useEffect } from 'react';

type SummaryType = 'tl;dr' | 'key-points' | 'teaser' | 'headline';
type Status = 'checking' | 'available' | 'unavailable' | 'summarizing';

export default function App() {
  const [status, setStatus] = useState<Status>('checking');
  const [text, setText] = useState('');
  const [summary, setSummary] = useState('');
  const [summaryType, setSummaryType] = useState<SummaryType>('tl;dr');
  const [source, setSource] = useState<string>('');

  useEffect(() => {
    checkAvailability();
  }, []);

  async function checkAvailability() {
    const g = globalThis as any;
    const S = g.Summarizer ?? g.ai?.summarizer;
    if (S?.availability) {
      const avail = await S.availability();
      setStatus(avail === 'available' || avail === 'readily' ? 'available' : 'unavailable');
    } else {
      setStatus('unavailable');
    }
  }

  async function summarize() {
    if (!text.trim()) return;
    setStatus('summarizing');
    setSummary('');

    try {
      // Try built-in Summarizer API
      const g = globalThis as any;
      const S = g.Summarizer ?? g.ai?.summarizer;
      if (S?.create) {
        const summarizer = await S.create({ type: summaryType, format: 'markdown', length: 'medium' });
        const result = await summarizer.summarize(text);
        setSummary(result);
        setSource('Chrome Built-in AI');
        setStatus('available');
        return;
      }
    } catch {}

    try {
      // Fallback: Ollama
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2',
          prompt: `Summarize the following text as ${summaryType}:\n\n${text}`,
          stream: false,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSummary(data.response);
        setSource('Ollama (local)');
        setStatus('available');
        return;
      }
    } catch {}

    // Fallback: basic heuristic (first N sentences)
    const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
    setSummary(sentences.slice(0, 3).join(' ').trim());
    setSource('Heuristic (basic)');
    setStatus('available');
  }

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">FreeAgentStore</a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>Summarizer</h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-emerald-900/40 text-emerald-400">
          {status === 'checking' ? 'Checking...' : status === 'available' ? 'Built-in AI ready' : 'Fallback mode'}
        </span>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row max-w-5xl mx-auto w-full p-4 gap-4">
        <div className="flex-1 flex flex-col gap-2">
          <label className="text-sm text-neutral-400">Paste text to summarize</label>
          <textarea
            value={text} onChange={e => setText(e.target.value)}
            placeholder="Paste an article, email, document, or any long text..."
            className="flex-1 min-h-[250px] p-4 rounded-lg bg-neutral-900 border border-neutral-800 resize-none focus:outline-none focus:border-emerald-600 text-neutral-100 placeholder:text-neutral-600 text-sm"
          />
          <div className="flex gap-2 items-center">
            <select value={summaryType} onChange={e => setSummaryType(e.target.value as SummaryType)}
              className="px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-sm">
              <option value="tl;dr">TL;DR</option>
              <option value="key-points">Key Points</option>
              <option value="teaser">Teaser</option>
              <option value="headline">Headline</option>
            </select>
            <button onClick={summarize} disabled={!text.trim() || status === 'summarizing'}
              className="flex-1 px-4 py-2 rounded-lg font-semibold text-white disabled:opacity-40 bg-emerald-600 hover:bg-emerald-500">
              {status === 'summarizing' ? 'Summarizing...' : 'Summarize'}
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-2">
          <label className="text-sm text-neutral-400">Summary {source && <span className="text-neutral-600">via {source}</span>}</label>
          <div className="flex-1 p-4 rounded-lg bg-neutral-900 border border-neutral-800 text-sm whitespace-pre-wrap min-h-[250px]">
            {summary || <span className="text-neutral-600">Summary will appear here</span>}
          </div>
        </div>
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Uses Chrome Built-in AI (Gemini Nano) when available. Falls back to Ollama or heuristic. Zero download, 100% private.
      </footer>
    </div>
  );
}
