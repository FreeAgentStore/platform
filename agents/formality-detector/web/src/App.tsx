import { useState, useEffect, useRef, useCallback } from 'react';
import { detectFormality, type Formality, type FormalityResult } from './classifier';

const FORMALITY_COLORS: Record<Formality, string> = {
  formal: '#3b82f6',
  neutral: '#6b7280',
  casual: '#22c55e',
  slang: '#8b5cf6',
};

const FORMALITY_LABELS: Record<Formality, string> = {
  formal: 'Formal',
  neutral: 'Neutral',
  casual: 'Casual',
  slang: 'Slang',
};

interface Example {
  label: string;
  text: string;
}

const EXAMPLES: Example[] = [
  { label: 'Formal', text: 'I am writing to formally request a meeting regarding the quarterly review. Please be advised that all stakeholders have been apprised of the agenda.' },
  { label: 'Neutral', text: 'The report has been submitted for your review. Let me know if you have any questions about the findings.' },
  { label: 'Casual', text: 'Hey, can you grab coffee later? I kinda wanna catch up, it\'s been a while!' },
  { label: 'Slang', text: 'ngl this is lowkey fire bruh lol no cap the vibes are immaculate fr fr' },
];

const ALL_FORMALITIES: Formality[] = ['formal', 'neutral', 'casual', 'slang'];

export default function App() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<FormalityResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const classify = useCallback((input: string) => {
    if (!input.trim()) {
      setResult(null);
      return;
    }
    setResult(detectFormality(input));
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => classify(text), 200);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [text, classify]);

  const handleExample = (ex: Example) => setText(ex.text);
  const maxScore = result ? Math.max(...Object.values(result.scores), 0.01) : 1;

  // Register meter: -1 to +1, mapped to a 0-100% position
  const registerPercent = result ? ((result.register + 1) / 2) * 100 : 50;

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">
          FreeAgentStore
        </a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
          Formality Detector
        </h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
          Evolved — 700 examples
        </span>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 gap-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type or paste text to detect formality level..."
          className="w-full h-40 p-4 rounded-lg bg-neutral-900 border border-neutral-800 resize-none focus:outline-none focus:border-neutral-600 text-neutral-100 placeholder:text-neutral-600"
        />

        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              onClick={() => handleExample(ex)}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 transition-colors"
            >
              {ex.label}
            </button>
          ))}
        </div>

        {result && (
          <div className="space-y-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <span
                  className="text-2xl font-bold"
                  style={{ color: FORMALITY_COLORS[result.formality] }}
                >
                  {FORMALITY_LABELS[result.formality]}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-500">Confidence</span>
                    <div className="w-32 h-2 bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${result.confidence * 100}%`,
                          backgroundColor: FORMALITY_COLORS[result.formality],
                        }}
                      />
                    </div>
                    <span className="text-xs font-mono text-neutral-400">
                      {(result.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Register meter */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
              <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">
                Register
              </h3>
              <div className="relative">
                <div className="flex justify-between text-xs text-neutral-600 mb-1">
                  <span>Informal</span>
                  <span>Neutral</span>
                  <span>Formal</span>
                </div>
                <div className="h-3 bg-neutral-800 rounded-full overflow-hidden relative">
                  {/* Gradient background */}
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: 'linear-gradient(to right, #8b5cf6, #22c55e, #6b7280, #3b82f6)',
                      opacity: 0.3,
                    }}
                  />
                  {/* Indicator dot */}
                  <div
                    className="absolute top-0 h-3 w-3 rounded-full border-2 border-neutral-950 transition-all duration-300"
                    style={{
                      left: `calc(${registerPercent}% - 6px)`,
                      backgroundColor: FORMALITY_COLORS[result.formality],
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs font-mono text-neutral-600 mt-1">
                  <span>-1</span>
                  <span>0</span>
                  <span>+1</span>
                </div>
                <div className="text-center mt-1">
                  <span className="text-sm font-mono" style={{ color: FORMALITY_COLORS[result.formality] }}>
                    {result.register > 0 ? '+' : ''}{result.register.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-2">
              <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">
                Score Breakdown
              </h3>
              {ALL_FORMALITIES.map((formality) => (
                <div key={formality} className="flex items-center gap-3">
                  <span
                    className="text-xs w-20 text-right font-medium"
                    style={{ color: FORMALITY_COLORS[formality] }}
                  >
                    {FORMALITY_LABELS[formality]}
                  </span>
                  <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${(result.scores[formality] / maxScore) * 100}%`,
                        backgroundColor: FORMALITY_COLORS[formality],
                        opacity: result.formality === formality ? 1 : 0.5,
                      }}
                    />
                  </div>
                  <span className="text-xs font-mono text-neutral-500 w-12 text-right">
                    {(result.scores[formality] * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>

            {result.signals.length > 0 && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">
                  Matched Signals ({result.signals.length})
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {result.signals.map((signal, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded text-xs font-mono bg-neutral-800 text-neutral-400"
                    >
                      {signal}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-neutral-600">
          This agent uses heuristic code — no AI model, no download, instant results.
          The classification code was generated by an LLM and evolved through iterative testing on 700 text examples.
        </p>
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Detect text formality with keyword + structural scoring. Runs in your browser — zero model, zero inference, zero cost.
        <a href="https://github.com/FreeAgentStore/platform/blob/main/agents/formality-detector/web/src/classifier.ts" className="underline ml-1">View source</a>
      </footer>
    </div>
  );
}
