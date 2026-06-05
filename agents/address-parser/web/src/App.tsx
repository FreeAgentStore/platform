import { useState, useEffect, useRef, useCallback } from 'react';
import { parseAddress, type ParsedAddress } from './parser';

const EXAMPLES: { label: string; value: string }[] = [
  { label: 'US Home', value: '123 Main Street, San Francisco, CA 94102' },
  { label: 'US Office', value: '123 Main St., Suite 200, San Francisco, California 94102-1234' },
  { label: 'UK', value: '10 Downing Street, London SW1A 2AA' },
  { label: 'German', value: 'Friedrichstra\u00dfe 123, 10117 Berlin, Germany' },
  { label: 'French', value: '15 Rue de Rivoli, 75001 Paris, France' },
  { label: 'Japanese', value: '\u3012100-0001 \u6771\u4EAC\u90FD\u5343\u4EE3\u7530\u533A\u5343\u4EE3\u75301-1' },
];

const FORMAT_LABELS: Record<string, string> = {
  us: 'US',
  uk: 'UK',
  eu: 'EU',
  jp: 'JP',
  generic: 'Generic',
};

const FORMAT_COLORS: Record<string, string> = {
  us: 'bg-blue-900/50 text-blue-400 border-blue-800',
  uk: 'bg-red-900/50 text-red-400 border-red-800',
  eu: 'bg-emerald-900/50 text-emerald-400 border-emerald-800',
  jp: 'bg-rose-900/50 text-rose-400 border-rose-800',
  generic: 'bg-neutral-800 text-neutral-400 border-neutral-700',
};

function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 90 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-neutral-500 tabular-nums w-8 text-right">{pct}%</span>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }, [value]);

  return (
    <button
      onClick={copy}
      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-neutral-800/50 transition-colors text-left"
    >
      <span className="text-xs text-neutral-500 w-16 shrink-0">{label}</span>
      <span className="text-sm text-neutral-200 font-mono truncate flex-1 mx-3">{value}</span>
      <span className="text-[10px] text-neutral-600 w-12 text-right">
        {copied ? 'Copied!' : 'Copy'}
      </span>
    </button>
  );
}

function ResultCard({ result }: { result: ParsedAddress }) {
  const [copiedFormatted, setCopiedFormatted] = useState(false);

  const copyFormatted = useCallback(() => {
    navigator.clipboard.writeText(result.formatted);
    setCopiedFormatted(true);
    setTimeout(() => setCopiedFormatted(false), 1200);
  }, [result.formatted]);

  const fields: { label: string; value: string | null }[] = [
    { label: 'Street', value: result.street || null },
    { label: 'Unit', value: result.unit },
    { label: 'City', value: result.city || null },
    { label: 'State', value: result.state },
    { label: 'ZIP', value: result.zip },
    { label: 'Country', value: result.country },
  ];

  return (
    <div className="space-y-3">
      <div className="bg-neutral-900 rounded-lg border border-neutral-800 divide-y divide-neutral-800">
        {fields.map((f) => (
          <FieldRow key={f.label} label={f.label} value={f.value} />
        ))}
      </div>

      <div className="flex items-center gap-3">
        <span className={`text-xs px-2 py-0.5 rounded border ${FORMAT_COLORS[result.format]}`}>
          {FORMAT_LABELS[result.format]}
        </span>
        <div className="flex-1">
          <ConfidenceMeter value={result.confidence} />
        </div>
      </div>

      <button
        onClick={copyFormatted}
        className="w-full px-4 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-600 transition-colors text-left"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-500">Formatted</span>
          <span className="text-[10px] text-neutral-600">
            {copiedFormatted ? 'Copied!' : 'Copy'}
          </span>
        </div>
        <p className="text-sm text-neutral-300 font-mono mt-1 break-words">{result.formatted}</p>
      </button>
    </div>
  );
}

export default function App() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<ParsedAddress | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Debounced parsing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (input.trim()) {
        setResult(parseAddress(input));
      } else {
        setResult(null);
      }
    }, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [input]);

  const handleExample = useCallback((value: string) => {
    setInput(value);
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
          Address Parser
        </h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
          Evolved — 2000 addresses
        </span>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 gap-4">
        {/* Input */}
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste any address..."
          rows={2}
          className="w-full px-4 py-3 rounded-lg bg-neutral-900 border border-neutral-800 focus:outline-none focus:border-neutral-600 text-neutral-100 placeholder:text-neutral-600 text-lg resize-none"
          autoFocus
        />

        {/* Quick examples */}
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              onClick={() => handleExample(ex.value)}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 transition-colors"
            >
              {ex.label}
            </button>
          ))}
        </div>

        {/* Result */}
        {input.trim() && !result && (
          <div className="text-center py-8 text-neutral-600 text-sm">
            Could not parse this address
          </div>
        )}
        {result && <ResultCard result={result} />}
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Evolved heuristic — pure JS, zero model, works offline.
      </footer>
    </div>
  );
}
