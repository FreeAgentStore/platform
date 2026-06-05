import { useState, useEffect } from 'react';

type Task = 'explain' | 'review' | 'document';

export default function App() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [code, setCode] = useState('');
  const [output, setOutput] = useState('');
  const [task, setTask] = useState<Task>('explain');
  const [generating, setGenerating] = useState(false);
  const [source, setSource] = useState('');

  useEffect(() => {
    (async () => {
      const g = globalThis as any;
      const LM = g.LanguageModel ?? g.ai?.languageModel;
      if (LM?.availability) {
        const s = await LM.availability();
        setAvailable(s === 'available' || s === 'readily');
      } else {
        setAvailable(false);
      }
    })();
  }, []);

  async function analyze() {
    if (!code.trim()) return;
    setGenerating(true);
    setOutput('');

    const prompts: Record<Task, string> = {
      explain: `Explain the following code in plain English. Be concise but thorough:\n\n${code}`,
      review: `Review this code for bugs, performance issues, and best practices. Be specific:\n\n${code}`,
      document: `Generate documentation comments for this code (JSDoc/TSDoc style):\n\n${code}`,
    };

    try {
      const g = globalThis as any;
      const LM = g.LanguageModel ?? g.ai?.languageModel;
      if (LM?.create) {
        const session = await LM.create({ systemPrompt: 'You are an expert software engineer. Be concise and precise.' });
        setOutput(await session.prompt(prompts[task]));
        session.destroy?.();
        setSource('Chrome Built-in AI');
        setGenerating(false);
        return;
      }
    } catch {}

    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt: prompts[task], stream: false }),
      });
      if (res.ok) {
        setOutput((await res.json()).response);
        setSource('Ollama');
        setGenerating(false);
        return;
      }
    } catch {}

    setOutput('No AI available. Enable Chrome Built-in AI (chrome://flags → Prompt API) or run Ollama locally.');
    setSource('None');
    setGenerating(false);
  }

  const taskLabels: Record<Task, string> = { explain: 'Explain', review: 'Review', document: 'Document' };

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">FreeAgentStore</a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>Code Explainer</h1>
        <span className={`ml-auto text-xs px-2 py-0.5 rounded ${
          available ? 'bg-cyan-900/40 text-cyan-400' : 'bg-neutral-800 text-neutral-400'
        }`}>
          {available === null ? 'Checking...' : available ? 'Built-in AI ready' : 'Fallback mode'}
        </span>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row max-w-5xl mx-auto w-full p-4 gap-4">
        <div className="flex-1 flex flex-col gap-2">
          <div className="flex gap-2">
            {(['explain', 'review', 'document'] as Task[]).map(t => (
              <button key={t} onClick={() => setTask(t)}
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  task === t ? 'bg-cyan-600 text-white' : 'bg-neutral-800 text-neutral-400'
                }`}>
                {taskLabels[t]}
              </button>
            ))}
          </div>
          <textarea
            value={code} onChange={e => setCode(e.target.value)}
            placeholder="Paste code here..."
            className="flex-1 min-h-[300px] p-4 rounded-lg bg-neutral-900 border border-neutral-800 resize-none focus:outline-none focus:border-cyan-600 font-mono text-sm"
          />
          <button onClick={analyze} disabled={!code.trim() || generating}
            className="px-4 py-2.5 rounded-lg font-semibold text-white disabled:opacity-40 bg-cyan-600 hover:bg-cyan-500">
            {generating ? 'Analyzing...' : `${taskLabels[task]} Code`}
          </button>
        </div>

        <div className="flex-1 flex flex-col gap-2">
          <label className="text-sm text-neutral-400">Result {source && <span className="text-neutral-600">via {source}</span>}</label>
          <div className="flex-1 p-4 rounded-lg bg-neutral-900 border border-neutral-800 text-sm whitespace-pre-wrap overflow-auto min-h-[300px]">
            {output || <span className="text-neutral-600">Paste code and click "{taskLabels[task]} Code"</span>}
          </div>
        </div>
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Uses Chrome Built-in AI when available. Falls back to Ollama. Your code never leaves your device.
      </footer>
    </div>
  );
}
