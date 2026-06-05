import { useState, useRef, useCallback } from 'react';
import {
  initModel,
  checkPlagiarism,
  DEMO_SOURCE,
  DEMO_TARGET,
  type PlagiarismResult,
} from './checker';

type State = 'idle' | 'loading' | 'ready';

export default function App() {
  const [state, setState] = useState<State>('idle');
  const [progress, setProgress] = useState(0);
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkProgress, setCheckProgress] = useState('');
  const [result, setResult] = useState<PlagiarismResult | null>(null);
  const modelReady = useRef(false);

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
    setSource(DEMO_SOURCE);
    setTarget(DEMO_TARGET);
    setResult(null);
  }, []);

  const handleCheck = useCallback(async () => {
    if (!modelReady.current || !source.trim() || !target.trim()) return;
    setChecking(true);
    setResult(null);
    setCheckProgress('Analyzing...');

    const r = await checkPlagiarism(source, target, (done, total) => {
      setCheckProgress(`Comparing ${done}/${total} chunks...`);
    });

    setResult(r);
    setCheckProgress('');
    setChecking(false);
  }, [source, target]);

  const verdictColor = (verdict: PlagiarismResult['verdict']) => {
    switch (verdict) {
      case 'original': return 'text-green-400 bg-green-950 border-green-800';
      case 'similar': return 'text-yellow-400 bg-yellow-950 border-yellow-800';
      case 'suspicious': return 'text-orange-400 bg-orange-950 border-orange-800';
      case 'likely-plagiarized': return 'text-red-400 bg-red-950 border-red-800';
    }
  };

  const verdictLabel = (verdict: PlagiarismResult['verdict']) => {
    switch (verdict) {
      case 'original': return 'Original';
      case 'similar': return 'Similar';
      case 'suspicious': return 'Suspicious';
      case 'likely-plagiarized': return 'Likely Plagiarized';
    }
  };

  const gaugeColor = (score: number) => {
    if (score >= 0.7) return 'bg-red-500';
    if (score >= 0.5) return 'bg-orange-500';
    if (score >= 0.3) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const matchBorder = (sim: number) => {
    if (sim >= 0.7) return 'border-red-800';
    if (sim >= 0.6) return 'border-orange-800';
    return 'border-neutral-800';
  };

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">
          FreeAgentStore
        </a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
          Plagiarism Checker
        </h1>
      </header>

      <main className="flex-1 flex flex-col max-w-5xl mx-auto w-full p-4 gap-4">
        {state === 'idle' && (
          <div className="text-center py-12">
            <p className="text-neutral-400 mb-4">
              Compare two texts for semantic similarity. ~23MB model download, cached for next time.
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
          <>
            {/* Input textareas */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-neutral-300">Original / Source</label>
                <textarea
                  value={source}
                  onChange={(e) => { setSource(e.target.value); setResult(null); }}
                  placeholder="Paste the original text here..."
                  className="min-h-[180px] bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-sm text-neutral-200 placeholder-neutral-600 resize-none focus:outline-none focus:border-neutral-700"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-neutral-300">Submitted / Target</label>
                <textarea
                  value={target}
                  onChange={(e) => { setTarget(e.target.value); setResult(null); }}
                  placeholder="Paste the submitted text here..."
                  className="min-h-[180px] bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-sm text-neutral-200 placeholder-neutral-600 resize-none focus:outline-none focus:border-neutral-700"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleCheck}
                disabled={checking || !source.trim() || !target.trim()}
                className="px-5 py-2 rounded-lg font-semibold text-sm text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {checking ? 'Checking...' : 'Check'}
              </button>
              <button
                onClick={loadDemo}
                className="text-xs px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400"
              >
                Load Demo Texts
              </button>
              {checkProgress && (
                <span className="text-xs text-neutral-500">{checkProgress}</span>
              )}
            </div>

            {/* Results */}
            {result && (
              <div className="space-y-4">
                {/* Overall score gauge */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold font-mono text-neutral-100">
                        {Math.round(result.overallScore * 100)}%
                      </span>
                      <span className="text-sm text-neutral-400">overall similarity</span>
                    </div>
                    <span className={`text-xs font-semibold px-3 py-1 rounded border ${verdictColor(result.verdict)}`}>
                      {verdictLabel(result.verdict)}
                    </span>
                  </div>
                  <div className="w-full h-3 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${gaugeColor(result.overallScore)} transition-all`}
                      style={{ width: `${Math.round(result.overallScore * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-neutral-500 mt-2">
                    Highest paragraph match: {Math.round(result.highestMatch * 100)}%
                  </p>
                </div>

                {/* Per-paragraph breakdown */}
                <div>
                  <h3 className="text-sm font-semibold text-neutral-300 mb-2">
                    Paragraph Breakdown ({result.paragraphMatches.length} comparisons)
                  </h3>
                  <div className="space-y-2">
                    {result.paragraphMatches.map((m, i) => (
                      <div
                        key={i}
                        className={`bg-neutral-900 border rounded-lg p-3 ${matchBorder(m.similarity)}`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-neutral-500">Target #{m.targetIndex + 1}</span>
                          <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${gaugeColor(m.similarity)} transition-all`}
                              style={{ width: `${Math.round(m.similarity * 100)}%` }}
                            />
                          </div>
                          <span className={`text-xs font-mono w-10 text-right ${
                            m.similarity >= 0.6 ? 'text-red-400' : 'text-neutral-400'
                          }`}>
                            {Math.round(m.similarity * 100)}%
                          </span>
                        </div>
                        <div className="grid md:grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="text-neutral-500 mb-1">Submitted paragraph:</p>
                            <p className={`text-neutral-300 leading-relaxed ${
                              m.similarity >= 0.6 ? 'bg-red-950/30 rounded p-1.5' : ''
                            }`}>
                              {m.targetParagraph.length > 200
                                ? m.targetParagraph.slice(0, 200) + '...'
                                : m.targetParagraph}
                            </p>
                          </div>
                          <div>
                            <p className="text-neutral-500 mb-1">Best source match:</p>
                            <p className="text-neutral-400 leading-relaxed">
                              {m.sourceParagraph.length > 200
                                ? m.sourceParagraph.slice(0, 200) + '...'
                                : m.sourceParagraph}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Powered by <a href="https://huggingface.co/Xenova/all-MiniLM-L6-v2" className="underline">MiniLM</a> via Transformers.js.
        Texts never leave your device.
      </footer>
    </div>
  );
}
