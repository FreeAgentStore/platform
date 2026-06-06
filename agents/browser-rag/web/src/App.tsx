import { useState, useCallback, useRef, useEffect } from 'react';
import { createRAG, type RAGInstance, type SearchResult, type RAGAnswer } from './rag';

type ModelState = 'idle' | 'loading' | 'ready' | 'error';

interface DocInfo {
  id: string;
  chunkCount: number;
  metadata?: Record<string, string>;
}

interface Stats {
  documents: number;
  chunks: number;
  sizeBytes: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function App() {
  const [modelState, setModelState] = useState<ModelState>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const ragRef = useRef<RAGInstance | null>(null);

  // Document management
  const [pasteText, setPasteText] = useState('');
  const [docs, setDocs] = useState<DocInfo[]>([]);
  const [stats, setStats] = useState<Stats>({ documents: 0, chunks: 0, sizeBytes: 0 });
  const [indexing, setIndexing] = useState(false);

  // Search & Ask
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [answer, setAnswer] = useState<RAGAnswer | null>(null);
  const [searching, setSearching] = useState(false);
  const [asking, setAsking] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshDocs = useCallback(async () => {
    const rag = ragRef.current;
    if (!rag) return;
    const [d, s] = await Promise.all([rag.getDocuments(), rag.getStats()]);
    setDocs(d);
    setStats(s);
  }, []);

  const ensureRAG = useCallback(async () => {
    if (ragRef.current) return ragRef.current;
    setModelState('loading');
    try {
      const rag = await createRAG({
        name: 'browser-rag-demo',
        onProgress: (msg) => setStatusMsg(msg),
      });
      ragRef.current = rag;
      setModelState('ready');
      await refreshDocs();
      return rag;
    } catch {
      setModelState('error');
      return null;
    }
  }, [refreshDocs]);

  // Load existing docs on mount (if any are in IndexedDB from a previous session)
  useEffect(() => {
    ensureRAG();
  }, [ensureRAG]);

  const handleAddPaste = useCallback(async () => {
    const text = pasteText.trim();
    if (!text) return;
    const rag = await ensureRAG();
    if (!rag) return;

    setIndexing(true);
    try {
      const id = `paste-${Date.now()}`;
      await rag.addDocument({ id, text, metadata: { title: 'Pasted text' } });
      setPasteText('');
      await refreshDocs();
    } finally {
      setIndexing(false);
    }
  }, [pasteText, ensureRAG, refreshDocs]);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      const rag = await ensureRAG();
      if (!rag) return;

      setIndexing(true);
      try {
        for (const file of Array.from(files)) {
          const text = await file.text();
          const id = `file-${file.name}-${Date.now()}`;
          let title = file.name;

          if (file.name.endsWith('.json')) {
            // Try to extract text from JSON
            try {
              const parsed = JSON.parse(text);
              const extracted = typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2);
              await rag.addDocument({ id, text: extracted, metadata: { title } });
              continue;
            } catch {
              // Fall through to raw text
            }
          }

          if (file.name.endsWith('.csv')) {
            // Convert CSV rows to text paragraphs
            const lines = text.split('\n').filter((l) => l.trim());
            const joined = lines.join('\n');
            await rag.addDocument({ id, text: joined, metadata: { title } });
            continue;
          }

          await rag.addDocument({ id, text, metadata: { title } });
        }
        await refreshDocs();
      } finally {
        setIndexing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [ensureRAG, refreshDocs],
  );

  const handleRemoveDoc = useCallback(
    async (docId: string) => {
      const rag = ragRef.current;
      if (!rag) return;
      await rag.removeDocument(docId);
      await refreshDocs();
      setSearchResults([]);
      setAnswer(null);
    },
    [refreshDocs],
  );

  const handleClearAll = useCallback(async () => {
    const rag = ragRef.current;
    if (!rag) return;
    await rag.clearAll();
    await refreshDocs();
    setSearchResults([]);
    setAnswer(null);
  }, [refreshDocs]);

  const handleSearch = useCallback(async () => {
    const rag = ragRef.current;
    if (!rag || !query.trim()) return;
    setSearching(true);
    setAnswer(null);
    try {
      const results = await rag.search(query, 5);
      setSearchResults(results);
    } finally {
      setSearching(false);
    }
  }, [query]);

  const handleAsk = useCallback(async () => {
    const rag = ragRef.current;
    if (!rag || !query.trim()) return;
    setAsking(true);
    setSearchResults([]);
    try {
      const result = await rag.ask(query, { topK: 5 });
      setAnswer(result);
      setSearchResults(result.sources);
    } finally {
      setAsking(false);
    }
  }, [query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSearch();
      }
    },
    [handleSearch],
  );

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">
          FreeAgentStore
        </a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
          Browser RAG
        </h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
          {modelState === 'ready' ? 'Ready' : modelState === 'loading' ? statusMsg || 'Loading...' : modelState === 'error' ? 'Error' : 'Idle'}
        </span>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row max-w-6xl mx-auto w-full p-4 gap-4">
        {/* Explanation card */}
        <div className="lg:hidden bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 mb-2">
          <p className="text-sm text-neutral-400">
            Add documents, search semantically, ask questions. Everything runs on your device. MiniLM (23MB) for embeddings, Chrome Nano for answers.
          </p>
        </div>

        {/* Left panel: Document management */}
        <div className="lg:w-1/2 flex flex-col gap-4">
          <div className="hidden lg:block bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
            <p className="text-sm text-neutral-400">
              Add documents, search semantically, ask questions. Everything runs on your device. MiniLM (23MB) for embeddings, Chrome Nano for answers.
            </p>
          </div>

          {/* Model download progress */}
          {modelState === 'loading' && (
            <div className="bg-neutral-900 rounded-lg p-4">
              <p className="text-sm text-neutral-300">{statusMsg || 'Loading model...'}</p>
              <p className="text-xs text-neutral-600 mt-1">First time only -- cached for future use</p>
            </div>
          )}

          {modelState === 'error' && (
            <div className="bg-red-950/50 border border-red-800 rounded-lg p-4 text-sm text-red-300">
              Failed to load model. Check your connection and try again.
            </div>
          )}

          {/* Add documents */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-neutral-300">Add Documents</h2>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste text here to index..."
              className="w-full h-32 bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-sm text-neutral-200 placeholder-neutral-600 resize-y focus:outline-none focus:border-violet-600"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddPaste}
                disabled={!pasteText.trim() || indexing}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {indexing ? 'Indexing...' : 'Index Text'}
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={indexing}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Upload File
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.json,.csv"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </section>

          {/* Document list */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-300">
                Indexed Documents
                {stats.documents > 0 && (
                  <span className="ml-2 text-xs font-normal text-neutral-500">
                    {stats.documents} doc{stats.documents !== 1 ? 's' : ''}, {stats.chunks} chunks, {formatBytes(stats.sizeBytes)}
                  </span>
                )}
              </h2>
              {docs.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>

            {docs.length === 0 ? (
              <p className="text-xs text-neutral-600">No documents indexed yet. Paste text or upload a file above.</p>
            ) : (
              <div className="space-y-1">
                {docs.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between bg-neutral-900 rounded-lg px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-neutral-300 truncate block">
                        {doc.metadata?.title ?? doc.id}
                      </span>
                      <span className="text-xs text-neutral-500">
                        {doc.chunkCount} chunk{doc.chunkCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemoveDoc(doc.id)}
                      className="ml-2 text-xs text-neutral-500 hover:text-red-400 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right panel: Search & Ask */}
        <div className="lg:w-1/2 flex flex-col gap-4">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-neutral-300">Search & Ask</h2>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter a question or search query..."
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-violet-600"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSearch}
                disabled={!query.trim() || searching || stats.chunks === 0}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
              <button
                onClick={handleAsk}
                disabled={!query.trim() || asking || stats.chunks === 0}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {asking ? 'Generating...' : 'Ask'}
              </button>
            </div>
          </section>

          {/* Answer */}
          {answer && (
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-neutral-300">Answer</h2>
                <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-500">
                  {answer.source === 'chrome-nano' ? 'Chrome Nano' : answer.source === 'ollama' ? 'Ollama' : 'No AI'}
                </span>
              </div>
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                <p className="text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap">{answer.answer}</p>
              </div>
            </section>
          )}

          {/* Search results */}
          {searchResults.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-neutral-300">
                {answer ? 'Sources' : 'Search Results'}
              </h2>
              {searchResults.map((r) => (
                <div key={r.chunk.id} className="bg-neutral-900 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-neutral-800 rounded-full h-1.5">
                      <div
                        className="bg-violet-600 h-1.5 rounded-full"
                        style={{ width: `${Math.max(r.score * 100, 2)}%` }}
                      />
                    </div>
                    <span className="text-xs text-neutral-400 font-mono w-14 text-right">
                      {(r.score * 100).toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-sm text-neutral-300 leading-relaxed">{r.chunk.text}</p>
                  {r.chunk.metadata?.title && (
                    <p className="text-xs text-neutral-500">From: {r.chunk.metadata.title}</p>
                  )}
                </div>
              ))}
            </section>
          )}

          {/* Empty state for right panel */}
          {searchResults.length === 0 && !answer && stats.chunks > 0 && (
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
              <p className="text-xs text-neutral-500">
                Type a query above and click Search to find relevant chunks, or Ask to generate an answer.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Code example */}
      <div className="max-w-6xl mx-auto w-full px-4 pb-4">
        <details className="bg-neutral-900/50 border border-neutral-800 rounded-lg">
          <summary className="px-4 py-2 text-xs text-neutral-500 cursor-pointer hover:text-neutral-400">
            Integration code
          </summary>
          <pre className="px-4 pb-3 text-xs text-neutral-400 overflow-x-auto"><code>{`<script type="module">
  import { createRAG } from 'https://freeagentstore.online/pkg/browser-rag/index.js'
  const rag = await createRAG({ name: 'my-site' })
  await rag.index([{ id: '1', text: document.body.innerText }])
  const answer = await rag.ask('What is this page about?')
</script>`}</code></pre>
        </details>
      </div>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        MiniLM embeddings + IndexedDB vectors + Chrome Nano generation. Everything runs on your device.
        <a href="https://github.com/FreeAgentStore/platform/blob/main/agents/browser-rag/web/src/rag.ts" className="underline ml-1">View source</a>
      </footer>
    </div>
  );
}
