import { pipeline, env, type FeatureExtractionPipeline } from '@huggingface/transformers';

export interface ParagraphMatch {
  sourceParagraph: string;
  targetParagraph: string;
  similarity: number;
  sourceIndex: number;
  targetIndex: number;
}

export interface PlagiarismResult {
  overallScore: number;
  verdict: 'original' | 'similar' | 'suspicious' | 'likely-plagiarized';
  paragraphMatches: ParagraphMatch[];
  highestMatch: number;
}

let pipe: FeatureExtractionPipeline | null = null;

type ProgressCallback = (pct: number) => void;

export async function initModel(onProgress?: ProgressCallback): Promise<void> {
  env.allowLocalModels = false;

  let fileCount = 0;
  pipe = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
    device: navigator.gpu ? 'webgpu' : 'wasm',
    progress_callback: (info: { status: string; progress?: number }) => {
      if (info.status === 'progress' && info.progress != null) {
        onProgress?.(Math.round(info.progress));
      } else if (info.status === 'done') {
        fileCount++;
        onProgress?.(Math.min(90 + fileCount * 2, 99));
      }
    },
  }) as FeatureExtractionPipeline;

  onProgress?.(100);
}

async function embed(text: string): Promise<Float32Array> {
  if (!pipe) throw new Error('Model not initialized.');
  const output = await pipe(text, { pooling: 'mean', normalize: true });
  return new Float32Array(output.data as Float32Array);
}

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

/** Split text into chunks suitable for comparison. Prefers paragraphs, falls back to sentences. */
function splitIntoChunks(text: string): string[] {
  // Split by double newline (paragraphs)
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 0);

  // If paragraphs are too long (>500 chars), split them into sentences
  const chunks: string[] = [];
  for (const para of paragraphs) {
    if (para.length <= 500) {
      chunks.push(para);
    } else {
      // Split into sentences
      const sentences = para.match(/[^.!?]+[.!?]+/g) || [para];
      let current = '';
      for (const s of sentences) {
        if ((current + s).length > 400 && current.length > 0) {
          chunks.push(current.trim());
          current = s;
        } else {
          current += s;
        }
      }
      if (current.trim()) chunks.push(current.trim());
    }
  }

  // If we got nothing (single block of text without paragraphs), treat entire text as one chunk
  if (chunks.length === 0 && text.trim()) {
    chunks.push(text.trim());
  }

  return chunks;
}

function getVerdict(score: number): PlagiarismResult['verdict'] {
  if (score >= 0.7) return 'likely-plagiarized';
  if (score >= 0.5) return 'suspicious';
  if (score >= 0.3) return 'similar';
  return 'original';
}

export async function checkPlagiarism(
  source: string,
  target: string,
  onProgress?: (done: number, total: number) => void,
): Promise<PlagiarismResult> {
  if (!pipe) throw new Error('Model not initialized. Call initModel() first.');

  const sourceChunks = splitIntoChunks(source);
  const targetChunks = splitIntoChunks(target);

  const total = sourceChunks.length + targetChunks.length;
  let done = 0;

  // Embed source chunks
  const sourceEmbeddings: Float32Array[] = [];
  for (const chunk of sourceChunks) {
    sourceEmbeddings.push(await embed(chunk));
    done++;
    onProgress?.(done, total);
  }

  // Embed target chunks and find best matches
  const paragraphMatches: ParagraphMatch[] = [];
  let highestMatch = 0;
  let weightedSum = 0;
  let totalWeight = 0;

  for (let ti = 0; ti < targetChunks.length; ti++) {
    const targetEmb = await embed(targetChunks[ti]);
    done++;
    onProgress?.(done, total);

    let bestSim = 0;
    let bestSourceIdx = 0;

    for (let si = 0; si < sourceEmbeddings.length; si++) {
      const sim = cosineSimilarity(targetEmb, sourceEmbeddings[si]);
      if (sim > bestSim) {
        bestSim = sim;
        bestSourceIdx = si;
      }
    }

    paragraphMatches.push({
      sourceParagraph: sourceChunks[bestSourceIdx],
      targetParagraph: targetChunks[ti],
      similarity: Math.round(bestSim * 1000) / 1000,
      sourceIndex: bestSourceIdx,
      targetIndex: ti,
    });

    if (bestSim > highestMatch) highestMatch = bestSim;

    // Weight by paragraph length
    const weight = targetChunks[ti].length;
    weightedSum += bestSim * weight;
    totalWeight += weight;
  }

  const overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

  return {
    overallScore: Math.round(overallScore * 1000) / 1000,
    verdict: getVerdict(overallScore),
    paragraphMatches,
    highestMatch: Math.round(highestMatch * 1000) / 1000,
  };
}

export const DEMO_SOURCE = `Machine learning is a subset of artificial intelligence that focuses on building systems that learn from data. Rather than being explicitly programmed, these systems improve their performance on a specific task over time by processing more data.

The most common types of machine learning are supervised learning, unsupervised learning, and reinforcement learning. In supervised learning, the algorithm is trained on labeled data, meaning each training example is paired with the correct answer.

Deep learning is a specialized form of machine learning that uses neural networks with many layers. These deep neural networks have been particularly successful in tasks like image recognition, natural language processing, and speech recognition.

The training process involves feeding large amounts of data through the network and adjusting the model's parameters to minimize the difference between its predictions and the actual outcomes. This process is called backpropagation.`;

export const DEMO_TARGET = `Artificial intelligence includes a branch called machine learning, which is about creating systems that can learn from data on their own. Instead of writing specific rules, developers let these systems get better at tasks by exposing them to more information over time.

There are three main categories in this field: supervised, unsupervised, and reinforcement learning. With supervised approaches, the model trains on data where every example comes with a known correct result.

A more advanced technique known as deep learning employs multi-layered neural networks. These architectures have shown remarkable results in computer vision, understanding human language, and converting speech to text.

During training, massive datasets are passed through the network while its internal weights are fine-tuned to reduce errors between predicted and actual results. This optimization technique is referred to as backpropagation.`;
