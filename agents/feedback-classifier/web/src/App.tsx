import { useState } from 'react';
import { classifyFeedback, type FeedbackType } from './classifier';

const TYPE_CONFIG: Record<FeedbackType, { color: string; icon: string; label: string }> = {
  bug: { color: 'text-red-400', icon: '!', label: 'Bug Report' },
  feature: { color: 'text-blue-400', icon: '+', label: 'Feature Request' },
  complaint: { color: 'text-orange-400', icon: '-', label: 'Complaint' },
  praise: { color: 'text-green-400', icon: '*', label: 'Praise' },
  question: { color: 'text-purple-400', icon: '?', label: 'Question' },
  suggestion: { color: 'text-teal-400', icon: '~', label: 'Suggestion' },
};

const BAR_COLORS: Record<FeedbackType, string> = {
  bug: 'bg-red-400',
  feature: 'bg-blue-400',
  complaint: 'bg-orange-400',
  praise: 'bg-green-400',
  question: 'bg-purple-400',
  suggestion: 'bg-teal-400',
};

const SAMPLES = [
  "The app crashes when I click the save button on iOS 17",
  "Would be great to have dark mode support",
  "This is the worst app I've ever used, total waste of money",
  "Absolutely love this! Best tool I've found",
  "How do I export my data?",
  "Maybe consider adding keyboard shortcuts?",
];

export default function App() {
  const [text, setText] = useState('');
  const result = text.trim() ? classifyFeedback(text) : null;

  const config = result ? TYPE_CONFIG[result.type] : null;

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">
          FreeAgentStore
        </a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
          Feedback Classifier
        </h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
          Heuristic — no model needed
        </span>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 gap-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste feedback to classify — bug, feature, complaint, praise, question, or suggestion..."
          className="w-full h-40 p-4 rounded-lg bg-neutral-900 border border-neutral-800 resize-none focus:outline-none focus:border-neutral-600 text-neutral-100 placeholder:text-neutral-600"
        />

        {result && config && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-3">
              <span className={`text-2xl font-bold ${config.color}`}>
                {config.icon} {config.label}
              </span>
              {result.actionable && (
                <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-amber-400 border border-amber-400/30">
                  Actionable
                </span>
              )}
            </div>

            <div className="text-sm">
              <span className="text-neutral-500">Confidence</span>
              <span className="ml-2 font-mono text-neutral-300">{(result.confidence * 100).toFixed(0)}%</span>
            </div>

            <div className="space-y-2">
              <span className="text-xs text-neutral-500 uppercase tracking-wider">Scores</span>
              {(Object.entries(result.scores) as [FeedbackType, number][])
                .sort((a, b) => b[1] - a[1])
                .map(([type, score]) => (
                  <div key={type} className="flex items-center gap-2 text-sm">
                    <span className="w-20 text-neutral-400 text-right">{TYPE_CONFIG[type].label}</span>
                    <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${BAR_COLORS[type]}`}
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
        <a href="https://github.com/FreeAgentStore/platform/blob/main/agents/feedback-classifier/web/src/classifier.ts" className="underline ml-1">View source</a>
      </footer>
    </div>
  );
}
