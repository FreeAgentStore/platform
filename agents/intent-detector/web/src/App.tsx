import { useState, useEffect, useRef, useCallback } from 'react';
import { detectIntent, type Intent, type IntentResult } from './classifier';

const INTENT_COLORS: Record<Intent, string> = {
  question: '#3b82f6',
  command: '#f97316',
  statement: '#6b7280',
  greeting: '#22c55e',
  farewell: '#8b5cf6',
  exclamation: '#eab308',
};

const INTENT_LABELS: Record<Intent, string> = {
  question: 'Question',
  command: 'Command',
  statement: 'Statement',
  greeting: 'Greeting',
  farewell: 'Farewell',
  exclamation: 'Exclamation',
};

const INTENT_SYMBOLS: Record<Intent, string> = {
  question: '?',
  command: '>',
  statement: '.',
  greeting: 'Hi',
  farewell: 'Bye',
  exclamation: '!',
};

interface Example {
  label: string;
  text: string;
}

const EXAMPLES: Example[] = [
  { label: 'Question', text: 'What time is it?' },
  { label: 'Command', text: 'Please send me the report' },
  { label: 'Statement', text: 'The weather is nice today' },
  { label: 'Greeting', text: 'Hey, how are you?' },
  { label: 'Farewell', text: 'See you tomorrow!' },
  { label: 'Exclamation', text: 'Wow, that\'s incredible!' },
];

const ALL_INTENTS: Intent[] = ['question', 'command', 'statement', 'greeting', 'farewell', 'exclamation'];

export default function App() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<IntentResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const classify = useCallback((input: string) => {
    if (!input.trim()) {
      setResult(null);
      return;
    }
    setResult(detectIntent(input));
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => classify(text), 200);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [text, classify]);

  const handleExample = (ex: Example) => setText(ex.text);
  const maxScore = result ? Math.max(...Object.values(result.scores), 0.01) : 1;

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">
          FreeAgentStore
        </a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
          Intent Detector
        </h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
          Evolved — 800 examples
        </span>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 gap-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type or paste text to detect intent..."
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
                  className="text-3xl font-bold font-mono w-12 h-12 flex items-center justify-center rounded-lg"
                  style={{ color: INTENT_COLORS[result.intent], backgroundColor: INTENT_COLORS[result.intent] + '18' }}
                >
                  {INTENT_SYMBOLS[result.intent]}
                </span>
                <div>
                  <span
                    className="text-2xl font-bold"
                    style={{ color: INTENT_COLORS[result.intent] }}
                  >
                    {INTENT_LABELS[result.intent]}
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-neutral-500">Confidence</span>
                    <div className="w-32 h-2 bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${result.confidence * 100}%`,
                          backgroundColor: INTENT_COLORS[result.intent],
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

            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-2">
              <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">
                Score Breakdown
              </h3>
              {ALL_INTENTS.map((intent) => (
                <div key={intent} className="flex items-center gap-3">
                  <span
                    className="text-xs w-24 text-right font-medium"
                    style={{ color: INTENT_COLORS[intent] }}
                  >
                    {INTENT_LABELS[intent]}
                  </span>
                  <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${(result.scores[intent] / maxScore) * 100}%`,
                        backgroundColor: INTENT_COLORS[intent],
                        opacity: result.intent === intent ? 1 : 0.5,
                      }}
                    />
                  </div>
                  <span className="text-xs font-mono text-neutral-500 w-12 text-right">
                    {(result.scores[intent] * 100).toFixed(0)}%
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
          The classification code was generated by an LLM and evolved through iterative testing on 800 text examples.
        </p>
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Detect text intent with keyword + structural scoring. Runs in your browser — zero model, zero inference, zero cost.
        <a href="https://github.com/FreeAgentStore/platform/blob/main/agents/intent-detector/web/src/classifier.ts" className="underline ml-1">View source</a>
      </footer>
    </div>
  );
}
