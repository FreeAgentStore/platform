import { useState, useRef, useCallback, useEffect } from 'react';
import {
  initModel,
  indexFAQ,
  findAnswer,
  DEMO_FAQ,
  type FAQEntry,
  type MatchResult,
} from './matcher';

type State = 'idle' | 'loading' | 'ready';

export default function App() {
  const [state, setState] = useState<State>('idle');
  const [progress, setProgress] = useState(0);
  const [faqText, setFaqText] = useState('');
  const [indexedFAQ, setIndexedFAQ] = useState<FAQEntry[]>([]);
  const [indexing, setIndexing] = useState(false);
  const [indexProgress, setIndexProgress] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MatchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const modelReady = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const init = useCallback(async () => {
    setState('loading');
    setProgress(0);
    try {
      await initModel((pct) => setProgress(pct));
      modelReady.current = true;
      setState('ready');
    } catch (e) {
      console.error(e);
      setState('idle');
    }
  }, []);

  const loadDemo = useCallback(() => {
    const text = DEMO_FAQ.map((e) => `Q: ${e.question}\nA: ${e.answer}`).join('\n\n');
    setFaqText(text);
  }, []);

  const parseFAQText = useCallback((text: string): { question: string; answer: string }[] => {
    // Try JSON array first
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].question && parsed[0].answer) {
        return parsed;
      }
    } catch {
      // Not JSON, parse Q:/A: format
    }

    const entries: { question: string; answer: string }[] = [];
    const blocks = text.split(/\n\s*\n/);
    for (const block of blocks) {
      const lines = block.trim().split('\n');
      let question = '';
      let answer = '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (/^Q:\s*/i.test(trimmed)) {
          question = trimmed.replace(/^Q:\s*/i, '');
        } else if (/^A:\s*/i.test(trimmed)) {
          answer = trimmed.replace(/^A:\s*/i, '');
        } else if (question && !answer) {
          question += ' ' + trimmed;
        } else if (answer) {
          answer += ' ' + trimmed;
        }
      }
      if (question && answer) {
        entries.push({ question: question.trim(), answer: answer.trim() });
      }
    }
    return entries;
  }, []);

  const handleIndex = useCallback(async () => {
    if (!modelReady.current || !faqText.trim()) return;
    setIndexing(true);
    setIndexedFAQ([]);
    setResults([]);
    setIndexProgress('Parsing...');

    const entries = parseFAQText(faqText);
    if (entries.length === 0) {
      setIndexProgress('No Q&A pairs found. Use "Q: question" / "A: answer" format.');
      setIndexing(false);
      return;
    }

    const indexed = await indexFAQ(entries, (done, total) => {
      setIndexProgress(`Embedding ${done}/${total}...`);
    });

    setIndexedFAQ(indexed);
    setIndexProgress('');
    setIndexing(false);
  }, [faqText, parseFAQText]);

  // Debounced search
  useEffect(() => {
    if (!modelReady.current || indexedFAQ.length === 0 || !query.trim()) {
      setResults([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const matches = await findAnswer(query, indexedFAQ, 5);
      setResults(matches);
      setSearching(false);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, indexedFAQ]);

  const scoreColor = (score: number) => {
    if (score >= 0.7) return 'bg-green-500';
    if (score >= 0.5) return 'bg-yellow-500';
    if (score >= 0.4) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">
          FreeAgentStore
        </a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
          FAQ Matcher
        </h1>
      </header>

      <main className="flex-1 flex flex-col max-w-5xl mx-auto w-full p-4 gap-4">
        {state === 'idle' && (
          <div className="text-center py-12">
            <p className="text-neutral-400 mb-4">
              Index your FAQ, then find the best answer for any question. ~23MB model download, cached for next time.
            </p>
            <button onClick={init} className="px-6 py-3 rounded-lg font-semibold text-white bg-violet-600 hover:bg-violet-500">
              Download Model
            </button>
          </div>
        )}

        {state === 'loading' && (
          <div className="text-center py-12">
            <div className="w-48 h-2 bg-neutral-800 rounded-full mx-auto overflow-hidden">
              <div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-neutral-400 mt-3 text-sm">Downloading MiniLM model... {progress}%</p>
          </div>
        )}

        {state === 'ready' && (
          <div className="grid md:grid-cols-2 gap-4 flex-1">
            {/* Left: FAQ Setup */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-neutral-300">FAQ Setup</h2>
                <button
                  onClick={loadDemo}
                  className="text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400"
                >
                  Load Demo FAQ
                </button>
              </div>
              <textarea
                value={faqText}
                onChange={(e) => setFaqText(e.target.value)}
                placeholder={"Q: How do I reset my password?\nA: Click \"Forgot Password\" on the login page.\n\nQ: What plans do you offer?\nA: We offer Free, Pro, and Enterprise plans."}
                className="flex-1 min-h-[200px] bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-sm text-neutral-200 placeholder-neutral-600 resize-none focus:outline-none focus:border-neutral-700"
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={handleIndex}
                  disabled={indexing || !faqText.trim()}
                  className="px-4 py-2 rounded-lg font-semibold text-sm text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {indexing ? 'Indexing...' : 'Index FAQ'}
                </button>
                {indexedFAQ.length > 0 && (
                  <span className="text-xs text-neutral-400">
                    {indexedFAQ.length} question{indexedFAQ.length !== 1 ? 's' : ''} indexed
                  </span>
                )}
                {indexProgress && (
                  <span className="text-xs text-neutral-500">{indexProgress}</span>
                )}
              </div>
            </div>

            {/* Right: Ask a question */}
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-neutral-300">Ask a Question</h2>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={indexedFAQ.length > 0 ? 'Type your question...' : 'Index your FAQ first...'}
                disabled={indexedFAQ.length === 0}
                className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-700 disabled:opacity-50"
              />

              {searching && (
                <p className="text-xs text-neutral-500">Searching...</p>
              )}

              {!searching && query.trim() && results.length > 0 && (
                <div className="flex flex-col gap-2 overflow-y-auto">
                  {results[0].score < 0.4 && (
                    <p className="text-xs text-orange-400 px-1">No good match found. Try rephrasing your question.</p>
                  )}
                  {results.map((r) => (
                    <div
                      key={r.rank}
                      className={`bg-neutral-900 border rounded-lg p-3 ${
                        r.rank === 1 && r.score >= 0.7
                          ? 'border-green-800'
                          : 'border-neutral-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs text-neutral-500 w-4">#{r.rank}</span>
                        <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${scoreColor(r.score)} transition-all`}
                            style={{ width: `${Math.round(r.score * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-neutral-400 w-10 text-right">
                          {Math.round(r.score * 100)}%
                        </span>
                      </div>
                      <p className="text-sm font-medium text-neutral-200 mb-1">{r.question}</p>
                      <p className="text-sm text-neutral-400">{r.answer}</p>
                    </div>
                  ))}
                </div>
              )}

              {!searching && query.trim() && results.length === 0 && indexedFAQ.length > 0 && (
                <p className="text-xs text-neutral-500">Type to search...</p>
              )}

              {indexedFAQ.length === 0 && (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-neutral-600 text-center">
                    Paste your FAQ on the left and click "Index FAQ" to get started.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Powered by <a href="https://huggingface.co/Xenova/all-MiniLM-L6-v2" className="underline">MiniLM</a> via Transformers.js.
        Data never leaves your device.
      </footer>
    </div>
  );
}
