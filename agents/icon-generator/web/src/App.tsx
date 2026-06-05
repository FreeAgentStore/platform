import { useState, useEffect, useRef, useCallback } from 'react';
import { ICONS, CATEGORIES, type IconDef, type Category } from './icons';
import { matchIcons, extractColors, aiMatch } from './matcher';

// ── Color presets ────────────────────────────────────────────────────
const PALETTE = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
  '#f43f5e', '#06b6d4', '#374151', '#000000', '#ffffff',
];

function svgToReact(name: string, svgStr: string): string {
  const inner = svgStr
    .replace(/<svg[^>]*>/, '')
    .replace(/<\/svg>/, '')
    .replace(/stroke-width/g, 'strokeWidth')
    .replace(/stroke-linecap/g, 'strokeLinecap')
    .replace(/stroke-linejoin/g, 'strokeLinejoin')
    .replace(/fill-rule/g, 'fillRule')
    .replace(/clip-rule/g, 'clipRule');
  const pascal = name
    .split('-')
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join('');
  return `export function ${pascal}({ size = 24, color = "currentColor", ...props }: { size?: number; color?: string } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={size} height={size} {...props}>
      ${inner.trim()}
    </svg>
  );
}`;
}

export default function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<IconDef[]>(ICONS);
  const [selected, setSelected] = useState<IconDef | null>(null);
  const [primary, setPrimary] = useState('#a78bfa');
  const [secondary, setSecondary] = useState('#6366f1');
  const [activeCategory, setActiveCategory] = useState<Category | 'All'>('All');
  const [copied, setCopied] = useState('');
  const [aiUsed, setAiUsed] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ── Search logic ─────────────────────────────────────────────────
  const doSearch = useCallback(
    (q: string, cat: Category | 'All') => {
      let matched = matchIcons(q);
      if (cat !== 'All') {
        matched = matched.filter((i) => i.category === cat);
      }
      setResults(matched);

      // Extract colors from query
      if (q.trim()) {
        const colors = extractColors(q);
        // Only override if user typed color words
        const words = q.toLowerCase().split(/\s+/);
        const hasColor = words.some(
          (w) =>
            [
              'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'cyan',
              'teal', 'indigo', 'violet', 'white', 'black', 'gray', 'grey', 'brown',
              'gold', 'silver', 'crimson', 'coral', 'salmon', 'navy', 'maroon',
              'olive', 'turquoise', 'magenta', 'lavender', 'warm', 'cool', 'hot',
              'cold', 'bright', 'dark', 'light', 'neon', 'pastel', 'muted',
              'earthy', 'ocean', 'forest', 'sunset', 'fire', 'ice', 'berry',
              'wine', 'rust', 'sand', 'slate', 'midnight', 'aqua', 'lime',
              'emerald', 'sky', 'amber', 'fuchsia', 'rose', 'scarlet', 'peach',
              'mint',
            ].includes(w),
        );
        if (hasColor) {
          setPrimary(colors.primary);
          setSecondary(colors.secondary);
        }
      }
    },
    [],
  );

  const onQueryChange = (value: string) => {
    setQuery(value);
    setAiUsed(false);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value, activeCategory), 200);
  };

  const onCategoryChange = (cat: Category | 'All') => {
    setActiveCategory(cat);
    doSearch(query, cat);
  };

  // Try AI for ambiguous queries when heuristic yields no results
  useEffect(() => {
    if (results.length > 0 || !query.trim() || aiUsed) return;
    let cancelled = false;
    aiMatch(query).then((r) => {
      if (cancelled || !r) return;
      const icon = ICONS.find((i) => i.name === r.icon);
      if (icon) {
        setResults([icon]);
        setSelected(icon);
        setPrimary(r.primary);
        setSecondary(r.secondary);
        setAiUsed(true);
      }
    });
    return () => { cancelled = true; };
  }, [results, query, aiUsed]);

  // ── SVG rendering ────────────────────────────────────────────────
  const renderSvg = (icon: IconDef) => icon.svg(primary, secondary);

  // ── Export helpers ────────────────────────────────────────────────
  const svgString = selected ? renderSvg(selected) : '';

  const downloadSvg = () => {
    if (!svgString) return;
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${selected!.name}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const downloadPng = () => {
    if (!svgString) return;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 512, 512);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `${selected!.name}.png`;
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 1500);
  };

  return (
    <div
      className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col"
      style={{ fontFamily: "'Manrope',system-ui,sans-serif" }}
    >
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a
          href="https://freeagentstore.online"
          className="text-neutral-500 hover:text-neutral-300 text-sm"
        >
          FreeAgentStore
        </a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
          Icon Generator
        </h1>
        <span className="ml-auto text-xs text-neutral-600">{ICONS.length} icons</span>
      </header>

      <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-4 gap-4">
        {/* Search */}
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search icons or describe what you need... e.g. 'red rocket', 'blue mail', 'settings'"
          className="w-full px-4 py-3 rounded-lg bg-neutral-900 border border-neutral-800 text-sm focus:outline-none focus:border-violet-600"
        />

        {/* Categories */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onCategoryChange('All')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              activeCategory === 'All'
                ? 'bg-violet-600 text-white'
                : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200'
            }`}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => onCategoryChange(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-violet-600 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Selected icon preview */}
        {selected && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-neutral-300">{selected.name}</h2>
              <span className="text-xs text-neutral-600">{selected.category}</span>
              <button
                onClick={() => setSelected(null)}
                className="ml-auto text-xs text-neutral-500 hover:text-neutral-300"
              >
                Close
              </button>
            </div>

            {/* Preview sizes + backgrounds */}
            <div className="flex flex-wrap items-end gap-6 justify-center">
              {/* Large */}
              <div className="text-center">
                <div
                  className="w-64 h-64 mx-auto rounded-2xl bg-neutral-800 p-6 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                  dangerouslySetInnerHTML={{ __html: renderSvg(selected) }}
                />
                <span className="text-xs text-neutral-600 mt-1 block">256px</span>
              </div>
              {/* Medium */}
              <div className="text-center">
                <div
                  className="w-16 h-16 mx-auto rounded-lg bg-neutral-800 p-1.5 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                  dangerouslySetInnerHTML={{ __html: renderSvg(selected) }}
                />
                <span className="text-xs text-neutral-600 mt-1 block">64px</span>
              </div>
              {/* Small */}
              <div className="text-center">
                <div
                  className="w-6 h-6 mx-auto rounded flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                  dangerouslySetInnerHTML={{ __html: renderSvg(selected) }}
                />
                <span className="text-xs text-neutral-600 mt-1 block">24px</span>
              </div>
              {/* Dark/light backgrounds */}
              <div className="flex flex-col gap-2">
                <div
                  className="w-16 h-16 rounded-lg bg-white p-2 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                  dangerouslySetInnerHTML={{ __html: renderSvg(selected) }}
                />
                <span className="text-xs text-neutral-600 text-center">Light</span>
              </div>
              <div className="flex flex-col gap-2">
                <div
                  className="w-16 h-16 rounded-lg bg-neutral-950 border border-neutral-700 p-2 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                  dangerouslySetInnerHTML={{ __html: renderSvg(selected) }}
                />
                <span className="text-xs text-neutral-600 text-center">Dark</span>
              </div>
            </div>

            {/* Color customizer */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-neutral-500">Primary</label>
                  <input
                    type="color"
                    value={primary}
                    onChange={(e) => setPrimary(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                  />
                  <input
                    value={primary}
                    onChange={(e) => setPrimary(e.target.value)}
                    className="w-20 px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-xs font-mono text-neutral-300"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-neutral-500">Secondary</label>
                  <input
                    type="color"
                    value={secondary}
                    onChange={(e) => setSecondary(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                  />
                  <input
                    value={secondary}
                    onChange={(e) => setSecondary(e.target.value)}
                    className="w-20 px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-xs font-mono text-neutral-300"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    onClick={() => setPrimary(c)}
                    className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: primary === c ? '#fff' : 'transparent',
                    }}
                    title={c}
                  />
                ))}
              </div>
            </div>

            {/* Export buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={downloadSvg}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              >
                Download SVG
              </button>
              <button
                onClick={downloadPng}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              >
                Download PNG (512px)
              </button>
              <button
                onClick={() => copyText(svgString, 'svg')}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              >
                {copied === 'svg' ? 'Copied!' : 'Copy SVG'}
              </button>
              <button
                onClick={() => copyText(svgToReact(selected.name, svgString), 'react')}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              >
                {copied === 'react' ? 'Copied!' : 'Copy React Component'}
              </button>
            </div>

            {/* SVG code */}
            <details>
              <summary className="text-xs text-neutral-600 cursor-pointer">View SVG code</summary>
              <pre className="mt-2 p-3 rounded-lg bg-neutral-800 border border-neutral-700 text-xs font-mono overflow-auto max-h-48 text-neutral-300">
                {svgString}
              </pre>
            </details>
          </div>
        )}

        {/* Icon grid */}
        {results.length === 0 ? (
          <p className="text-center text-sm text-neutral-500 py-8">
            No icons match &ldquo;{query}&rdquo;.{' '}
            {aiUsed ? 'AI could not find a match either.' : 'Trying AI...'}
          </p>
        ) : (
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
            {results.map((icon) => (
              <button
                key={icon.name}
                onClick={() => setSelected(icon)}
                className={`group relative flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                  selected?.name === icon.name
                    ? 'bg-violet-600/20 ring-1 ring-violet-500'
                    : 'bg-neutral-900 hover:bg-neutral-800'
                }`}
                title={icon.name}
              >
                <div
                  className="w-8 h-8 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                  dangerouslySetInnerHTML={{ __html: renderSvg(icon) }}
                />
                <span className="text-[10px] text-neutral-500 group-hover:text-neutral-300 truncate w-full text-center leading-tight">
                  {icon.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        {ICONS.length} curated SVG icons. Search, customize colors, export SVG/PNG. No AI
        required.
      </footer>
    </div>
  );
}
