import { useState, useEffect } from 'react';

type Mode = 'write' | 'rewrite' | 'improve';
type Tone = 'formal' | 'neutral' | 'casual';

export default function App() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [mode, setMode] = useState<Mode>('write');
  const [tone, setTone] = useState<Tone>('neutral');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
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

  async function generate() {
    if (!input.trim()) return;
    setGenerating(true);
    setOutput('');

    const prompts: Record<Mode, string> = {
      write: `Write a ${tone} text about the following topic:\n\n${input}`,
      rewrite: `Rewrite the following text in a ${tone} tone:\n\n${input}`,
      improve: `Improve and polish the following text, keeping a ${tone} tone. Fix grammar, clarity, and flow:\n\n${input}`,
    };

    try {
      const g = globalThis as any;

      // Try built-in Writer/Rewriter first
      if (mode === 'write') {
        const W = g.Writer ?? g.ai?.writer;
        if (W?.create) {
          const writer = await W.create({ tone, length: 'medium' });
          setOutput(await writer.write(input));
          setSource('Chrome Built-in AI');
          setGenerating(false);
          return;
        }
      }

      if (mode === 'rewrite' || mode === 'improve') {
        const R = g.Rewriter ?? g.ai?.rewriter;
        if (R?.create) {
          const toneMap = { formal: 'more-formal', casual: 'more-casual', neutral: 'as-is' };
          const rewriter = await R.create({ tone: toneMap[tone] as any });
          setOutput(await rewriter.rewrite(input));
          setSource('Chrome Built-in AI');
          setGenerating(false);
          return;
        }
      }

      // Fallback: Prompt API
      const LM = g.LanguageModel ?? g.ai?.languageModel;
      if (LM?.create) {
        const session = await LM.create();
        setOutput(await session.prompt(prompts[mode]));
        session.destroy?.();
        setSource('Chrome Built-in AI');
        setGenerating(false);
        return;
      }
    } catch {}

    // Fallback: Ollama
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt: prompts[mode], stream: false }),
      });
      if (res.ok) {
        setOutput((await res.json()).response);
        setSource('Ollama');
        setGenerating(false);
        return;
      }
    } catch {}

    setOutput('No AI available. Enable Chrome Built-in AI or run Ollama locally.');
    setSource('None');
    setGenerating(false);
  }

  const modeLabels: Record<Mode, string> = { write: 'Write', rewrite: 'Rewrite', improve: 'Improve' };

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">FreeAgentStore</a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>Writing Assistant</h1>
        <span className={`ml-auto text-xs px-2 py-0.5 rounded ${
          available === null ? 'bg-neutral-800 text-neutral-400' :
          available ? 'bg-blue-900/40 text-blue-400' : 'bg-neutral-800 text-neutral-400'
        }`}>
          {available === null ? 'Checking...' : available ? 'Built-in AI ready' : 'Fallback mode'}
        </span>
      </header>

      <main className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-4 gap-4">
        <div className="flex gap-2">
          {(['write', 'rewrite', 'improve'] as Mode[]).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                mode === m ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
              }`}>
              {modeLabels[m]}
            </button>
          ))}
          <select value={tone} onChange={e => setTone(e.target.value as Tone)}
            className="ml-auto px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-sm">
            <option value="formal">Formal</option>
            <option value="neutral">Neutral</option>
            <option value="casual">Casual</option>
          </select>
        </div>

        <textarea
          value={input} onChange={e => setInput(e.target.value)}
          placeholder={mode === 'write' ? 'Describe what you want written...' : 'Paste text to rewrite or improve...'}
          className="min-h-[150px] p-4 rounded-lg bg-neutral-900 border border-neutral-800 resize-none focus:outline-none focus:border-blue-600 text-sm"
        />

        <button onClick={generate} disabled={!input.trim() || generating}
          className="px-4 py-2.5 rounded-lg font-semibold text-white disabled:opacity-40 bg-blue-600 hover:bg-blue-500">
          {generating ? 'Generating...' : `${modeLabels[mode]} Text`}
        </button>

        {output && (
          <div className="p-4 rounded-lg bg-neutral-900 border border-neutral-800 text-sm whitespace-pre-wrap">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-neutral-500">via {source}</span>
              <button onClick={() => navigator.clipboard.writeText(output)}
                className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 hover:bg-neutral-700">Copy</button>
            </div>
            {output}
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Uses Chrome Built-in AI (Writer/Rewriter) when available. Falls back to Ollama. 100% private.
      </footer>
    </div>
  );
}
