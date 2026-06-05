import { useState } from 'react';
import { classifyTopic, type Topic } from './classifier';

const TOPIC_CONFIG: Record<Topic, { color: string; bar: string; label: string }> = {
  technology:    { color: 'text-blue-400',    bar: 'bg-blue-400',    label: 'Technology' },
  business:      { color: 'text-amber-400',   bar: 'bg-amber-400',   label: 'Business' },
  health:        { color: 'text-green-400',   bar: 'bg-green-400',   label: 'Health' },
  sports:        { color: 'text-orange-400',  bar: 'bg-orange-400',  label: 'Sports' },
  entertainment: { color: 'text-pink-400',    bar: 'bg-pink-400',    label: 'Entertainment' },
  science:       { color: 'text-cyan-400',    bar: 'bg-cyan-400',    label: 'Science' },
  politics:      { color: 'text-red-400',     bar: 'bg-red-400',     label: 'Politics' },
  finance:       { color: 'text-emerald-400', bar: 'bg-emerald-400', label: 'Finance' },
  education:     { color: 'text-violet-400',  bar: 'bg-violet-400',  label: 'Education' },
  travel:        { color: 'text-sky-400',     bar: 'bg-sky-400',     label: 'Travel' },
};

const SAMPLES = [
  "Apple announced the new iPhone with AI features at WWDC",
  "The Fed raised interest rates to combat inflation",
  "A new study finds exercise reduces anxiety by 40%",
  "Manchester City won the Premier League title",
  "The Mars rover discovered evidence of ancient water",
];

export default function App() {
  const [text, setText] = useState('');
  const result = text.trim() ? classifyTopic(text) : null;

  const primaryConfig = result ? TOPIC_CONFIG[result.topic] : null;
  const secondaryConfig = result?.secondary ? TOPIC_CONFIG[result.secondary] : null;

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">
          FreeAgentStore
        </a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
          Topic Classifier
        </h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
          Heuristic — no model needed
        </span>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 gap-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste text to classify its topic — technology, business, health, sports, entertainment, science, politics, finance, education, or travel..."
          className="w-full h-40 p-4 rounded-lg bg-neutral-900 border border-neutral-800 resize-none focus:outline-none focus:border-neutral-600 text-neutral-100 placeholder:text-neutral-600"
        />

        {result && primaryConfig && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`text-2xl font-bold ${primaryConfig.color}`}>
                {primaryConfig.label}
              </span>
              {secondaryConfig && (
                <>
                  <span className="text-neutral-600">+</span>
                  <span className={`text-lg font-semibold ${secondaryConfig.color}`}>
                    {secondaryConfig.label}
                  </span>
                </>
              )}
            </div>

            <div className="text-sm">
              <span className="text-neutral-500">Confidence</span>
              <span className="ml-2 font-mono text-neutral-300">{(result.confidence * 100).toFixed(0)}%</span>
            </div>

            <div className="space-y-2">
              <span className="text-xs text-neutral-500 uppercase tracking-wider">Scores</span>
              {(Object.entries(result.scores) as [Topic, number][])
                .sort((a, b) => b[1] - a[1])
                .map(([topic, score]) => (
                  <div key={topic} className="flex items-center gap-2 text-sm">
                    <span className="w-24 text-neutral-400 text-right">{TOPIC_CONFIG[topic].label}</span>
                    <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${TOPIC_CONFIG[topic].bar}`}
                        style={{ width: `${score * 100}%` }}
                      />
                    </div>
                    <span className="w-10 text-right font-mono text-neutral-500 text-xs">
                      {(score * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
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
        )}

        <div className="space-y-2">
          <span className="text-xs text-neutral-500 uppercase tracking-wider">Try a sample</span>
          <div className="flex flex-wrap gap-2">
            {SAMPLES.map((s, i) => (
              <button
                key={i}
                onClick={() => setText(s)}
                className="text-xs px-3 py-1.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 transition-colors text-left"
              >
                {s.length > 55 ? s.slice(0, 55) + '...' : s}
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
        <a href="https://github.com/FreeAgentStore/platform/blob/main/agents/topic-classifier/web/src/classifier.ts" className="underline ml-1">View source</a>
      </footer>
    </div>
  );
}
