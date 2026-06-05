/**
 * Clickbait detector — LLM-generated, deterministic, no model needed.
 * This code was evolved through the FunSearch-style loop:
 * feed examples -> LLM writes code -> eval -> improve -> repeat.
 *
 * v1: weighted signal scoring for sensationalism, curiosity gaps,
 *     emotional manipulation, urgency, and structural patterns.
 */

export interface ClickbaitResult {
  isClickbait: boolean;
  score: number;        // 0-1 (0 = genuine, 1 = maximum clickbait)
  confidence: number;
  signals: string[];
  category: 'genuine' | 'mild' | 'moderate' | 'extreme';
}

const SENSATIONALISM: Record<string, number> = {
  shocking: 3, unbelievable: 3, incredible: 3, insane: 3, epic: 2,
  amazing: 2, stunning: 2, devastating: 2, horrifying: 2, heartbreaking: 2,
  terrifying: 2, explosive: 2, bombshell: 3, outrageous: 2, scandalous: 2,
  sensational: 3, astonishing: 2, staggering: 2, phenomenal: 2,
  catastrophic: 2, monumental: 2, unprecedented: 2, extraordinary: 1,
  dramatic: 1, savage: 2, brutal: 2, wild: 2, crazy: 2, insanely: 3,
  absolutely: 1, completely: 1, totally: 1, utterly: 2,
  legendary: 2, iconic: 1, historic: 1, massive: 2, enormous: 1,
  ultimate: 2, extreme: 2, intense: 1, ridiculous: 2, absurd: 2,
  unreal: 3, surreal: 2, bonkers: 2, bananas: 2,
};

const CURIOSITY_GAP_PHRASES: [string, number][] = [
  ["you won't believe", 3], ["you won't guess", 3],
  ["you'll never guess", 3], ["you'll never believe", 3],
  ["what happened next", 3], ["what happens next", 3],
  ["the reason why", 3], ["the real reason", 3],
  ["this is why", 2], ["here's why", 2], ["here's what", 2],
  ["here is why", 2], ["here is what", 2],
  ["what they found", 2], ["what we found", 2], ["what i found", 2],
  ["the truth about", 3], ["the whole truth", 3],
  ["they don't want you to know", 3], ["doesn't want you to know", 3],
  ["finally revealed", 3], ["has been revealed", 2], ["just revealed", 2],
  ["exposed", 2], ["the real story", 2],
  ["the secret to", 2], ["the secret of", 2],
  ["no one is talking about", 3], ["nobody is talking about", 3],
  ["no one tells you", 3], ["nobody tells you", 3],
  ["what no one tells", 3], ["what nobody tells", 3],
  ["you need to see", 2], ["you have to see", 2],
  ["wait until you see", 3], ["wait till you see", 3],
  ["you need to know", 2], ["you should know", 1],
  ["the answer will surprise you", 3], ["the result will surprise you", 3],
  ["what they're hiding", 3], ["what they hide", 3],
  ["find out why", 2], ["find out how", 2], ["find out what", 2],
  ["guess what", 2], ["bet you didn't know", 3],
  ["can you believe", 2], ["would you believe", 2],
];

const LISTICLE_PATTERNS: [RegExp, number][] = [
  [/\b\d+\s+(things|reasons|ways|tips|tricks|hacks|facts|signs|secrets|mistakes|rules|steps|lessons)\b/i, 2],
  [/\btop\s+\d+\b/i, 1],
  [/#?\s*\d+\s+will\s+(shock|surprise|amaze|blow|change|make)/i, 3],
  [/\bnumber\s+\d+\b/i, 2],
  [/\b\d+\s+(you\s+(need|must|should|have)\s+to|that\s+will)\b/i, 2],
];

const VAGUENESS_PHRASES: [string, number][] = [
  ["one simple trick", 3], ["one weird trick", 3], ["this one trick", 3],
  ["this one thing", 2], ["this one simple", 3],
  ["a man", 1], ["a woman", 1], ["a boy", 1], ["a girl", 1],
  ["someone", 1], ["a person", 1],
  ["this product", 1], ["this method", 1], ["this technique", 1],
];

const EMOTIONAL_MANIPULATION: [string, number][] = [
  ["everyone needs to see", 3], ["everyone should see", 3],
  ["everyone needs to know", 3], ["the world needs to see", 3],
  ["changed my life", 2], ["will change your life", 3],
  ["life changing", 2], ["life altering", 2],
  ["makes me cry", 3], ["made me cry", 3], ["brought me to tears", 3],
  ["i'm literally shaking", 3], ["literally shaking", 3],
  ["faith in humanity", 2], ["restore your faith", 2],
  ["will make you cry", 3], ["will make you laugh", 2],
  ["will blow your mind", 3], ["mind blowing", 3], ["mind blown", 3],
  ["jaw dropping", 3], ["jaw dropped", 3],
  ["gave me chills", 2], ["gives me chills", 2], ["sent chills", 2],
  ["will leave you speechless", 3], ["left me speechless", 3],
  ["i can't stop watching", 2], ["can't stop laughing", 2],
  ["will break your heart", 3], ["broke my heart", 2],
  ["you won't stop laughing", 3], ["i lost it", 1],
];

const URGENCY_FOMO: [string, number][] = [
  ["before it's too late", 3], ["before they delete", 3],
  ["before it gets taken down", 3], ["before it's gone", 2],
  ["limited time", 2], ["act now", 2], ["act fast", 2],
  ["you're missing out", 3], ["don't miss", 2], ["don't miss out", 3],
  ["breaking", 2], ["just announced", 1], ["just in", 2],
  ["happening now", 2], ["right now", 1], ["as we speak", 2],
  ["last chance", 2], ["final warning", 2], ["urgent", 2],
  ["time is running out", 3], ["clock is ticking", 2],
  ["going viral", 2], ["trending now", 2], ["everyone is talking", 2],
  ["share before", 2], ["share this before", 3],
  ["watch before", 2], ["read before", 2],
  ["they're trying to remove", 3], ["banned", 2], ["censored", 2],
];

// Anti-clickbait: reduce score when present
const ANTI_CLICKBAIT_WORDS: Record<string, number> = {
  according: 1, study: 1, research: 1, report: 1, analysis: 1,
  percent: 1, percentage: 1, billion: 1, million: 1, trillion: 1,
  quarterly: 2, annually: 1, fiscal: 2, published: 1, journal: 1,
  professor: 1, university: 1, institute: 1, organization: 1,
  officials: 1, spokesperson: 1, confirmed: 1, announced: 1,
  estimated: 1, approximately: 1, roughly: 1,
};

const ANTI_CLICKBAIT_PATTERNS: [RegExp, number][] = [
  // Specific names (capitalized proper nouns)
  [/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/, 1],
  // Dates
  [/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}/i, 1],
  [/\b\d{4}\b/, 0.5],
  // Precise numbers with units
  [/\$[\d,.]+\s*(billion|million|thousand|trillion)/i, 2],
  [/\b\d+(\.\d+)?\s*%/, 1],
  // Citations
  [/\b(said|stated|reported|noted|cited)\b/i, 1],
  // Full sentences (not fragments) - proxy: has a verb and is long
  [/.{80,}/, 0.5],
];

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z'\s]/g, ' ').split(/\s+/).filter(Boolean);
}

function matchPhrases(lower: string, phrases: [string, number][]): { score: number; matched: string[] } {
  let score = 0;
  const matched: string[] = [];
  for (const [phrase, weight] of phrases) {
    if (lower.includes(phrase)) {
      score += weight;
      matched.push(phrase);
    }
  }
  return { score, matched };
}

export function detectClickbait(text: string): ClickbaitResult {
  const lower = text.toLowerCase();
  const words = tokenize(text);
  let totalScore = 0;
  const signals: string[] = [];

  // 1. Sensationalism words
  const seen = new Set<string>();
  for (const w of words) {
    if (SENSATIONALISM[w] && !seen.has(w)) {
      totalScore += SENSATIONALISM[w];
      signals.push(w);
      seen.add(w);
    }
  }

  // 2. Curiosity gap phrases
  const curiosity = matchPhrases(lower, CURIOSITY_GAP_PHRASES);
  totalScore += curiosity.score;
  signals.push(...curiosity.matched);

  // 3. Number listicles
  for (const [pattern, weight] of LISTICLE_PATTERNS) {
    if (pattern.test(text)) {
      totalScore += weight;
      const match = text.match(pattern);
      if (match) signals.push(match[0].trim().toLowerCase());
    }
  }

  // 4. Vagueness phrases
  const vagueness = matchPhrases(lower, VAGUENESS_PHRASES);
  totalScore += vagueness.score;
  signals.push(...vagueness.matched);

  // 5. Emotional manipulation
  const emotional = matchPhrases(lower, EMOTIONAL_MANIPULATION);
  totalScore += emotional.score;
  signals.push(...emotional.matched);

  // 6. Urgency / FOMO
  const urgency = matchPhrases(lower, URGENCY_FOMO);
  totalScore += urgency.score;
  signals.push(...urgency.matched);

  // 7. Structural patterns
  // ALL CAPS words (3+ letter words that are fully uppercase)
  const capsWords = text.match(/\b[A-Z]{3,}\b/g) || [];
  const realCapsWords = capsWords.filter(w => !['THE', 'AND', 'FOR', 'NOT', 'YOU', 'ARE', 'BUT', 'HAS', 'HAD', 'WAS', 'HIS', 'HER', 'ITS', 'OUR', 'WHO', 'HOW', 'USA', 'FBI', 'CIA', 'CEO', 'NASA', 'NBA', 'NFL', 'NFL', 'GDP', 'IPO', 'API', 'PDF', 'URL', 'HIV', 'AIDS', 'DNA', 'RNA'].includes(w));
  if (realCapsWords.length > 0) {
    totalScore += realCapsWords.length;
    signals.push(`ALL CAPS (${realCapsWords.length} words)`);
  }

  // Excessive punctuation
  const exclamations = (text.match(/!{2,}/g) || []).length;
  const questionExcl = (text.match(/\?!|!\?/g) || []).length;
  if (exclamations > 0) {
    totalScore += exclamations * 2;
    signals.push('excessive exclamation marks');
  }
  if (questionExcl > 0) {
    totalScore += questionExcl * 2;
    signals.push('mixed ?! punctuation');
  }

  // Very short text with sensational words (headline-like)
  if (words.length <= 15 && totalScore > 0) {
    totalScore += 1;
  }

  // Question format headlines ("Is X doing Y?")
  if (/^(is|are|was|were|does|did|has|have|could|would|should|will|can)\s/i.test(text.trim()) && text.includes('?')) {
    totalScore += 1;
    signals.push('question headline format');
  }

  // 8. Anti-clickbait reduction
  let antiScore = 0;
  for (const w of words) {
    if (ANTI_CLICKBAIT_WORDS[w]) {
      antiScore += ANTI_CLICKBAIT_WORDS[w];
    }
  }
  for (const [pattern, weight] of ANTI_CLICKBAIT_PATTERNS) {
    if (pattern.test(text)) {
      antiScore += weight;
    }
  }

  // Reduce clickbait score by anti-clickbait signals
  totalScore = Math.max(0, totalScore - antiScore * 0.5);

  // Normalize to 0-1 (cap at ~20 raw score = 1.0)
  const normalized = Math.min(totalScore / 20, 1);

  // Determine category
  let category: ClickbaitResult['category'];
  if (normalized < 0.15) category = 'genuine';
  else if (normalized < 0.35) category = 'mild';
  else if (normalized < 0.6) category = 'moderate';
  else category = 'extreme';

  // Confidence based on total signal count
  const confidence = Math.min(signals.length / 5, 1);

  return {
    isClickbait: normalized >= 0.3,
    score: Math.round(normalized * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
    signals,
    category,
  };
}
