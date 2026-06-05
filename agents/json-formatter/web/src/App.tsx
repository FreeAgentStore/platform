import { useState, useCallback, useMemo } from 'react';
import {
  formatJson, minifyJson, validateJson, queryJson, diffJson, jsonToTypes,
  getJsonStats, highlightJson, type HighlightToken, type DiffLine, type JsonStats,
} from './formatter';

type Tab = 'formatted' | 'tree' | 'types' | 'query' | 'diff';

const TOKEN_COLORS: Record<HighlightToken['type'], string> = {
  key: 'text-violet-400',
  string: 'text-emerald-400',
  number: 'text-amber-400',
  boolean: 'text-orange-400',
  null: 'text-red-400',
  brace: 'text-neutral-400',
  bracket: 'text-neutral-400',
  comma: 'text-neutral-500',
  colon: 'text-neutral-500',
  whitespace: '',
};

function TreeView({ data, depth = 0 }: { data: any; depth?: number }) {
  const [collapsed, setCollapsed] = useState(depth > 2);

  if (data === null) return <span className="text-red-400">null</span>;
  if (data === undefined) return <span className="text-neutral-500">undefined</span>;
  if (typeof data === 'string') return <span className="text-emerald-400">"{data}"</span>;
  if (typeof data === 'number') return <span className="text-amber-400">{String(data)}</span>;
  if (typeof data === 'boolean') return <span className="text-orange-400">{String(data)}</span>;

  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-neutral-500">[]</span>;
    return (
      <span>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-neutral-500 hover:text-neutral-300 font-mono"
        >
          {collapsed ? '[ ... ]' : '['}
        </button>
        <span className="text-neutral-600 text-xs ml-1">{data.length} items</span>
        {!collapsed && (
          <div className="ml-4 border-l border-neutral-800 pl-2">
            {data.map((item, i) => (
              <div key={i} className="flex items-start">
                <span className="text-neutral-600 text-xs mr-2 shrink-0 w-6 text-right">{i}</span>
                <TreeView data={item} depth={depth + 1} />
                {i < data.length - 1 && <span className="text-neutral-500">,</span>}
              </div>
            ))}
          </div>
        )}
        {!collapsed && <span className="text-neutral-500">]</span>}
      </span>
    );
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data);
    if (entries.length === 0) return <span className="text-neutral-500">{'{}'}</span>;
    return (
      <span>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-neutral-500 hover:text-neutral-300 font-mono"
        >
          {collapsed ? '{ ... }' : '{'}
        </button>
        <span className="text-neutral-600 text-xs ml-1">{entries.length} keys</span>
        {!collapsed && (
          <div className="ml-4 border-l border-neutral-800 pl-2">
            {entries.map(([key, value], i) => (
              <div key={key} className="flex items-start">
                <span className="text-violet-400 shrink-0">"{key}"</span>
                <span className="text-neutral-500 mx-1">:</span>
                <TreeView data={value} depth={depth + 1} />
                {i < entries.length - 1 && <span className="text-neutral-500">,</span>}
              </div>
            ))}
          </div>
        )}
        {!collapsed && <span className="text-neutral-500">{'}'}</span>}
      </span>
    );
  }

  return <span className="text-neutral-400">{String(data)}</span>;
}

export default function App() {
  const [input, setInput] = useState('');
  const [tab, setTab] = useState<Tab>('formatted');
  const [indent, setIndent] = useState(2);
  const [queryPath, setQueryPath] = useState('');
  const [diffInput, setDiffInput] = useState('');
  const [copied, setCopied] = useState(false);

  const validation = useMemo(() => validateJson(input), [input]);
  const formatted = useMemo(() => input ? formatJson(input, indent) : null, [input, indent]);
  const stats = useMemo<JsonStats | null>(() => input ? getJsonStats(input) : null, [input]);
  const parsedData = useMemo(() => { try { return JSON.parse(input); } catch { return undefined; } }, [input]);
  const types = useMemo(() => parsedData !== undefined ? jsonToTypes(parsedData) : '', [parsedData]);
  const queryResult = useMemo(() => {
    if (!queryPath || parsedData === undefined) return undefined;
    try { return queryJson(parsedData, queryPath); } catch { return undefined; }
  }, [parsedData, queryPath]);
  const diff = useMemo<DiffLine[]>(() => {
    if (!input || !diffInput) return [];
    return diffJson(input, diffInput);
  }, [input, diffInput]);

  const tokens = useMemo(() => {
    if (!formatted?.result || formatted.error) return [];
    return highlightJson(formatted.result);
  }, [formatted]);

  const handleFormat = useCallback(() => {
    if (!input.trim()) return;
    const result = formatJson(input, indent);
    if (!result.error) setInput(result.result);
  }, [input, indent]);

  const handleMinify = useCallback(() => {
    if (!input.trim()) return;
    const result = minifyJson(input);
    if (!result.error) setInput(result.result);
  }, [input]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, []);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'formatted', label: 'Formatted' },
    { key: 'tree', label: 'Tree View' },
    { key: 'types', label: 'TypeScript Types' },
    { key: 'query', label: 'Query' },
    { key: 'diff', label: 'Diff' },
  ];

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">
          FreeAgentStore
        </a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
          JSON Formatter
        </h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
          Heuristic
        </span>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row max-w-6xl mx-auto w-full p-4 gap-4">
        {/* Left: Input */}
        <div className="flex-1 flex flex-col gap-3">
          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleFormat}
              className="px-3 py-1.5 rounded text-xs font-medium bg-violet-600 hover:bg-violet-500 text-white transition-colors"
            >
              Format
            </button>
            <button
              onClick={handleMinify}
              className="px-3 py-1.5 rounded text-xs font-medium bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-neutral-100 transition-colors"
            >
              Minify
            </button>
            <button
              onClick={() => copyToClipboard(formatted?.result || input)}
              className="px-3 py-1.5 rounded text-xs font-medium bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-neutral-100 transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <div className="flex items-center gap-1 ml-auto">
              <span className="text-xs text-neutral-500">Indent:</span>
              <button
                onClick={() => setIndent(2)}
                className={`px-2 py-1 rounded text-xs ${indent === 2 ? 'bg-neutral-700 text-neutral-200' : 'text-neutral-500 hover:text-neutral-300'}`}
              >2</button>
              <button
                onClick={() => setIndent(4)}
                className={`px-2 py-1 rounded text-xs ${indent === 4 ? 'bg-neutral-700 text-neutral-200' : 'text-neutral-500 hover:text-neutral-300'}`}
              >4</button>
            </div>
          </div>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='Paste your JSON here...'
            className="flex-1 min-h-[300px] px-4 py-3 rounded-lg bg-neutral-900 border border-neutral-800 focus:outline-none focus:border-neutral-600 text-neutral-100 placeholder:text-neutral-600 font-mono text-sm resize-y"
            spellCheck={false}
          />

          {/* Error banner */}
          {input && !validation.valid && (
            <div className="bg-red-950/40 border border-red-900 rounded-lg px-4 py-2 text-sm text-red-400">
              <span className="font-medium">Error: </span>{validation.error}
              {validation.line && (
                <span className="ml-2 text-red-500/70">Line {validation.line}, Col {validation.col}</span>
              )}
            </div>
          )}

          {/* Stats bar */}
          {stats && (
            <div className="flex gap-4 text-xs text-neutral-500 flex-wrap">
              <span>Size: {formatBytes(stats.size)}</span>
              <span>Minified: {formatBytes(stats.minifiedSize)}</span>
              <span>Keys: {stats.keys}</span>
              <span>Depth: {stats.depth}</span>
              <span>Type: {stats.type}</span>
            </div>
          )}
        </div>

        {/* Right: Output */}
        <div className="flex-1 flex flex-col gap-3">
          {/* Tabs */}
          <div className="flex gap-1 bg-neutral-900 rounded-lg p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-colors ${
                  tab === t.key ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Formatted tab */}
          {tab === 'formatted' && (
            <div className="flex-1 min-h-[300px] p-4 rounded-lg bg-neutral-900 border border-neutral-800 font-mono text-sm overflow-auto">
              {tokens.length > 0 ? (
                <pre className="whitespace-pre-wrap break-all">
                  {tokens.map((tok, i) => (
                    <span key={i} className={TOKEN_COLORS[tok.type]}>{tok.text}</span>
                  ))}
                </pre>
              ) : (
                <span className="text-neutral-600">Formatted output will appear here</span>
              )}
            </div>
          )}

          {/* Tree view tab */}
          {tab === 'tree' && (
            <div className="flex-1 min-h-[300px] p-4 rounded-lg bg-neutral-900 border border-neutral-800 font-mono text-sm overflow-auto">
              {parsedData !== undefined ? (
                <TreeView data={parsedData} />
              ) : (
                <span className="text-neutral-600">Enter valid JSON to see tree view</span>
              )}
            </div>
          )}

          {/* Types tab */}
          {tab === 'types' && (
            <div className="flex-1 flex flex-col gap-2">
              <div className="flex justify-end">
                <button
                  onClick={() => copyToClipboard(types)}
                  className="px-2 py-1 rounded text-xs bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
                >
                  Copy Types
                </button>
              </div>
              <div className="flex-1 min-h-[300px] p-4 rounded-lg bg-neutral-900 border border-neutral-800 font-mono text-sm overflow-auto">
                {types ? (
                  <pre className="whitespace-pre-wrap text-blue-400">{types}</pre>
                ) : (
                  <span className="text-neutral-600">Enter valid JSON to generate TypeScript types</span>
                )}
              </div>
            </div>
          )}

          {/* Query tab */}
          {tab === 'query' && (
            <div className="flex-1 flex flex-col gap-3">
              <input
                type="text"
                value={queryPath}
                onChange={(e) => setQueryPath(e.target.value)}
                placeholder="e.g. users[0].name, data.items[2].id"
                className="px-4 py-2 rounded-lg bg-neutral-900 border border-neutral-800 focus:outline-none focus:border-neutral-600 text-neutral-100 placeholder:text-neutral-600 font-mono text-sm"
              />
              <div className="flex-1 min-h-[200px] p-4 rounded-lg bg-neutral-900 border border-neutral-800 font-mono text-sm overflow-auto">
                {parsedData === undefined ? (
                  <span className="text-neutral-600">Enter valid JSON first</span>
                ) : queryPath === '' ? (
                  <span className="text-neutral-600">Enter a path to query</span>
                ) : queryResult === undefined ? (
                  <span className="text-red-400">Path not found</span>
                ) : (
                  <pre className="whitespace-pre-wrap text-emerald-400">
                    {JSON.stringify(queryResult, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}

          {/* Diff tab */}
          {tab === 'diff' && (
            <div className="flex-1 flex flex-col gap-3">
              <textarea
                value={diffInput}
                onChange={(e) => setDiffInput(e.target.value)}
                placeholder="Paste second JSON to compare..."
                rows={6}
                className="px-4 py-3 rounded-lg bg-neutral-900 border border-neutral-800 focus:outline-none focus:border-neutral-600 text-neutral-100 placeholder:text-neutral-600 font-mono text-sm resize-y"
                spellCheck={false}
              />
              <div className="flex-1 min-h-[200px] p-4 rounded-lg bg-neutral-900 border border-neutral-800 font-mono text-xs overflow-auto">
                {diff.length > 0 ? (
                  <div className="space-y-0">
                    {diff.map((line, i) => (
                      <div
                        key={i}
                        className={`px-2 py-0.5 ${
                          line.type === 'added' ? 'bg-emerald-950/40 text-emerald-400' :
                          line.type === 'removed' ? 'bg-red-950/40 text-red-400' :
                          'text-neutral-500'
                        }`}
                      >
                        <span className="inline-block w-4">
                          {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                        </span>
                        {line.text}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-neutral-600">Enter JSON in both panels to see diff</span>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Format, minify, validate, query, and diff JSON. Runs in your browser.
      </footer>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
