import { useState, useEffect, useRef, useCallback } from 'react';
import { parseName, type ParsedName } from './parser';

const EXAMPLES = [
  'Dr. Maria Jose Garcia-Lopez III',
  'Kim Jong-un',
  'Bjork',
  'Ludwig van Beethoven',
  'Martin Luther King Jr.',
  'Jean-Pierre de la Fontaine',
  "Conor O'Brien",
  'Mao Zedong',
  'Prof. William H. Gates Sr.',
  'Jose Luis Rodriguez Gonzalez',
  'el-Sayed Hassan',
  'Nguyen Thi Minh',
];

const FORMAT_COLORS: Record<string, string> = {
  western: 'bg-blue-900/50 text-blue-400 border-blue-800',
  eastern: 'bg-amber-900/50 text-amber-400 border-amber-800',
  hispanic: 'bg-orange-900/50 text-orange-400 border-orange-800',
  mononym: 'bg-purple-900/50 text-purple-400 border-purple-800',
  generic: 'bg-neutral-800 text-neutral-400 border-neutral-700',
};

const FIELD_COLORS: Record<string, string> = {
  prefix: 'bg-teal-900/60 border-teal-700 text-teal-300',
  first: 'bg-blue-900/60 border-blue-700 text-blue-300',
  middle: 'bg-indigo-900/60 border-indigo-700 text-indigo-300',
  last: 'bg-violet-900/60 border-violet-700 text-violet-300',
  suffix: 'bg-pink-900/60 border-pink-700 text-pink-300',
};

function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 85 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-neutral-500 tabular-nums w-8 text-right">{pct}%</span>
    </div>
  );
}

function FieldBox({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  const cls = FIELD_COLORS[label] || FIELD_COLORS.first;
  return (
    <div className={`rounded-lg border px-3 py-2 ${cls}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-60 mb-0.5">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

function ResultCard({ result }: { result: ParsedName }) {
  const formatCls = FORMAT_COLORS[result.format] || FORMAT_COLORS.generic;

  const fields: { label: string; value: string | null }[] = [
    { label: 'prefix', value: result.prefix },
    { label: 'first', value: result.first || null },
    { label: 'middle', value: result.middle },
    { label: 'last', value: result.last },
    { label: 'suffix', value: result.suffix },
  ];

  const activeFields = fields.filter(f => f.value);

  return (
    <div className="space-y-3">
      {/* Field boxes */}
      <div className="flex flex-wrap gap-2">
        {activeFields.map((f) => (
          <FieldBox key={f.label} label={f.label} value={f.value} />
        ))}
      </div>

      {/* Format + confidence */}
      <div className="flex items-center gap-3">
        <span className={`text-xs px-2 py-0.5 rounded border ${formatCls}`}>
          {result.format.charAt(0).toUpperCase() + result.format.slice(1)}
        </span>
        <div className="flex-1">
          <ConfidenceMeter value={result.confidence} />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<ParsedName | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (input.trim()) {
        setResult(parseName(input));
      } else {
        setResult(null);
      }
    }, 80);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [input]);

  const handleExample = useCallback((text: string) => {
    setInput(text);
    inputRef.current?.focus();
  }, []);

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">
          FreeAgentStore
        </a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
          Name Parser
        </h1>
        <span className="text-xs px-2 py-0.5 rounded bg-violet-900/50 text-violet-400 border border-violet-800">
          Evolved
        </span>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
          Heuristic — 1500 examples
        </span>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 gap-4">
        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a name..."
          className="w-full px-4 py-3 rounded-lg bg-neutral-900 border border-neutral-800 focus:outline-none focus:border-neutral-600 text-neutral-100 placeholder:text-neutral-600 text-lg"
          autoFocus
        />

        {/* Quick examples */}
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => handleExample(ex)}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>

        {/* Result */}
        {input.trim() && !result && (
          <div className="text-center py-8 text-neutral-600 text-sm">
            Could not parse this name
          </div>
        )}
        {result && result.first && <ResultCard result={result} />}
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Parse any human name into structured components. Runs in your browser — no server, no tracking.
      </footer>
    </div>
  );
}
