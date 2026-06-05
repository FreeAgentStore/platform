import { useState } from 'react';
import { convert, getCategories } from './converter';

const categories = getCategories();

export default function App() {
  const [value, setValue] = useState('1');
  const [fromUnit, setFromUnit] = useState('km');
  const [toUnit, setToUnit] = useState('mi');
  const [category, setCategory] = useState('length');

  const unitsForCategory = categories.find(c => c.category === category)?.units ?? [];
  const result = value ? convert(Number(value), fromUnit, toUnit) : null;

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    const units = categories.find(c => c.category === cat)?.units ?? [];
    if (units.length >= 2) {
      setFromUnit(units[0].code);
      setToUnit(units[1].code);
    }
  };

  const swap = () => { setFromUnit(toUnit); setToUnit(fromUnit); };

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">FreeAgentStore</a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>Unit Converter</h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">Heuristic — no model needed</span>
      </header>

      <main className="flex-1 flex flex-col max-w-md mx-auto w-full p-4 gap-4">
        {/* Category pills */}
        <div className="flex flex-wrap gap-2">
          {categories.map(c => (
            <button key={c.category} onClick={() => handleCategoryChange(c.category)}
              className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-colors ${
                category === c.category ? 'bg-violet-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
              }`}>
              {c.category}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input type="number" value={value} onChange={e => setValue(e.target.value)}
              className="flex-1 p-3 rounded-lg bg-neutral-900 border border-neutral-800 text-lg font-mono focus:outline-none focus:border-violet-600" />
            <select value={fromUnit} onChange={e => setFromUnit(e.target.value)}
              className="px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-sm">
              {unitsForCategory.map(u => <option key={u.code} value={u.code}>{u.label}</option>)}
            </select>
          </div>

          <button onClick={swap} className="self-center w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 hover:bg-neutral-700">
            ↕
          </button>

          <div className="flex gap-2">
            <div className="flex-1 p-3 rounded-lg bg-neutral-900 border border-neutral-800 text-lg font-mono min-h-[3rem] flex items-center">
              {result && 'result' in result ? Number(result.result.toPrecision(8)) : result && 'error' in result ? <span className="text-red-400 text-sm">{result.error}</span> : '—'}
            </div>
            <select value={toUnit} onChange={e => setToUnit(e.target.value)}
              className="px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-sm">
              {unitsForCategory.map(u => <option key={u.code} value={u.code}>{u.label}</option>)}
            </select>
          </div>
        </div>

        {result && 'formatted' in result && (
          <p className="text-center text-neutral-400 text-sm">{result.formatted}</p>
        )}
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Heuristic agent — zero model, zero inference, zero cost. Runs entirely in your browser.
      </footer>
    </div>
  );
}
