import { useState, useEffect, useRef, useCallback } from 'react';
import { detectSarcasm, type SarcasmResult } from './classifier';

function getLabel(score: number): { text: string; color: string } {
  if (score < 0.15) return { text: 'Sincere', color: '#22c55e' };
  if (score < 0.3) return { text: 'Possibly Sarcastic', color: '#eab308' };
  if (score < 0.6) return { text: 'Likely Sarcastic', color: '#f97316' };
  return { text: 'Definitely Sarcastic', color: '#ef4444' };
}

const SAMPLES: { label: string; text: string }[] = [
  { label: 'Sarcastic meeting', text: 'Oh great, another meeting that could have been an email' },
  { label: 'Genuine praise', text: 'This product genuinely exceeded my expectations' },
  { label: 'Sleep sarcasm', text: 'Yeah, because who needs sleep anyway' },
  { label: 'Genuine thanks', text: 'Thank you so much for your help today' },
  { label: 'Crash sarcasm', text: 'What a surprise, the software crashed again' },
  { label: 'Clumsy sarcasm', text: 'Real smooth, dropping the cake at the party' },
];

export default function App() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<SarcasmResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const analyze = useCallback((input: string) => {
    if (!input.trim()) {
      setResult(null);
      return;
    }
    setResult(detectSarcasm(input));
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => analyze(text), 150);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [text, analyze]);

  const label = result ? getLabel(result.score) : null;
  const gaugePercent = result ? Math.round(result.score * 100) : 0;

  // Split signals into sarcasm and anti-sarcasm
  const sarcasmSignals = result?.signals.filter(s => !s.startsWith('[anti-sarcasm]')) ?? [];
  const antiSignals = result?.signals.filter(s => s.startsWith('[anti-sarcasm]')).map(s => s.replace('[anti-sarcasm] ', '')) ?? [];

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">
          FreeAgentStore
        </a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
          Sarcasm Detector
        </h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
          Heuristic — 72% accuracy
        </span>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 gap-4">
        {/* Input */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type or paste text to check for sarcasm..."
          className="w-full h-40 p-4 rounded-lg bg-neutral-900 border border-neutral-800 resize-none focus:outline-none focus:border-neutral-600 text-neutral-100 placeholder:text-neutral-600"
        />

        {/* Sample buttons */}
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map((s) => (
            <button
              key={s.label}
              onClick={() => setText(s.text)}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 transition-colors"
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Results */}
        {result && label && (
          <div className="space-y-4">
            {/* Score gauge */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
              <div className="flex items-center gap-4">
                {/* Circular gauge */}
                <div className="relative w-24 h-24 shrink-0">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    {/* Background circle */}
                    <circle
                      cx="50" cy="50" r="42"
                      fill="none"
                      stroke="#262626"
                      strokeWidth="8"
                    />
                    {/* Score arc */}
                    <circle
                      cx="50" cy="50" r="42"
                      fill="none"
                      stroke={label.color}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${gaugePercent * 2.64} 264`}
                      className="transition-all duration-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold font-mono" style={{ color: label.color }}>
                      {gaugePercent}
                    </span>
                  </div>
                </div>

                <div className="flex-1">
                  <div className="text-2xl font-bold" style={{ color: label.color }}>
                    {label.text}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-neutral-500">Confidence:</span>
                    <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden max-w-32">
                      <div
                        className="h-full rounded-full transition-all duration-300 bg-neutral-500"
                        style={{ width: `${result.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-neutral-500">
                      {Math.round(result.confidence * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Detected patterns */}
            {result.patterns.length > 0 && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  Sarcasm Patterns Detected
                </h3>
                <div className="flex flex-wrap gap-2">
                  {result.patterns.map((pattern) => (
                    <span
                      key={pattern}
                      className="px-2.5 py-1 rounded-full text-xs font-medium border"
                      style={{
                        color: label.color,
                        borderColor: `${label.color}40`,
                        backgroundColor: `${label.color}10`,
                      }}
                    >
                      {pattern}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Signals */}
            {(sarcasmSignals.length > 0 || antiSignals.length > 0) && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-3">
                {sarcasmSignals.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                      Sarcasm Signals
                    </h3>
                    <ul className="space-y-1">
                      {sarcasmSignals.map((signal, i) => (
                        <li key={i} className="text-sm text-neutral-300 flex items-start gap-2">
                          <span className="text-orange-500 mt-0.5 shrink-0">+</span>
                          <span>{signal}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {antiSignals.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                      Sincerity Signals
                    </h3>
                    <ul className="space-y-1">
                      {antiSignals.map((signal, i) => (
                        <li key={i} className="text-sm text-neutral-300 flex items-start gap-2">
                          <span className="text-green-500 mt-0.5 shrink-0">-</span>
                          <span>{signal}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Disclaimer */}
            <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-3">
              <p className="text-xs text-neutral-500 leading-relaxed">
                Sarcasm detection is hard — this is a 72% accurate heuristic.
                Context, tone of voice, and cultural background all matter.
                The classifier looks for contradiction, exaggeration, understatement,
                and known sarcastic phrases, but cannot understand true intent.
              </p>
            </div>
          </div>
        )}

        <p className="text-xs text-neutral-600">
          This agent uses heuristic code — no AI model, no download, instant results.
          The analysis code was generated by an LLM and evolved through iterative testing on 1000 examples.
        </p>
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Detect sarcasm in text. Runs in your browser — zero model, zero inference, zero cost.
      </footer>
    </div>
  );
}
