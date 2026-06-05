import { useState } from 'react';

const PRESETS = [
  { label: 'Happy sun', prompt: 'a happy smiling sun with rays, flat design, warm yellow and orange' },
  { label: 'Rocket', prompt: 'a rocket launching upward, flat design, blue and red, simple' },
  { label: 'Heart', prompt: 'a heart shape, gradient pink to red, glossy, minimal' },
  { label: 'Lightbulb', prompt: 'a lightbulb with a glow, flat design, yellow on dark background, idea concept' },
  { label: 'Music note', prompt: 'a musical note, purple gradient, modern, clean lines' },
  { label: 'Leaf', prompt: 'a single leaf, green gradient, eco/nature vibe, simple' },
  { label: 'Shield', prompt: 'a shield with a checkmark, blue, security/trust concept' },
  { label: 'Chat bubble', prompt: 'a chat bubble with dots, friendly purple, communication concept' },
];

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [svg, setSvg] = useState('');
  const [generating, setGenerating] = useState(false);
  const [source, setSource] = useState('');
  const [history, setHistory] = useState<{ prompt: string; svg: string }[]>([]);

  async function generate() {
    if (!prompt.trim()) return;
    setGenerating(true);
    setSvg('');

    const aiPrompt = `Generate a simple SVG icon for: "${prompt}"

Requirements:
- Valid SVG code with viewBox="0 0 100 100"
- Simple, flat design with clean shapes (circles, rects, paths)
- Use 2-3 colors max
- No text elements
- No external references
- The SVG should look good at 64x64px and 256x256px

Return ONLY the SVG code starting with <svg and ending with </svg>. No explanation.`;

    let result = '';

    try {
      const g = globalThis as any;
      const LM = g.LanguageModel ?? g.ai?.languageModel;
      if (LM?.create) {
        const session = await LM.create({ systemPrompt: 'You are an SVG icon designer. You generate clean, simple SVG code. Return only valid SVG markup.' });
        result = await session.prompt(aiPrompt);
        session.destroy?.();
        setSource('Chrome Built-in AI');
      }
    } catch {}

    if (!result) {
      try {
        const r = await fetch('http://localhost:11434/api/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'llama3.2', prompt: aiPrompt, stream: false }),
        });
        if (r.ok) { result = (await r.json()).response; setSource('Ollama'); }
      } catch {}
    }

    if (!result) {
      // Heuristic fallback: generate a simple colored circle with first letter
      const color = `hsl(${Math.random() * 360}, 70%, 50%)`;
      const letter = prompt.trim()[0].toUpperCase();
      result = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="45" fill="${color}"/><text x="50" y="55" text-anchor="middle" dominant-baseline="middle" font-size="40" font-family="sans-serif" fill="white" font-weight="bold">${letter}</text></svg>`;
      setSource('Heuristic fallback');
    }

    // Extract SVG from response
    const svgMatch = result.match(/<svg[\s\S]*?<\/svg>/i);
    const cleanSvg = svgMatch ? svgMatch[0] : result;
    setSvg(cleanSvg);
    setHistory(prev => [{ prompt: prompt.trim(), svg: cleanSvg }, ...prev.slice(0, 11)]);
    setGenerating(false);
  }

  const downloadSvg = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `icon-${Date.now()}.svg`;
    a.click();
  };

  const downloadPng = () => {
    if (!svg) return;
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 512, 512);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `icon-${Date.now()}.png`;
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
  };

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col" style={{ fontFamily: "'Manrope',system-ui,sans-serif" }}>
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">FreeAgentStore</a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>Icon Generator</h1>
        {source && <span className="ml-auto text-xs px-2 py-0.5 rounded bg-emerald-900/40 text-emerald-400">{source}</span>}
      </header>

      <main className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-4 gap-4">
        {/* Presets */}
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p, i) => (
            <button key={i} onClick={() => { setPrompt(p.prompt); }}
              className="px-3 py-1 rounded-full text-xs font-medium bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200">
              {p.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <input value={prompt} onChange={e => setPrompt(e.target.value)}
            placeholder="Describe your icon... e.g. 'a mountain with sunset, minimal, orange and purple'"
            onKeyDown={e => e.key === 'Enter' && generate()}
            className="flex-1 px-4 py-3 rounded-lg bg-neutral-900 border border-neutral-800 text-sm focus:outline-none focus:border-violet-600" />
          <button onClick={generate} disabled={!prompt.trim() || generating}
            className="px-6 py-3 rounded-lg bg-violet-600 text-white font-semibold text-sm disabled:opacity-40">
            {generating ? '...' : 'Generate'}
          </button>
        </div>

        {/* Preview */}
        {svg && (
          <div className="flex flex-col items-center gap-3">
            <div className="grid grid-cols-3 gap-4 items-end">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto rounded-lg bg-neutral-800 p-1 flex items-center justify-center"
                     dangerouslySetInnerHTML={{ __html: svg }} />
                <span className="text-xs text-neutral-600 mt-1">64px</span>
              </div>
              <div className="text-center">
                <div className="w-32 h-32 mx-auto rounded-xl bg-neutral-800 p-2 flex items-center justify-center"
                     dangerouslySetInnerHTML={{ __html: svg }} />
                <span className="text-xs text-neutral-600 mt-1">128px</span>
              </div>
              <div className="text-center">
                <div className="w-48 h-48 mx-auto rounded-2xl bg-neutral-800 p-3 flex items-center justify-center"
                     dangerouslySetInnerHTML={{ __html: svg }} />
                <span className="text-xs text-neutral-600 mt-1">256px</span>
              </div>
            </div>

            {/* Dark/light preview */}
            <div className="flex gap-4">
              <div className="w-20 h-20 rounded-xl bg-white p-2 flex items-center justify-center"
                   dangerouslySetInnerHTML={{ __html: svg }} />
              <div className="w-20 h-20 rounded-xl bg-neutral-900 p-2 flex items-center justify-center"
                   dangerouslySetInnerHTML={{ __html: svg }} />
            </div>

            <div className="flex gap-2">
              <button onClick={downloadSvg} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-800 text-neutral-300 hover:bg-neutral-700">Download SVG</button>
              <button onClick={downloadPng} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-800 text-neutral-300 hover:bg-neutral-700">Download PNG (512px)</button>
              <button onClick={() => navigator.clipboard.writeText(svg)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-800 text-neutral-300 hover:bg-neutral-700">Copy SVG</button>
            </div>

            <details className="w-full">
              <summary className="text-xs text-neutral-600 cursor-pointer">View SVG code</summary>
              <pre className="mt-2 p-3 rounded-lg bg-neutral-900 border border-neutral-800 text-xs font-mono overflow-auto max-h-48">{svg}</pre>
            </details>
          </div>
        )}

        {/* History */}
        {history.length > 1 && (
          <div>
            <h2 className="text-xs text-neutral-500 mb-2">History</h2>
            <div className="flex gap-2 flex-wrap">
              {history.slice(1).map((h, i) => (
                <button key={i} onClick={() => { setSvg(h.svg); setPrompt(h.prompt); }}
                  className="w-12 h-12 rounded-lg bg-neutral-800 p-1 hover:ring-2 ring-violet-500"
                  dangerouslySetInnerHTML={{ __html: h.svg }} title={h.prompt} />
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        AI writes SVG code → browser renders it. Zero image model, zero download. Works with Chrome Built-in AI or Ollama.
      </footer>
    </div>
  );
}
