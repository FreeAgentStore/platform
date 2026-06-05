import { pipeline, env, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';

export interface JournalEntry {
  transcript: string;
  duration: number;
  wordCount: number;
  wordsPerMinute: number;
  mood: { primary: string; valence: number };
  summary: string;
  keyTopics: string[];
  timestamp: number;
}

let pipe: AutomaticSpeechRecognitionPipeline | null = null;

type ProgressCallback = (pct: number) => void;

export async function initModel(onProgress?: ProgressCallback): Promise<void> {
  env.allowLocalModels = false;

  let fileCount = 0;
  pipe = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
    device: navigator.gpu ? 'webgpu' : 'wasm',
    progress_callback: (info: { status: string; progress?: number }) => {
      if (info.status === 'progress' && info.progress != null) {
        onProgress?.(Math.round(info.progress));
      } else if (info.status === 'done') {
        fileCount++;
        onProgress?.(Math.min(90 + fileCount * 2, 99));
      }
    },
  }) as AutomaticSpeechRecognitionPipeline;

  onProgress?.(100);
}

// --- Inline emotion detection (Plutchik-based, vendored from emotion-detector) ---

type Emotion = 'joy' | 'anger' | 'sadness' | 'fear' | 'surprise' | 'disgust' | 'trust' | 'anticipation';

const EMOTION_WORDS: Record<Emotion, Record<string, number>> = {
  joy: {
    happy: 2, love: 2, wonderful: 2, amazing: 2, great: 2, beautiful: 2, enjoy: 2, fun: 2,
    excited: 2, grateful: 2, blessed: 2, fantastic: 2, awesome: 2, brilliant: 2,
    glad: 1, content: 1, satisfied: 1, pleasant: 1, nice: 1, good: 1, smile: 1, warm: 1,
    peaceful: 1, positive: 1, fortunate: 1, lucky: 1, cheerful: 1, delighted: 1,
    ecstatic: 3, euphoria: 3, bliss: 3, elated: 3, overjoyed: 3, thrilled: 3,
  },
  anger: {
    angry: 2, hate: 2, furious: 3, frustrated: 2, annoyed: 2, irritated: 2,
    mad: 1, upset: 1, rage: 3, hostile: 2, aggressive: 2, infuriating: 2,
    unacceptable: 2, ridiculous: 2, terrible: 2, awful: 1, disgusted: 2,
  },
  sadness: {
    sad: 2, depressed: 2, lonely: 2, crying: 2, tears: 2, hopeless: 2, empty: 2,
    hurt: 2, painful: 2, heartbroken: 3, devastated: 3, grief: 3, miserable: 3,
    unhappy: 1, disappointed: 1, down: 1, gloomy: 2, melancholy: 2, sorrow: 2,
  },
  fear: {
    afraid: 2, scared: 2, anxious: 2, worried: 2, nervous: 2, terrified: 3,
    panic: 3, dread: 3, frightened: 2, alarming: 2, dangerous: 2, uneasy: 2,
    concerned: 1, apprehensive: 1, tense: 1, uncertain: 1, insecure: 1,
  },
  surprise: {
    surprised: 2, shocked: 2, amazed: 2, unexpected: 2, unbelievable: 2, wow: 2,
    astonished: 3, stunned: 3, incredible: 2, speechless: 2, suddenly: 1,
    curious: 1, strange: 1, weird: 1, unusual: 1,
  },
  disgust: {
    disgusting: 2, gross: 2, nasty: 2, horrible: 2, revolting: 3, sickening: 2,
    unpleasant: 1, ugly: 1, offensive: 2, repulsive: 3, vile: 3, awful: 1,
  },
  trust: {
    trust: 2, reliable: 2, honest: 2, loyal: 2, faithful: 2, confident: 2,
    safe: 2, secure: 2, genuine: 2, believe: 1, depend: 1, certain: 1,
    devoted: 3, committed: 2, supportive: 1,
  },
  anticipation: {
    expecting: 2, waiting: 2, hoping: 2, planning: 2, eager: 2, ready: 2,
    looking: 1, forward: 1, soon: 1, excited: 2, prepared: 1, upcoming: 2,
    countdown: 3, craving: 3, determined: 2,
  },
};

const VALENCE: Record<Emotion, number> = {
  joy: 1, trust: 0.6, anticipation: 0.4, surprise: 0.2,
  anger: -0.8, sadness: -0.9, fear: -0.7, disgust: -0.8,
};

const MOOD_LABELS: Record<Emotion, string> = {
  joy: 'Happy', anger: 'Angry', sadness: 'Sad', fear: 'Anxious',
  surprise: 'Surprised', disgust: 'Disgusted', trust: 'Confident', anticipation: 'Eager',
};

function detectMood(text: string): { primary: string; valence: number } {
  const words = text.toLowerCase().replace(/[^a-z'\s-]/g, '').split(/\s+/).filter(Boolean);
  const scores: Record<Emotion, number> = {
    joy: 0, anger: 0, sadness: 0, fear: 0,
    surprise: 0, disgust: 0, trust: 0, anticipation: 0,
  };

  for (const word of words) {
    for (const emotion of Object.keys(EMOTION_WORDS) as Emotion[]) {
      const weight = EMOTION_WORDS[emotion][word];
      if (weight) scores[emotion] += weight;
    }
  }

  const sorted = (Object.keys(scores) as Emotion[]).sort((a, b) => scores[b] - scores[a]);
  const primary = sorted[0];
  const hasSignal = scores[primary] > 0;

  return {
    primary: hasSignal ? MOOD_LABELS[primary] : 'Neutral',
    valence: hasSignal
      ? Math.round(VALENCE[primary] * Math.min(1, scores[primary] / 6) * 100) / 100
      : 0,
  };
}

// --- Heuristic summarizer ---

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
  'under', 'again', 'further', 'then', 'once', 'and', 'but', 'or', 'nor',
  'not', 'so', 'yet', 'both', 'either', 'neither', 'each', 'every',
  'all', 'any', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
  'only', 'own', 'same', 'than', 'too', 'very', 'just', 'because',
  'this', 'that', 'these', 'those', 'i', 'me', 'my', 'myself', 'we',
  'our', 'ours', 'you', 'your', 'he', 'she', 'it', 'its', 'they',
  'them', 'their', 'what', 'which', 'who', 'whom', 'when', 'where',
  'why', 'how', 'up', 'about', 'also', 'like', 'really', 'um', 'uh',
  'yeah', 'okay', 'well', 'right', 'thing', 'things', 'think', 'know',
  'going', 'got', 'get', 'go', 'went', 'come', 'came', 'make', 'made',
]);

function extractKeyTopics(text: string): string[] {
  const words = text.toLowerCase().replace(/[^a-z'\s-]/g, '').split(/\s+/).filter(Boolean);
  const freq: Record<string, number> = {};

  for (const word of words) {
    if (word.length < 3 || STOP_WORDS.has(word)) continue;
    freq[word] = (freq[word] || 0) + 1;
  }

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

function summarize(text: string): string {
  // Split into sentences
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  if (sentences.length <= 2) return text.trim();

  // Score sentences by keyword importance
  const topics = extractKeyTopics(text);
  const scored = sentences.map((sentence, idx) => {
    let score = 0;
    const lower = sentence.toLowerCase();

    // First sentence bonus
    if (idx === 0) score += 3;

    // Topic word frequency
    for (const topic of topics) {
      if (lower.includes(topic)) score += 2;
    }

    // Longer sentences (more content) get slight bonus
    const wordCount = sentence.trim().split(/\s+/).length;
    if (wordCount > 5 && wordCount < 30) score += 1;

    return { sentence: sentence.trim(), score };
  });

  // Take top 1-3 sentences, in original order
  const threshold = Math.max(1, Math.min(3, Math.ceil(sentences.length / 3)));
  const top = scored
    .map((s, i) => ({ ...s, index: i }))
    .sort((a, b) => b.score - a.score)
    .slice(0, threshold)
    .sort((a, b) => a.index - b.index);

  return top.map((s) => s.sentence).join(' ');
}

export async function processRecording(audioBlob: Blob): Promise<JournalEntry> {
  if (!pipe) throw new Error('Model not initialized. Call initModel() first.');

  // Get audio duration
  const audioUrl = URL.createObjectURL(audioBlob);
  const duration = await new Promise<number>((resolve) => {
    const audio = new Audio();
    audio.src = audioUrl;
    audio.onloadedmetadata = () => {
      resolve(audio.duration);
      URL.revokeObjectURL(audioUrl);
    };
    audio.onerror = () => {
      resolve(0);
      URL.revokeObjectURL(audioUrl);
    };
  });

  // Transcribe
  const blobUrl = URL.createObjectURL(audioBlob);
  const result = await pipe(blobUrl);
  URL.revokeObjectURL(blobUrl);

  const transcript = (typeof result === 'object' && 'text' in result)
    ? (result as { text: string }).text.trim()
    : String(result).trim();

  const words = transcript.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const wordsPerMinute = duration > 0 ? Math.round(wordCount / (duration / 60)) : 0;

  // Mood analysis
  const mood = detectMood(transcript);

  // Summary
  const summary = summarize(transcript);

  // Key topics
  const keyTopics = extractKeyTopics(transcript);

  return {
    transcript,
    duration: Math.round(duration),
    wordCount,
    wordsPerMinute,
    mood,
    summary,
    keyTopics,
    timestamp: Date.now(),
  };
}
