import { useState, useCallback } from 'react';
import { generateName, generateBatch, type GeneratorOptions, type GeneratedName } from './generator';

const GENRES: GeneratorOptions['genre'][] = ['fantasy', 'scifi', 'medieval', 'modern', 'japanese', 'nordic', 'arabic', 'african'];
const RACES: NonNullable<GeneratorOptions['race']>[] = ['human', 'elf', 'dwarf', 'orc', 'dragon', 'demon', 'angel', 'fairy'];
const GENDERS: { value: GeneratorOptions['gender']; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'neutral', label: 'Any' },
];
const LENGTHS: { value: GeneratorOptions['length']; label: string }[] = [
  { value: 'short', label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'long', label: 'Long' },
];

const GENRE_COLORS: Record<string, string> = {
  fantasy: 'bg-violet-900/50 text-violet-400 border-violet-800',
  scifi: 'bg-cyan-900/50 text-cyan-400 border-cyan-800',
  medieval: 'bg-amber-900/50 text-amber-400 border-amber-800',
  modern: 'bg-blue-900/50 text-blue-400 border-blue-800',
  japanese: 'bg-rose-900/50 text-rose-400 border-rose-800',
  nordic: 'bg-sky-900/50 text-sky-400 border-sky-800',
  arabic: 'bg-emerald-900/50 text-emerald-400 border-emerald-800',
  african: 'bg-orange-900/50 text-orange-400 border-orange-800',
};

function Pill({ active, onClick, children, className }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
        active
          ? (className || 'bg-violet-900/50 text-violet-300 border-violet-700')
          : 'bg-neutral-900 text-neutral-500 border-neutral-800 hover:text-neutral-300 hover:border-neutral-600'
      }`}
    >
      {children}
    </button>
  );
}

function NameCard({ result, onFavorite, isFavorite }: { result: GeneratedName; onFavorite: () => void; isFavorite: boolean }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(result.full);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }, [result.full]);

  return (
    <div className="bg-neutral-900 rounded-lg border border-neutral-800 px-4 py-3 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-base font-medium text-neutral-100 truncate">{result.full}</div>
        {result.meaning && (
          <div className="text-xs text-neutral-500 mt-0.5 italic">{result.meaning}</div>
        )}
      </div>
      <button
        onClick={onFavorite}
        className={`text-sm shrink-0 ${isFavorite ? 'text-amber-400' : 'text-neutral-700 hover:text-neutral-400'}`}
        title={isFavorite ? 'Unfavorite' : 'Favorite'}
      >
        {isFavorite ? '\u2605' : '\u2606'}
      </button>
      <button
        onClick={copy}
        className="text-xs text-neutral-600 hover:text-neutral-300 shrink-0"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}

export default function App() {
  const [genre, setGenre] = useState<GeneratorOptions['genre']>('fantasy');
  const [race, setRace] = useState<GeneratorOptions['race']>('human');
  const [gender, setGender] = useState<GeneratorOptions['gender']>('neutral');
  const [length, setLength] = useState<GeneratorOptions['length']>('medium');
  const [lockSurname, setLockSurname] = useState(false);
  const [lockedSurname, setLockedSurname] = useState<string | null>(null);

  const [current, setCurrent] = useState<GeneratedName | null>(null);
  const [batch, setBatch] = useState<GeneratedName[]>([]);
  const [history, setHistory] = useState<GeneratedName[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const options: GeneratorOptions = { genre, race: genre === 'fantasy' ? race : undefined, gender, length };

  const doGenerate = useCallback(() => {
    const result = generateName(options);
    if (lockSurname && lockedSurname) {
      result.surname = lockedSurname;
      result.full = result.name + (result.surname ? ` ${result.surname}` : '') + (result.epithet ? `, ${result.epithet}` : '');
    }
    if (!lockSurname && result.surname) {
      setLockedSurname(result.surname);
    }
    setCurrent(result);
    setBatch([]);
    setHistory((prev) => [result, ...prev].slice(0, 20));
  }, [options, lockSurname, lockedSurname]);

  const doGenerateBatch = useCallback(() => {
    let results = generateBatch(options, 10);
    if (lockSurname && lockedSurname) {
      results = results.map(r => ({
        ...r,
        surname: lockedSurname,
        full: r.name + ` ${lockedSurname}` + (r.epithet ? `, ${r.epithet}` : ''),
      }));
    }
    if (!lockSurname && results.length > 0 && results[0].surname) {
      setLockedSurname(results[0].surname);
    }
    setCurrent(null);
    setBatch(results);
    setHistory((prev) => [...results, ...prev].slice(0, 20));
  }, [options, lockSurname, lockedSurname]);

  const toggleFavorite = useCallback((full: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(full)) next.delete(full);
      else next.add(full);
      return next;
    });
  }, []);

  const copyAll = useCallback(() => {
    const names = batch.map(r => r.full).join('\n');
    navigator.clipboard.writeText(names);
  }, [batch]);

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">
          FreeAgentStore
        </a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
          Name Generator
        </h1>
        <span className="text-xs px-2 py-0.5 rounded bg-violet-900/50 text-violet-400 border border-violet-800">
          Evolved
        </span>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
          Markov chains — 10k seeds
        </span>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 gap-4 overflow-auto">
        {/* Genre pills */}
        <div>
          <p className="text-xs text-neutral-500 mb-1.5">Genre</p>
          <div className="flex flex-wrap gap-2">
            {GENRES.map((g) => (
              <Pill
                key={g}
                active={genre === g}
                onClick={() => setGenre(g)}
                className={genre === g ? GENRE_COLORS[g] : undefined}
              >
                {g.charAt(0).toUpperCase() + g.slice(1).replace('scifi', 'ci-Fi')}
                {g === 'scifi' ? '' : ''}
              </Pill>
            ))}
          </div>
        </div>

        {/* Race pills (fantasy only) */}
        {genre === 'fantasy' && (
          <div>
            <p className="text-xs text-neutral-500 mb-1.5">Race</p>
            <div className="flex flex-wrap gap-2">
              {RACES.map((r) => (
                <Pill key={r} active={race === r} onClick={() => setRace(r)}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </Pill>
              ))}
            </div>
          </div>
        )}

        {/* Gender + Length */}
        <div className="flex gap-6">
          <div>
            <p className="text-xs text-neutral-500 mb-1.5">Gender</p>
            <div className="flex gap-2">
              {GENDERS.map((g) => (
                <Pill key={g.value} active={gender === g.value} onClick={() => setGender(g.value)}>
                  {g.label}
                </Pill>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-neutral-500 mb-1.5">Length</p>
            <div className="flex gap-2">
              {LENGTHS.map((l) => (
                <Pill key={l.value} active={length === l.value} onClick={() => setLength(l.value)}>
                  {l.label}
                </Pill>
              ))}
            </div>
          </div>
        </div>

        {/* Lock surname + Generate buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={doGenerate}
            className="px-5 py-2.5 rounded-lg bg-violet-700 hover:bg-violet-600 text-white font-medium text-sm transition-colors"
          >
            Generate
          </button>
          <button
            onClick={doGenerateBatch}
            className="px-5 py-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium text-sm border border-neutral-700 transition-colors"
          >
            Generate 10
          </button>
          <label className="ml-auto flex items-center gap-2 text-xs text-neutral-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={lockSurname}
              onChange={(e) => setLockSurname(e.target.checked)}
              className="accent-violet-600"
            />
            Lock surname
            {lockSurname && lockedSurname && (
              <span className="text-neutral-400">({lockedSurname})</span>
            )}
          </label>
        </div>

        {/* Single result */}
        {current && (
          <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6 text-center">
            <div className="text-2xl font-bold text-neutral-50 mb-1" style={{ fontFamily: 'var(--font-serif)' }}>
              {current.name}
              {current.surname && <span className="text-neutral-400 ml-2">{current.surname}</span>}
            </div>
            {current.epithet && (
              <div className="text-sm text-violet-400 italic">{current.epithet}</div>
            )}
            {current.meaning && (
              <div className="text-xs text-neutral-600 mt-2">{current.meaning}</div>
            )}
          </div>
        )}

        {/* Batch results */}
        {batch.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-neutral-500">{batch.length} names generated</p>
              <button onClick={copyAll} className="text-xs text-neutral-500 hover:text-neutral-300">
                Copy all
              </button>
            </div>
            {batch.map((r, i) => (
              <NameCard
                key={`${r.full}-${i}`}
                result={r}
                onFavorite={() => toggleFavorite(r.full)}
                isFavorite={favorites.has(r.full)}
              />
            ))}
          </div>
        )}

        {/* Favorites */}
        {favorites.size > 0 && (
          <div className="mt-2 border-t border-neutral-800 pt-3">
            <p className="text-xs text-neutral-500 mb-2">Favorites ({favorites.size})</p>
            <div className="space-y-1">
              {Array.from(favorites).map((name) => (
                <div key={name} className="flex items-center gap-2 text-sm">
                  <span className="text-amber-400 text-xs">{'\u2605'}</span>
                  <span className="text-neutral-300">{name}</span>
                  <button
                    onClick={() => toggleFavorite(name)}
                    className="ml-auto text-xs text-neutral-600 hover:text-neutral-400"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && !current && batch.length === 0 && (
          <div className="mt-2 border-t border-neutral-800 pt-3">
            <p className="text-xs text-neutral-500 mb-2">Recent ({history.length})</p>
            <div className="space-y-1">
              {history.map((r, i) => (
                <div key={`${r.full}-${i}`} className="text-sm text-neutral-500">
                  {r.full}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Generate character names using Markov chains. For games, fiction, and world-building. Runs in your browser — no server, no tracking.
      </footer>
    </div>
  );
}
