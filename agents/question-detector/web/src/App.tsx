import { useState, useEffect, useRef, useCallback } from 'react';
import { classifyQuestion, type QuestionType, type QuestionResult } from './classifier';

const TYPE_COLORS: Record<QuestionType, string> = {
  'yes-no': '#3b82f6',
  open: '#22c55e',
  rhetorical: '#eab308',
  choice: '#a855f7',
  'not-a-question': '#737373',
};

const TYPE_LABELS: Record<QuestionType, string> = {
  'yes-no': 'Yes/No Question',
  open: 'Open-Ended Question',
  rhetorical: 'Rhetorical Question',
  choice: 'Choice Question',
  'not-a-question': 'Not a Question',
};

const TYPE_DESCRIPTIONS: Record<QuestionType, string> = {
  'yes-no': 'Expects a yes or no answer',
  open: 'Requires an explanatory answer',
  rhetorical: 'Not expecting an actual answer',
  choice: 'Presents options to choose from',
  'not-a-question': 'Declarative statement or command',
};

const TYPES_ORDER: QuestionType[] = ['yes-no', 'open', 'rhetorical', 'choice', 'not-a-question'];

const SAMPLES: { label: string; text: string }[] = [
  { label: 'Yes/No', text: 'Is the meeting at 3pm?' },
  { label: 'Open', text: "What's the meaning of life?" },
  { label: 'Rhetorical', text: 'Who even cares about that?' },
  { label: 'Choice', text: 'Pizza or sushi for dinner?' },
  { label: 'Statement', text: 'The project is due tomorrow.' },
  { label: 'Implied', text: 'I wonder if it will rain' },
];

export default function App() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<QuestionResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const analyze = useCallback((input: string) => {
    if (!input.trim()) {
      setResult(null);
      return;
    }
    setResult(classifyQuestion(input));
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => analyze(text), 150);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [text, analyze]);

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">
          FreeAgentStore
        </a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
          Question Detector
        </h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
          Heuristic — 5 question types
        </span>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 gap-4">
        {/* Input */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type or paste text to classify..."
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
        {result && (
          <div className="space-y-4">
            {/* Primary result */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: TYPE_COLORS[result.type] }}
                />
                <span
                  className="text-xl font-bold"
                  style={{ color: TYPE_COLORS[result.type] }}
                >
                  {TYPE_LABELS[result.type]}
                </span>
                <span className="text-sm text-neutral-500">
                  {TYPE_DESCRIPTIONS[result.type]}
                </span>
              </div>

              {/* Question word */}
              {result.questionWord && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-neutral-500">Question word:</span>
                  <span
                    className="px-2 py-0.5 rounded text-sm font-mono font-semibold"
                    style={{
                      backgroundColor: `${TYPE_COLORS[result.type]}20`,
                      color: TYPE_COLORS[result.type],
                    }}
                  >
                    {result.questionWord}
                  </span>
                </div>
              )}

              {/* Confidence */}
              <div className="mt-3 flex items-center gap-3">
                <span className="text-xs text-neutral-500">Confidence:</span>
                <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden max-w-48">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${result.confidence * 100}%`,
                      backgroundColor: TYPE_COLORS[result.type],
                    }}
                  />
                </div>
                <span className="text-xs font-mono text-neutral-400">
                  {Math.round(result.confidence * 100)}%
                </span>
              </div>
            </div>

            {/* Score bars */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-2">
              {TYPES_ORDER.map((qt) => (
                <div key={qt} className="flex items-center gap-3">
                  <span
                    className="text-xs w-28 text-right font-medium"
                    style={{ color: TYPE_COLORS[qt] }}
                  >
                    {TYPE_LABELS[qt]}
                  </span>
                  <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.max(0, result.scores[qt]) * 100}%`,
                        backgroundColor: TYPE_COLORS[qt],
                      }}
                    />
                  </div>
                  <span className="text-xs font-mono text-neutral-500 w-10 text-right">
                    {result.scores[qt].toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Signals */}
            {result.signals.length > 0 && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  Detected Signals
                </h3>
                <ul className="space-y-1">
                  {result.signals.map((signal, i) => (
                    <li key={i} className="text-sm text-neutral-300 flex items-start gap-2">
                      <span className="text-neutral-600 mt-0.5 shrink-0">-</span>
                      <span>{signal}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-neutral-600">
          This agent uses heuristic code — no AI model, no download, instant results.
          The analysis code was generated by an LLM and evolved through iterative testing on 900 examples.
        </p>
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Classify questions by type. Runs in your browser — zero model, zero inference, zero cost.
      </footer>
    </div>
  );
}
