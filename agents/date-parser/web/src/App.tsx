import { useState, useEffect, useRef, useCallback } from 'react';
import { parseDate, formatRelative, type ParsedDate } from './parser';

const EXAMPLES = [
  'today',
  'next friday',
  'March 14, 2025',
  'in 3 weeks',
  '1710374400',
  '14.03.2025',
  'tomorrow at 3pm',
  '2025-03-14T10:30:00Z',
  '3 days ago',
  'end of month',
];

const DAY_NAMES_SHORT = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function MiniCalendar({ date, endDate }: { date: Date; endDate?: Date }) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Monday = 0 offset
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const targetDay = date.getDate();
  const endDay = endDate && endDate.getMonth() === month && endDate.getFullYear() === year
    ? endDate.getDate() : null;

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className="bg-neutral-900 rounded-lg p-3 border border-neutral-800">
      <p className="text-xs text-neutral-400 text-center mb-2 font-medium">
        {monthNames[month]} {year}
      </p>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {DAY_NAMES_SHORT.map((d) => (
          <div key={d} className="text-[10px] text-neutral-600 font-medium py-0.5">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />;
          const isTarget = day === targetDay;
          const isInRange = endDay !== null && day >= targetDay && day <= endDay;
          const isEnd = day === endDay;

          let cls = 'text-[11px] py-0.5 rounded ';
          if (isTarget) cls += 'bg-violet-600 text-white font-bold';
          else if (isEnd) cls += 'bg-violet-600/70 text-white font-bold';
          else if (isInRange) cls += 'bg-violet-600/20 text-violet-300';
          else cls += 'text-neutral-500';

          return <div key={day} className={cls}>{day}</div>;
        })}
      </div>
    </div>
  );
}

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

function ResultCard({ result, now }: { result: ParsedDate; now: Date }) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1200);
  }, []);

  const rows: { label: string; value: string; copyKey: string }[] = [
    { label: 'Human', value: result.formatted, copyKey: 'human' },
    { label: 'ISO 8601', value: result.iso, copyKey: 'iso' },
    { label: 'Unix', value: String(result.unix), copyKey: 'unix' },
    { label: 'Relative', value: formatRelative(result.date, now), copyKey: 'rel' },
  ];

  if (result.isRange && result.endDate) {
    rows.push({ label: 'End date', value: result.endDate.toISOString().slice(0, 10), copyKey: 'end' });
  }

  return (
    <div className="space-y-3">
      <div className="bg-neutral-900 rounded-lg border border-neutral-800 divide-y divide-neutral-800">
        {rows.map((row) => (
          <button
            key={row.label}
            onClick={() => copy(row.value, row.copyKey)}
            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-neutral-800/50 transition-colors text-left"
          >
            <span className="text-xs text-neutral-500 w-16 shrink-0">{row.label}</span>
            <span className="text-sm text-neutral-200 font-mono truncate flex-1 mx-3">{row.value}</span>
            <span className="text-[10px] text-neutral-600 w-12 text-right">
              {copied === row.copyKey ? 'Copied!' : 'Copy'}
            </span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700">
          {result.format}
        </span>
        {result.isRange && (
          <span className="text-xs px-2 py-0.5 rounded bg-violet-900/50 text-violet-400 border border-violet-800">
            Range
          </span>
        )}
        <div className="flex-1">
          <ConfidenceMeter value={result.confidence} />
        </div>
      </div>

      <MiniCalendar date={result.date} endDate={result.endDate} />
    </div>
  );
}

export default function App() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<ParsedDate | null>(null);
  const [nowOverride, setNowOverride] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const now = nowOverride ? new Date(nowOverride) : currentTime;
  const nowValid = !isNaN(now.getTime());
  const effectiveNow = nowValid ? now : currentTime;

  // Tick the clock every second
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Debounced parsing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (input.trim()) {
        setResult(parseDate(input, effectiveNow));
      } else {
        setResult(null);
      }
    }, 150);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [input, effectiveNow]);

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
          Date Parser
        </h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
          Heuristic — 500+ formats
        </span>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 gap-4">
        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type any date or time..."
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
            Could not parse this input
          </div>
        )}
        {result && <ResultCard result={result} now={effectiveNow} />}

        {/* Now reference */}
        <div className="mt-auto pt-4 border-t border-neutral-800">
          <div className="flex items-center gap-3">
            <span className="text-xs text-neutral-500 shrink-0">Reference "now":</span>
            <input
              type="text"
              value={nowOverride}
              onChange={(e) => setNowOverride(e.target.value)}
              placeholder={currentTime.toISOString().slice(0, 19)}
              className="flex-1 px-3 py-1.5 rounded bg-neutral-900 border border-neutral-800 focus:outline-none focus:border-neutral-600 text-neutral-300 placeholder:text-neutral-600 text-xs font-mono"
            />
            {nowOverride && (
              <button
                onClick={() => setNowOverride('')}
                className="text-xs text-neutral-500 hover:text-neutral-300"
              >
                Reset
              </button>
            )}
          </div>
          {nowOverride && !nowValid && (
            <p className="text-xs text-red-500 mt-1">Invalid date — using current time</p>
          )}
        </div>
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Parse any date or time string into structured data. Runs in your browser — no server, no tracking.
      </footer>
    </div>
  );
}
