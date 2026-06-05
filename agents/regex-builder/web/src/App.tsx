import { useState, useCallback, useMemo } from 'react';
import { PATTERNS, matchPattern, buildFromDescription, tryBuiltInAI, type Pattern } from './patterns';

type Source = 'Pattern Library' | 'Heuristic Builder' | 'Chrome AI' | null;

const PRESETS = ['Email', 'URL', 'Phone', 'Date', 'IP Address', 'Password'];

export default function App() {
  const [query, setQuery] = useState('');
  const [regex, setRegex] = useState('');
  const [flags, setFlags] = useState({ g: true, i: false, m: false, s: false });
  const [testInput, setTestInput] = useState('');
  const [source, setSource] = useState<Source>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedPattern, setSelectedPattern] = useState<Pattern | null>(null);

  const flagString = useMemo(() => {
    return (flags.g ? 'g' : '') + (flags.i ? 'i' : '') + (flags.m ? 'm' : '') + (flags.s ? 's' : '');
  }, [flags]);

  const matches = useMemo(() => {
    if (!regex || !testInput) return [];
    try {
      const re = new RegExp(regex, flagString || 'g');
      const results: { text: string; index: number; groups: string[] }[] = [];
      let m: RegExpExecArray | null;

      // Prevent infinite loops on zero-length matches
      let safety = 0;
      while ((m = re.exec(testInput)) !== null && safety < 1000) {
        results.push({
          text: m[0],
          index: m.index,
          groups: m.slice(1),
        });
        if (!re.global) break;
        if (m[0].length === 0) re.lastIndex++;
        safety++;
      }
      return results;
    } catch {
      return [];
    }
  }, [regex, testInput, flagString]);

  const regexValid = useMemo(() => {
    if (!regex) return true;
    try {
      new RegExp(regex, flagString);
      return true;
    } catch {
      return false;
    }
  }, [regex, flagString]);

  const highlightedTest = useMemo(() => {
    if (!regex || !testInput || !regexValid || matches.length === 0) return null;
    try {
      const re = new RegExp(regex, flagString.includes('g') ? flagString : flagString + 'g');
      const parts: { text: string; match: boolean }[] = [];
      let lastIndex = 0;
      let m: RegExpExecArray | null;
      let safety = 0;

      while ((m = re.exec(testInput)) !== null && safety < 1000) {
        if (m.index > lastIndex) {
          parts.push({ text: testInput.slice(lastIndex, m.index), match: false });
        }
        parts.push({ text: m[0], match: true });
        lastIndex = m.index + m[0].length;
        if (m[0].length === 0) { re.lastIndex++; }
        safety++;
      }
      if (lastIndex < testInput.length) {
        parts.push({ text: testInput.slice(lastIndex), match: false });
      }
      return parts;
    } catch {
      return null;
    }
  }, [regex, testInput, flagString, regexValid, matches]);

  const handleSearch = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setLoading(true);

    // 1. Try pattern library
    const libraryMatches = matchPattern(text);
    if (libraryMatches.length > 0) {
      const best = libraryMatches[0];
      setRegex(best.regex);
      setFlags({ g: best.flags.includes('g'), i: best.flags.includes('i'), m: best.flags.includes('m'), s: best.flags.includes('s') });
      setSource('Pattern Library');
      setSelectedPattern(best);
      setLoading(false);
      return;
    }

    // 2. Try heuristic builder
    const built = buildFromDescription(text);
    if (built) {
      setRegex(built);
      setSource('Heuristic Builder');
      setSelectedPattern(null);
      setLoading(false);
      return;
    }

    // 3. Try Chrome Built-in AI
    const aiResult = await tryBuiltInAI(text);
    if (aiResult) {
      setRegex(aiResult.regex);
      setFlags({ g: aiResult.flags.includes('g'), i: aiResult.flags.includes('i'), m: aiResult.flags.includes('m'), s: aiResult.flags.includes('s') });
      setSource('Chrome AI');
      setSelectedPattern(null);
      setLoading(false);
      return;
    }

    setLoading(false);
  }, []);

  const handlePreset = useCallback((name: string) => {
    const pattern = PATTERNS.find(p => p.name === name || p.name.startsWith(name));
    if (pattern) {
      setQuery(name.toLowerCase());
      setRegex(pattern.regex);
      setFlags({ g: pattern.flags.includes('g'), i: pattern.flags.includes('i'), m: pattern.flags.includes('m'), s: pattern.flags.includes('s') });
      setSource('Pattern Library');
      setSelectedPattern(pattern);
      setTestInput(pattern.examples.join('\n'));
    }
  }, []);

  const copyRegex = useCallback(() => {
    const full = `/${regex}/${flagString}`;
    navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [regex, flagString]);

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">
          FreeAgentStore
        </a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
          Regex Builder
        </h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
          Heuristic
        </span>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 gap-4">
        {/* Search */}
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(query); }}
            placeholder="Describe what you want to match..."
            className="flex-1 px-4 py-3 rounded-lg bg-neutral-900 border border-neutral-800 focus:outline-none focus:border-neutral-600 text-neutral-100 placeholder:text-neutral-600"
          />
          <button
            onClick={() => handleSearch(query)}
            disabled={loading || !query.trim()}
            className="px-5 py-3 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
          >
            {loading ? '...' : 'Build'}
          </button>
        </div>

        {/* Presets */}
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((name) => (
            <button
              key={name}
              onClick={() => handlePreset(name)}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 transition-colors"
            >
              {name}
            </button>
          ))}
        </div>

        {/* Regex result */}
        {regex && (
          <div className="space-y-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-500">Pattern</span>
                  {source && (
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      source === 'Pattern Library' ? 'bg-emerald-900/50 text-emerald-400' :
                      source === 'Heuristic Builder' ? 'bg-amber-900/50 text-amber-400' :
                      'bg-blue-900/50 text-blue-400'
                    }`}>
                      {source}
                    </span>
                  )}
                </div>
                <button
                  onClick={copyRegex}
                  className="text-xs px-2 py-1 rounded bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className={`font-mono text-sm break-all p-3 rounded ${regexValid ? 'bg-neutral-950' : 'bg-red-950/30 border border-red-900'}`}>
                <span className="text-neutral-500">/</span>
                <span className="text-violet-400">{regex}</span>
                <span className="text-neutral-500">/</span>
                <span className="text-emerald-400">{flagString}</span>
              </div>
              {!regexValid && (
                <p className="text-xs text-red-400 mt-2">Invalid regular expression</p>
              )}
              {selectedPattern && (
                <p className="text-xs text-neutral-500 mt-2">{selectedPattern.description}</p>
              )}
            </div>

            {/* Flags */}
            <div className="flex items-center gap-4">
              <span className="text-xs text-neutral-500">Flags:</span>
              {(['g', 'i', 'm', 's'] as const).map((flag) => (
                <label key={flag} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={flags[flag]}
                    onChange={(e) => setFlags(prev => ({ ...prev, [flag]: e.target.checked }))}
                    className="rounded border-neutral-700 bg-neutral-900 text-violet-600 focus:ring-violet-600 focus:ring-offset-0"
                  />
                  <span className="text-xs font-mono text-neutral-400">
                    {flag === 'g' ? 'g (global)' : flag === 'i' ? 'i (case-insensitive)' : flag === 'm' ? 'm (multiline)' : 's (dotAll)'}
                  </span>
                </label>
              ))}
            </div>

            {/* Live test */}
            <div className="space-y-2">
              <label className="text-xs text-neutral-500">Test string</label>
              <textarea
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder="Type test strings here to see matches..."
                rows={4}
                className="w-full px-4 py-3 rounded-lg bg-neutral-900 border border-neutral-800 focus:outline-none focus:border-neutral-600 text-neutral-100 placeholder:text-neutral-600 font-mono text-sm resize-y"
              />
            </div>

            {/* Highlighted matches */}
            {highlightedTest && highlightedTest.length > 0 && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                <p className="text-xs text-neutral-500 mb-2">Highlighted matches</p>
                <pre className="font-mono text-sm whitespace-pre-wrap break-all">
                  {highlightedTest.map((part, i) => (
                    <span
                      key={i}
                      className={part.match ? 'bg-violet-600/30 text-violet-300 rounded px-0.5' : 'text-neutral-300'}
                    >
                      {part.text}
                    </span>
                  ))}
                </pre>
              </div>
            )}

            {/* Match results */}
            {testInput && regexValid && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                <p className="text-xs text-neutral-500 mb-2">
                  {matches.length === 0 ? 'No matches' : `${matches.length} match${matches.length === 1 ? '' : 'es'}`}
                </p>
                {matches.length > 0 && (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {matches.map((m, i) => (
                      <div key={i} className="flex items-baseline gap-3 text-xs">
                        <span className="text-neutral-600 font-mono w-8 text-right shrink-0">[{m.index}]</span>
                        <span className="font-mono text-emerald-400 break-all">{JSON.stringify(m.text)}</span>
                        {m.groups.length > 0 && (
                          <span className="text-neutral-500">
                            groups: {m.groups.map((g, j) => (
                              <span key={j} className="text-amber-400 ml-1">{JSON.stringify(g)}</span>
                            ))}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Describe a pattern in English, get a regex. Pattern library + live testing. Runs in your browser.
      </footer>
    </div>
  );
}
