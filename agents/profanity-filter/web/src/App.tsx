import { useState, useEffect, useRef, useCallback } from 'react';
import { checkProfanity, type FilterResult } from './filter';

const EXAMPLES: { label: string; text: string }[] = [
  { label: 'Clean text', text: 'The quick brown fox jumps over the lazy dog. What a beautiful day for a walk in the park.' },
  { label: 'Mild language', text: 'Damn, this crappy weather is really pissing me off. What the hell is going on?' },
  { label: 'Context: donkey', text: 'The donkey is a stubborn ass that refused to move from the road. The farmer rode his ass to market.' },
  { label: 'Context: assistant', text: 'The assistant helped assemble the class materials for the assessment session.' },
  { label: 'Context: hello', text: 'Hello Michelle! The seashell collection looks amazing in that nutshell display case.' },
  { label: 'Leetspeak', text: 'You are such an @ss and your work is $h1t. Go f*ck yourself.' },
  { label: 'Evasion', text: 'What the f u c k is wrong with you? That is total b.u.l.l.s.h.i.t and you know it.' },
  { label: 'Proper nouns', text: 'Dick Cheney met with Dick Van Dyke at the Hancock building to discuss the peacock display.' },
];

const SEVERITY_COLORS: Record<string, string> = {
  none: 'bg-emerald-900/50 text-emerald-400 border-emerald-800',
  mild: 'bg-yellow-900/50 text-yellow-400 border-yellow-800',
  moderate: 'bg-orange-900/50 text-orange-400 border-orange-800',
  severe: 'bg-red-900/50 text-red-400 border-red-800',
};

const SEVERITY_BAR_COLORS: Record<string, string> = {
  none: 'bg-emerald-500',
  mild: 'bg-yellow-500',
  moderate: 'bg-orange-500',
  severe: 'bg-red-500',
};

function ScoreBar({ score, severity }: { score: number; severity: string }) {
  const pct = Math.round(score * 100);
  const color = SEVERITY_BAR_COLORS[severity] || 'bg-neutral-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-neutral-500 tabular-nums w-8 text-right">{pct}%</span>
    </div>
  );
}

export default function App() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<FilterResult | null>(null);
  const [showMatches, setShowMatches] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (input.trim()) {
        setResult(checkProfanity(input));
      } else {
        setResult(null);
      }
    }, 150);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [input]);

  const handleExample = useCallback((text: string) => {
    setInput(text);
    textareaRef.current?.focus();
  }, []);

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">
          FreeAgentStore
        </a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
          Profanity Filter
        </h1>
        <span className="text-xs px-2 py-0.5 rounded bg-violet-900/50 text-violet-400 border border-violet-800">
          Evolved
        </span>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
          Heuristic — 5000 examples
        </span>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 gap-4">
        {/* Input */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type or paste text to check..."
          className="w-full px-4 py-3 rounded-lg bg-neutral-900 border border-neutral-800 focus:outline-none focus:border-neutral-600 text-neutral-100 placeholder:text-neutral-600 text-sm resize-none"
          rows={5}
          autoFocus
        />

        {/* Quick examples */}
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              onClick={() => handleExample(ex.text)}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 transition-colors"
            >
              {ex.label}
            </button>
          ))}
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-3">
            {/* Severity badge + score */}
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2.5 py-1 rounded border font-medium ${SEVERITY_COLORS[result.severity]}`}>
                {result.severity.charAt(0).toUpperCase() + result.severity.slice(1)}
              </span>
              {result.flagged && (
                <span className="text-xs text-neutral-500">
                  {result.matches.length} match{result.matches.length !== 1 ? 'es' : ''}
                </span>
              )}
              <div className="flex-1">
                <ScoreBar score={result.score} severity={result.severity} />
              </div>
            </div>

            {/* Matches */}
            {result.matches.length > 0 && (
              <div>
                <button
                  onClick={() => setShowMatches(!showMatches)}
                  className="text-xs text-neutral-500 hover:text-neutral-300 mb-2"
                >
                  {showMatches ? 'Hide' : 'Show'} matches
                </button>

                {showMatches && (
                  <div className="bg-neutral-900 rounded-lg border border-neutral-800 divide-y divide-neutral-800">
                    {result.matches.map((m, i) => (
                      <div key={i} className="px-4 py-2.5 text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-red-400">{m.word}</span>
                          {m.original.toLowerCase() !== m.word && (
                            <span className="text-neutral-600 text-xs">
                              (from "{m.original}")
                            </span>
                          )}
                          <span className="ml-auto text-xs px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-500">
                            {m.category}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-500 font-mono">{m.context}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Cleaned text */}
            {result.flagged && (
              <div>
                <p className="text-xs text-neutral-500 mb-1.5">Cleaned text:</p>
                <div className="bg-neutral-900 rounded-lg border border-neutral-800 px-4 py-3 text-sm text-neutral-300 font-mono whitespace-pre-wrap">
                  {result.cleaned}
                </div>
              </div>
            )}

            {!result.flagged && (
              <div className="text-center py-6 text-emerald-500 text-sm">
                No profanity detected
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Context-aware profanity detection with leetspeak and evasion handling. Runs in your browser — no server, no tracking.
      </footer>
    </div>
  );
}
