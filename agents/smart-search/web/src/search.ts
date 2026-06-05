import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

export interface SearchResult {
  text: string;
  score: number;
  index: number;
}

let extractor: FeatureExtractionPipeline | null = null;
let _modelStatus: 'loading' | 'ready' | 'error' = 'loading';
let _progress = 0;

type ProgressCallback = (progress: number) => void;

export function getModelStatus(): 'loading' | 'ready' | 'error' {
  return _modelStatus;
}

export function getProgress(): number {
  return _progress;
}

export async function initModel(onProgress?: ProgressCallback): Promise<void> {
  if (extractor) return;
  _modelStatus = 'loading';
  _progress = 0;
  try {
    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      progress_callback: (data: { progress?: number; status?: string }) => {
        if (data.progress !== undefined) {
          _progress = data.progress;
          onProgress?.(data.progress);
        }
      },
    }) as FeatureExtractionPipeline;
    _modelStatus = 'ready';
    _progress = 100;
    onProgress?.(100);
  } catch (e) {
    _modelStatus = 'error';
    console.error('Failed to load model:', e);
    throw e;
  }
}

export async function embed(text: string): Promise<Float32Array> {
  if (!extractor) throw new Error('Model not loaded');
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return new Float32Array(output.data as Float64Array);
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
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

export async function indexTexts(texts: string[]): Promise<Float32Array[]> {
  const embeddings: Float32Array[] = [];
  for (const text of texts) {
    embeddings.push(await embed(text));
  }
  return embeddings;
}

export async function search(
  query: string,
  index: Float32Array[],
  texts: string[],
  topK = 5,
): Promise<SearchResult[]> {
  const queryEmbedding = await embed(query);
  const scored: SearchResult[] = index.map((emb, i) => ({
    text: texts[i],
    score: cosineSimilarity(queryEmbedding, emb),
    index: i,
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
