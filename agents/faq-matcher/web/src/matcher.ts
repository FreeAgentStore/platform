import { pipeline, env, type FeatureExtractionPipeline } from '@huggingface/transformers';

export interface FAQEntry {
  question: string;
  answer: string;
  embedding?: Float32Array;
}

export interface MatchResult {
  question: string;
  answer: string;
  score: number;
  rank: number;
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

export async function embed(text: string): Promise<Float32Array> {
  if (!pipe) throw new Error('Model not initialized. Call initModel() first.');
  const output = await pipe(text, { pooling: 'mean', normalize: true });
  return new Float32Array(output.data as Float32Array);
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

export async function indexFAQ(
  entries: { question: string; answer: string }[],
  onItemDone?: (index: number, total: number) => void,
): Promise<FAQEntry[]> {
  const indexed: FAQEntry[] = [];
  for (let i = 0; i < entries.length; i++) {
    const embedding = await embed(entries[i].question);
    indexed.push({ ...entries[i], embedding });
    onItemDone?.(i + 1, entries.length);
  }
  return indexed;
}

export async function findAnswer(
  query: string,
  index: FAQEntry[],
  topK = 5,
): Promise<MatchResult[]> {
  const queryEmbedding = await embed(query);

  const scored = index
    .filter((e) => e.embedding)
    .map((e) => ({
      question: e.question,
      answer: e.answer,
      score: cosineSimilarity(queryEmbedding, e.embedding!),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((m, i) => ({ ...m, rank: i + 1 }));

  return scored;
}

export const DEMO_FAQ = [
  {
    question: 'How do I reset my password?',
    answer: 'Click "Forgot Password" on the login page, enter your email, and follow the link sent to your inbox.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept Visa, Mastercard, and PayPal. Enterprise customers can pay via invoice.',
  },
  {
    question: 'Can I cancel my subscription?',
    answer: "Yes, go to Settings > Billing > Cancel Subscription. You'll keep access until the end of your billing period.",
  },
  {
    question: 'Is there a free trial?',
    answer: 'Yes, all plans come with a 14-day free trial. No credit card required.',
  },
  {
    question: 'How do I contact support?',
    answer: 'Email support@example.com or use the chat widget in the bottom-right corner.',
  },
  {
    question: 'Do you have an API?',
    answer: 'Yes, full REST API documentation is at docs.example.com/api.',
  },
  {
    question: 'Can I export my data?',
    answer: 'Yes, go to Settings > Export Data. You can download CSV or JSON.',
  },
  {
    question: 'What are your uptime guarantees?',
    answer: 'We guarantee 99.9% uptime with automatic failover across 3 regions.',
  },
  {
    question: 'How do I add team members?',
    answer: 'Go to Settings > Team > Invite. Enter their email and select a role.',
  },
  {
    question: 'Is my data encrypted?',
    answer: 'Yes, all data is encrypted at rest (AES-256) and in transit (TLS 1.3).',
  },
];
