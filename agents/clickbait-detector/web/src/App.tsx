import { useState } from 'react';
import { detectClickbait, type ClickbaitResult } from './classifier';

const CATEGORY_CONFIG: Record<ClickbaitResult['category'], { color: string; bg: string; label: string }> = {
  genuine:  { color: 'text-green-400',  bg: 'bg-green-400',  label: 'Genuine' },
  mild:     { color: 'text-yellow-400', bg: 'bg-yellow-400', label: 'Mild' },
  moderate: { color: 'text-orange-400', bg: 'bg-orange-400', label: 'Moderate' },
  extreme:  { color: 'text-red-400',    bg: 'bg-red-400',    label: 'Extreme' },
};

const SAMPLES = [
  "You Won't BELIEVE What This Dog Did Next!!!",
  "New Study Links Exercise to Reduced Anxiety in Adults",
  "10 Shocking Secrets Your Doctor Doesn't Want You to Know",
  "Apple Reports Q3 Revenue of $81.8 Billion",
  "This Simple Trick Will Change Your Life Forever",
];

function ScoreGauge({ score, category }: { score: number; category: ClickbaitResult['category'] }) {
  const pct = Math.round(score * 100);
  const config = CATEGORY_CONFIG[category];

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="42" fill="none" stroke="#262626" strokeWidth="8" />
          <circle
            cx="50" cy="50" r="42" fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeDasharray={`${pct * 2.64} 264`}
            strokeLinecap="round"
            className={config.color}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold font-mono ${config.color}`}>{pct}</span>
          <span className="text-xs text-neutral-500">/ 100</span>
        </div>
      </div>
      <span className={`text-sm font-semibold ${config.color}`}>{config.label}</span>
    </div>
  );
}

function ResultCard({ result, compact }: { result: ClickbaitResult; compact?: boolean }) {
  const config = CATEGORY_CONFIG[result.category];

  if (compact) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-3 flex-1">
        <ScoreGauge score={result.score} category={result.category} />
        <div className="flex items-center justify-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${config.color} bg-neutral-800`}>
            {config.label}
          </span>
          <span className="text-xs text-neutral-500">
            {(result.confidence * 100).toFixed(0)}% conf
          </span>
        </div>
        {result.signals.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-center">
            {result.signals.slice(0, 5).map((s, i) => (
              <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
                {s}
              </span>
            ))}
            {result.signals.length > 5 && (
              <span className="text-xs text-neutral-600">+{result.signals.length - 5} more</span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-4">
      <div className="flex items-start gap-6">
        <ScoreGauge score={result.score} category={result.category} />
        <div className="flex-1 space-y-3 pt-2">
          <div className="flex items-center gap-3">
            <span className={`text-xl font-bold ${config.color}`}>
              {result.isClickbait ? 'Clickbait Detected' : 'Looks Genuine'}
            </span>
          </div>
          <div className="text-sm">
            <span className="text-neutral-500">Confidence</span>
            <span className="ml-2 font-mono text-neutral-300">{(result.confidence * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {result.signals.length > 0 && (
        <div className="space-y-1">
          <span className="text-xs text-neutral-500 uppercase tracking-wider">Signals</span>
          <div className="flex flex-wrap gap-1.5">
            {result.signals.map((s, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState<'single' | 'compare'>('single');
  const [text, setText] = useState('');
  const [textA, setTextA] = useState('');
  const [textB, setTextB] = useState('');

  const result = text.trim() ? detectClickbait(text) : null;
  const resultA = textA.trim() ? detectClickbait(textA) : null;
  const resultB = textB.trim() ? detectClickbait(textB) : null;

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">
          FreeAgentStore
        </a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
          Clickbait Detector
        </h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
          Heuristic — no model needed
        </span>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setMode('single')}
            className={`text-sm px-3 py-1 rounded transition-colors ${
              mode === 'single'
                ? 'bg-neutral-800 text-neutral-100'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            Single
          </button>
          <button
            onClick={() => setMode('compare')}
            className={`text-sm px-3 py-1 rounded transition-colors ${
              mode === 'compare'
                ? 'bg-neutral-800 text-neutral-100'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            Compare
          </button>
        </div>

        {mode === 'single' ? (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste a headline or text to check for clickbait..."
              className="w-full h-28 p-4 rounded-lg bg-neutral-900 border border-neutral-800 resize-none focus:outline-none focus:border-neutral-600 text-neutral-100 placeholder:text-neutral-600"
            />
            {result && <ResultCard result={result} />}
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <textarea
                value={textA}
                onChange={(e) => setTextA(e.target.value)}
                placeholder="Headline A..."
                className="w-full h-24 p-3 rounded-lg bg-neutral-900 border border-neutral-800 resize-none focus:outline-none focus:border-neutral-600 text-neutral-100 placeholder:text-neutral-600 text-sm"
              />
              <textarea
                value={textB}
                onChange={(e) => setTextB(e.target.value)}
                placeholder="Headline B..."
                className="w-full h-24 p-3 rounded-lg bg-neutral-900 border border-neutral-800 resize-none focus:outline-none focus:border-neutral-600 text-neutral-100 placeholder:text-neutral-600 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {resultA ? <ResultCard result={resultA} compact /> : <div />}
              {resultB ? <ResultCard result={resultB} compact /> : <div />}
            </div>
            {resultA && resultB && (
              <div className="text-center text-sm">
                {resultA.score > resultB.score ? (
                  <span className="text-orange-400">Headline A is more clickbait ({Math.round(resultA.score * 100)} vs {Math.round(resultB.score * 100)})</span>
                ) : resultB.score > resultA.score ? (
                  <span className="text-orange-400">Headline B is more clickbait ({Math.round(resultB.score * 100)} vs {Math.round(resultA.score * 100)})</span>
                ) : (
                  <span className="text-neutral-400">Both headlines score equally ({Math.round(resultA.score * 100)})</span>
                )}
              </div>
            )}
          </>
        )}

        <div className="space-y-2">
          <span className="text-xs text-neutral-500 uppercase tracking-wider">Try a sample</span>
          <div className="flex flex-wrap gap-2">
            {SAMPLES.map((s, i) => (
              <button
                key={i}
                onClick={() => {
                  if (mode === 'single') setText(s);
                  else if (!textA.trim()) setTextA(s);
                  else setTextB(s);
                }}
                className="text-xs px-3 py-1.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 transition-colors text-left"
              >
                {s.length > 50 ? s.slice(0, 50) + '...' : s}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-neutral-600">
          This agent uses heuristic code — no AI model, no download, instant results.
          The analysis code was generated by an LLM and evolved through iterative testing.
        </p>
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Heuristic agent — zero model, zero inference, zero cost.
        <a href="https://github.com/FreeAgentStore/platform/blob/main/agents/clickbait-detector/web/src/classifier.ts" className="underline ml-1">View source</a>
      </footer>
    </div>
  );
}
