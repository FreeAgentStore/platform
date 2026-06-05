import { useState, useCallback } from 'react';
import { initModel, indexTexts, search, type SearchResult } from './search';

type ModelState = 'idle' | 'downloading' | 'ready' | 'error';

const DEMO_PARAGRAPHS = [
  "The Milky Way galaxy contains between 100 and 400 billion stars, and our solar system orbits about 26,000 light-years from its center. Astronomers estimate there may be more planets than stars in our galaxy.",
  "To make fresh pasta from scratch, combine flour and eggs on a clean surface, knead the dough for about 10 minutes until smooth, then roll it thin and cut into your desired shape. Let it dry briefly before cooking in salted boiling water.",
  "The Great Barrier Reef in Australia is the largest living structure on Earth, stretching over 2,300 kilometers. It supports an incredible diversity of marine life including over 1,500 species of fish.",
  "Machine learning algorithms can be broadly categorized into supervised learning, unsupervised learning, and reinforcement learning. Neural networks, a subset of machine learning, are inspired by the structure of the human brain.",
  "Tokyo is the most populous metropolitan area in the world with over 37 million people. The city blends ultramodern technology with traditional temples, and its efficient railway system moves millions of commuters daily.",
  "Photosynthesis is the process by which plants convert sunlight, water, and carbon dioxide into glucose and oxygen. This process occurs primarily in the chloroplasts of plant cells and is essential for life on Earth.",
  "The French Revolution began in 1789 and fundamentally transformed the political landscape of France and Europe. It replaced the monarchy with a republic and introduced principles of liberty, equality, and fraternity.",
  "Regular cardiovascular exercise strengthens the heart muscle, lowers blood pressure, and improves circulation. Even 30 minutes of brisk walking five days a week can significantly reduce the risk of heart disease.",
  "Dogs were domesticated from wolves approximately 15,000 years ago, making them one of the first animals to live alongside humans. Today there are over 340 recognized breeds, each with distinct characteristics and temperaments.",
  "JavaScript was created in just 10 days by Brendan Eich in 1995. Despite its rushed creation, it became the most widely used programming language in the world, running in every web browser and increasingly on servers.",
  "The Amazon rainforest produces about 20 percent of the world's oxygen and contains approximately 10 percent of all species on Earth. Deforestation threatens this vital ecosystem and contributes to climate change.",
  "A sourdough starter is a fermented mixture of flour and water that contains wild yeast and beneficial bacteria. It takes about 5 to 7 days to develop a mature starter, which can then be used indefinitely to leaven bread.",
  "Quantum computing uses quantum mechanical phenomena like superposition and entanglement to process information. A quantum bit, or qubit, can exist in multiple states simultaneously, enabling certain computations to be performed exponentially faster.",
  "Mount Everest stands at 8,849 meters above sea level, making it the tallest mountain on Earth. The first confirmed summit was achieved by Edmund Hillary and Tenzing Norgay in 1953.",
  "Chess originated in India around the 6th century and spread through Persia to the Arab world and eventually Europe. The game has 10 to the power of 120 possible game variations, known as the Shannon number.",
  "Honey never spoils. Archaeologists have found 3,000-year-old honey in Egyptian tombs that was still perfectly edible. Its low moisture content and acidic pH create an environment hostile to bacteria and microorganisms.",
  "The human brain contains approximately 86 billion neurons, each connected to thousands of others through synapses. It consumes about 20 percent of the body's total energy despite being only 2 percent of body weight.",
  "Climate change is driven primarily by greenhouse gas emissions from burning fossil fuels. Global temperatures have risen approximately 1.1 degrees Celsius since pre-industrial times, causing more frequent extreme weather events.",
  "Vaccines work by training the immune system to recognize and fight specific pathogens. They contain weakened or inactive parts of a pathogen that trigger an immune response without causing the disease itself.",
  "The Fibonacci sequence appears throughout nature, from the spiral arrangement of seeds in a sunflower to the branching patterns of trees. Each number in the sequence is the sum of the two preceding numbers.",
];

export default function App() {
  const [modelState, setModelState] = useState<ModelState>('idle');
  const [progress, setProgress] = useState(0);
  const [inputText, setInputText] = useState('');
  const [passages, setPassages] = useState<string[]>([]);
  const [embeddings, setEmbeddings] = useState<Float32Array[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [indexing, setIndexing] = useState(false);
  const [searching, setSearching] = useState(false);

  const ensureModel = useCallback(async () => {
    if (modelState === 'ready') return true;
    setModelState('downloading');
    try {
      await initModel((p) => setProgress(p));
      setModelState('ready');
      return true;
    } catch {
      setModelState('error');
      return false;
    }
  }, [modelState]);

  const handleIndex = useCallback(async (text: string) => {
    const ok = await ensureModel();
    if (!ok) return;

    setIndexing(true);
    setResults([]);
    try {
      // Split by double newlines or single newlines (paragraph-level)
      const parts = text
        .split(/\n\s*\n|\n/)
        .map(s => s.trim())
        .filter(s => s.length > 10);
      setPassages(parts);
      const embs = await indexTexts(parts);
      setEmbeddings(embs);
    } finally {
      setIndexing(false);
    }
  }, [ensureModel]);

  const handleSearch = useCallback(async () => {
    if (!query.trim() || embeddings.length === 0) return;
    setSearching(true);
    try {
      const r = await search(query, embeddings, passages, 10);
      setResults(r);
    } finally {
      setSearching(false);
    }
  }, [query, embeddings, passages]);

  const loadDemo = useCallback(async () => {
    const text = DEMO_PARAGRAPHS.join('\n\n');
    setInputText(text);
    await handleIndex(text);
  }, [handleIndex]);

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">
          FreeAgentStore
        </a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
          Smart Search
        </h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
          MiniLM-L6 — 23MB model
        </span>
      </header>

      <main className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-4 gap-4">
        {/* Model download progress */}
        {modelState === 'downloading' && (
          <div className="bg-neutral-900 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-300">Downloading model...</span>
              <span className="text-xs text-neutral-500 font-mono">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-neutral-800 rounded-full h-2">
              <div
                className="bg-violet-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-neutral-600 mt-2">First time only — cached for future use</p>
          </div>
        )}

        {modelState === 'error' && (
          <div className="bg-red-950/50 border border-red-800 rounded-lg p-4 text-sm text-red-300">
            Failed to load model. Check your connection and try again.
          </div>
        )}

        {/* Index section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-300">Index Text</h2>
            <button
              onClick={loadDemo}
              className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
            >
              Load demo content (20 paragraphs)
            </button>
          </div>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste text here. Paragraphs separated by blank lines will become individual searchable passages."
            className="w-full h-40 bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-sm text-neutral-200 placeholder-neutral-600 resize-y focus:outline-none focus:border-violet-600"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleIndex(inputText)}
              disabled={!inputText.trim() || indexing}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {indexing ? 'Indexing...' : 'Index Passages'}
            </button>
            {passages.length > 0 && (
              <span className="text-xs text-neutral-500">
                {passages.length} passages indexed
              </span>
            )}
          </div>
        </section>

        {/* Search section */}
        {passages.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-neutral-300">Search</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder='Try "how to make pasta" or "puppy" or "quantum physics"'
                className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-violet-600"
              />
              <button
                onClick={handleSearch}
                disabled={!query.trim() || searching}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {searching ? '...' : 'Search'}
              </button>
            </div>

            {/* Quick demo queries */}
            <div className="flex flex-wrap gap-1.5">
              {['how to make pasta', 'puppy', 'artificial intelligence', 'workout', 'cooking recipes', 'space exploration'].map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setQuery(q);
                    // Trigger search after setting query
                    setTimeout(async () => {
                      const r = await search(q, embeddings, passages, 10).catch(() => []);
                      setResults(r);
                    }, 0);
                  }}
                  className="px-2.5 py-1 rounded-full text-xs bg-neutral-800 text-neutral-400 hover:bg-neutral-700 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Results */}
        {results.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-neutral-300">
              Results for &ldquo;{query}&rdquo;
            </h2>
            {results.map((r) => (
              <div key={r.index} className="bg-neutral-900 rounded-lg p-4 space-y-2">
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
                <p className="text-sm text-neutral-300 leading-relaxed">{r.text}</p>
              </div>
            ))}

            {/* Semantic vs keyword explanation */}
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-3 mt-3">
              <p className="text-xs text-neutral-500">
                Semantic search finds results by meaning, not keywords. &ldquo;dog&rdquo; matches text about puppies and canines.
                &ldquo;how to make pasta&rdquo; finds cooking instructions even without the word &ldquo;pasta&rdquo;.
              </p>
            </div>
          </section>
        )}

        <p className="text-xs text-neutral-600">
          Model-based agent — all-MiniLM-L6-v2 (23MB) runs locally in your browser. Your text never leaves your device.
        </p>
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Sentence embeddings + cosine similarity search.
        <a href="https://github.com/FreeAgentStore/platform/blob/main/agents/smart-search/web/src/search.ts" className="underline ml-1">View source</a>
      </footer>
    </div>
  );
}
