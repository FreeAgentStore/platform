/**
 * Browser RAG — Retrieval-Augmented Generation entirely in the browser.
 * Uses MiniLM (23MB) for embeddings + IndexedDB for vector storage + Chrome Nano for generation.
 *
 * Usage:
 *   import { createRAG } from '@freeagentstore/browser-rag'
 *   const rag = await createRAG({ name: 'my-docs' })
 *   await rag.index([{ id: '1', text: 'content...' }])
 *   const answer = await rag.ask('question?')
 */

import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

// ── Public types ──

export interface RAGDocument {
  id: string;
  text: string;
  metadata?: Record<string, string>;
}

export interface RAGChunk {
  id: string;
  docId: string;
  text: string;
  embedding: Float32Array;
  metadata?: Record<string, string>;
}

export interface SearchResult {
  chunk: RAGChunk;
  score: number;
}

export interface RAGAnswer {
  answer: string;
  sources: SearchResult[];
  source: 'chrome-nano' | 'ollama' | 'none';
}

export interface RAGConfig {
  name: string;
  chunkSize?: number;
  chunkOverlap?: number;
  topK?: number;
  minScore?: number;
  onProgress?: (msg: string) => void;
}

export interface RAGInstance {
  index(docs: RAGDocument[]): Promise<void>;
  addDocument(doc: RAGDocument): Promise<void>;
  removeDocument(docId: string): Promise<void>;
  clearAll(): Promise<void>;
  getStats(): Promise<{ documents: number; chunks: number; sizeBytes: number }>;
  getDocuments(): Promise<{ id: string; chunkCount: number; metadata?: Record<string, string> }[]>;
  search(query: string, topK?: number): Promise<SearchResult[]>;
  ask(query: string, options?: { topK?: number; systemPrompt?: string }): Promise<RAGAnswer>;
  isReady(): boolean;
  loadModel(): Promise<void>;
}

// ── Embedding model (singleton) ──

let extractor: FeatureExtractionPipeline | null = null;
let modelLoading: Promise<void> | null = null;

async function ensureModel(onProgress?: (msg: string) => void): Promise<void> {
  if (extractor) return;
  if (modelLoading) return modelLoading;

  modelLoading = (async () => {
    onProgress?.('Downloading embedding model (23MB)...');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extractor = (await (pipeline as any)('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      progress_callback: (data: { progress?: number; status?: string; file?: string }) => {
        if (data.status === 'progress' && data.progress !== undefined) {
          onProgress?.(`Downloading model: ${Math.round(data.progress)}%`);
        }
      },
    })) as FeatureExtractionPipeline;
    onProgress?.('Model ready');
  })();

  return modelLoading;
}

async function embed(text: string): Promise<Float32Array> {
  if (!extractor) throw new Error('Model not loaded');
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return new Float32Array(output.data as Float64Array);
}

// ── Chunking ──

const SENTENCE_BOUNDARIES = /(?<=[.!?])\s+|\n\n+/;

function chunkText(text: string, size: number, overlap: number): string[] {
  const sentences = text.split(SENTENCE_BOUNDARIES).filter((s) => s.trim().length > 0);
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    if (current.length + trimmed.length + 1 > size && current.length > 0) {
      chunks.push(current.trim());
      // Keep overlap: take the tail of the current chunk
      if (overlap > 0) {
        const tail = current.slice(-overlap).trim();
        current = tail ? tail + ' ' + trimmed : trimmed;
      } else {
        current = trimmed;
      }
    } else {
      current = current ? current + ' ' + trimmed : trimmed;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  // If the text didn't split into sentences at all, chunk by character count
  if (chunks.length === 0 && text.trim().length > 0) {
    const raw = text.trim();
    for (let i = 0; i < raw.length; i += size - overlap) {
      chunks.push(raw.slice(i, i + size).trim());
    }
  }

  return chunks;
}

// ── Vector math ──

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ── IndexedDB storage ──

const STORE_NAME = 'chunks';

function openDB(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('docId', 'docId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

interface StoredChunk {
  id: string;
  docId: string;
  text: string;
  embedding: ArrayBuffer;
  metadata?: Record<string, string>;
}

function toStored(chunk: RAGChunk): StoredChunk {
  return {
    id: chunk.id,
    docId: chunk.docId,
    text: chunk.text,
    embedding: new Float32Array(chunk.embedding).buffer as ArrayBuffer,
    metadata: chunk.metadata,
  };
}

function fromStored(stored: StoredChunk): RAGChunk {
  return {
    id: stored.id,
    docId: stored.docId,
    text: stored.text,
    embedding: new Float32Array(stored.embedding),
    metadata: stored.metadata,
  };
}

function dbPut(db: IDBDatabase, chunks: StoredChunk[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const chunk of chunks) {
      store.put(chunk);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function dbDeleteByDocId(db: IDBDatabase, docId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('docId');
    const request = index.openCursor(IDBKeyRange.only(docId));
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function dbGetAll(db: IDBDatabase): Promise<StoredChunk[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbClear(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ── Generation backends ──

async function generateChromeNano(prompt: string): Promise<string | null> {
  const g = globalThis as Record<string, unknown>;
  const LM = (g.LanguageModel ?? (g.ai as Record<string, unknown> | undefined)?.languageModel) as
    | { create?: (opts: { systemPrompt: string }) => Promise<{ prompt: (p: string) => Promise<string>; destroy?: () => void }> }
    | undefined;
  if (!LM?.create) return null;

  try {
    const session = await LM.create({
      systemPrompt: 'You are a helpful assistant. Answer questions based on the provided context. Be concise and accurate.',
    });
    const result = await session.prompt(prompt);
    session.destroy?.();
    return result;
  } catch {
    return null;
  }
}

async function generateOllama(prompt: string): Promise<string | null> {
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2',
        prompt,
        stream: false,
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.response ?? null;
  } catch {
    return null;
  }
}

// ── createRAG factory ──

export async function createRAG(config: RAGConfig): Promise<RAGInstance> {
  const chunkSize = config.chunkSize ?? 500;
  const chunkOverlap = config.chunkOverlap ?? 50;
  const defaultTopK = config.topK ?? 3;
  const minScore = config.minScore ?? 0.3;
  const onProgress = config.onProgress;

  const db = await openDB(config.name);
  let ready = false;

  async function loadModel(): Promise<void> {
    await ensureModel(onProgress);
    ready = true;
  }

  // Start loading model immediately
  const modelPromise = loadModel();

  async function waitForModel(): Promise<void> {
    await modelPromise;
  }

  async function indexDoc(doc: RAGDocument): Promise<void> {
    await waitForModel();
    const textChunks = chunkText(doc.text, chunkSize, chunkOverlap);
    const storedChunks: StoredChunk[] = [];

    for (let i = 0; i < textChunks.length; i++) {
      const embedding = await embed(textChunks[i]);
      const chunk: RAGChunk = {
        id: `${doc.id}::${i}`,
        docId: doc.id,
        text: textChunks[i],
        embedding,
        metadata: doc.metadata,
      };
      storedChunks.push(toStored(chunk));
    }

    await dbPut(db, storedChunks);
  }

  const instance: RAGInstance = {
    async index(docs: RAGDocument[]): Promise<void> {
      for (let i = 0; i < docs.length; i++) {
        onProgress?.(`Indexing document ${i + 1}/${docs.length}...`);
        await indexDoc(docs[i]);
      }
      onProgress?.(`Indexed ${docs.length} document(s)`);
    },

    async addDocument(doc: RAGDocument): Promise<void> {
      // Remove existing chunks for this doc first
      await dbDeleteByDocId(db, doc.id);
      await indexDoc(doc);
    },

    async removeDocument(docId: string): Promise<void> {
      await dbDeleteByDocId(db, docId);
    },

    async clearAll(): Promise<void> {
      await dbClear(db);
    },

    async getStats(): Promise<{ documents: number; chunks: number; sizeBytes: number }> {
      const all = await dbGetAll(db);
      const docIds = new Set(all.map((c) => c.docId));
      let sizeBytes = 0;
      for (const c of all) {
        sizeBytes += c.text.length * 2; // rough: 2 bytes per char
        sizeBytes += c.embedding.byteLength;
      }
      return { documents: docIds.size, chunks: all.length, sizeBytes };
    },

    async getDocuments(): Promise<{ id: string; chunkCount: number; metadata?: Record<string, string> }[]> {
      const all = await dbGetAll(db);
      const map = new Map<string, { count: number; metadata?: Record<string, string> }>();
      for (const c of all) {
        const existing = map.get(c.docId);
        if (existing) {
          existing.count++;
        } else {
          map.set(c.docId, { count: 1, metadata: c.metadata });
        }
      }
      return Array.from(map.entries()).map(([id, { count, metadata }]) => ({
        id,
        chunkCount: count,
        metadata,
      }));
    },

    async search(query: string, topK?: number): Promise<SearchResult[]> {
      await waitForModel();
      const queryEmbedding = await embed(query);
      const all = await dbGetAll(db);

      const scored: SearchResult[] = [];
      for (const stored of all) {
        const chunk = fromStored(stored);
        const score = cosineSimilarity(queryEmbedding, chunk.embedding);
        if (score >= minScore) {
          scored.push({ chunk, score });
        }
      }

      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, topK ?? defaultTopK);
    },

    async ask(
      query: string,
      options?: { topK?: number; systemPrompt?: string },
    ): Promise<RAGAnswer> {
      const results = await instance.search(query, options?.topK);

      if (results.length === 0) {
        return {
          answer: 'No relevant documents found for your question.',
          sources: [],
          source: 'none',
        };
      }

      const context = results.map((r, i) => `[${i + 1}] ${r.chunk.text}`).join('\n\n');

      const systemBase =
        options?.systemPrompt ??
        'Answer the question based ONLY on the provided excerpts. If the answer is not in the excerpts, say so. Be concise.';

      const prompt = `${systemBase}\n\nExcerpts:\n${context}\n\nQuestion: ${query}`;

      // Try Chrome Nano first
      const nanoAnswer = await generateChromeNano(prompt);
      if (nanoAnswer) {
        return { answer: nanoAnswer, sources: results, source: 'chrome-nano' };
      }

      // Fall back to Ollama
      const ollamaAnswer = await generateOllama(prompt);
      if (ollamaAnswer) {
        return { answer: ollamaAnswer, sources: results, source: 'ollama' };
      }

      // No generation backend — return search results only
      return {
        answer:
          'No AI generation available. Install Chrome Canary with Built-in AI, or run Ollama locally. Here are the most relevant excerpts:',
        sources: results,
        source: 'none',
      };
    },

    isReady(): boolean {
      return ready;
    },

    loadModel,
  };

  return instance;
}
