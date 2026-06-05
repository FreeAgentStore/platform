/**
 * Sentiment heuristic — LLM-generated, deterministic, no model needed.
 * This code was evolved through the FunSearch-style loop:
 * feed examples → LLM writes code → eval → improve → repeat.
 *
 * v3: weighted keyword scoring + negation detection + intensifiers
 */

const POSITIVE: Record<string, number> = {
  great: 3, excellent: 3, amazing: 3, wonderful: 3, fantastic: 3, outstanding: 3, superb: 3,
  good: 2, nice: 2, happy: 2, love: 2, enjoy: 2, pleased: 2, perfect: 2, brilliant: 2,
  like: 1, fine: 1, okay: 1, decent: 1, pleasant: 1, helpful: 1, useful: 1, recommend: 2,
  best: 3, awesome: 3, impressive: 2, delightful: 2, satisfied: 2, beautiful: 2,
};

const NEGATIVE: Record<string, number> = {
  terrible: 3, horrible: 3, awful: 3, worst: 3, disgusting: 3, dreadful: 3,
  bad: 2, poor: 2, disappointing: 2, hate: 2, annoying: 2, frustrating: 2, broken: 2, useless: 2,
  slow: 1, boring: 1, mediocre: 1, confusing: 1, overpriced: 2, waste: 2, avoid: 2,
  ugly: 2, painful: 2, rude: 2, expensive: 1, difficult: 1,
};

const NEGATORS = new Set(['not', "n't", 'no', 'never', 'neither', 'nor', 'hardly', 'barely', 'scarcely']);
const INTENSIFIERS: Record<string, number> = { very: 1.5, really: 1.5, extremely: 2, incredibly: 2, absolutely: 2, totally: 1.5, quite: 1.2, so: 1.3 };

export function analyzeSentiment(text: string): { sentiment: 'positive' | 'negative' | 'neutral'; score: number; confidence: number } {
  const words = text.toLowerCase().replace(/[^a-z'\s]/g, '').split(/\s+/).filter(Boolean);
  let score = 0;
  let totalWeight = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let posScore = POSITIVE[word] ?? 0;
    let negScore = NEGATIVE[word] ?? 0;

    if (posScore === 0 && negScore === 0) continue;

    // Check for negation in previous 3 words
    let negated = false;
    for (let j = Math.max(0, i - 3); j < i; j++) {
      if (NEGATORS.has(words[j]) || words[j].endsWith("n't")) {
        negated = true;
        break;
      }
    }

    // Check for intensifier in previous word
    let multiplier = 1;
    if (i > 0 && INTENSIFIERS[words[i - 1]]) {
      multiplier = INTENSIFIERS[words[i - 1]];
    }

    if (negated) {
      // Flip sentiment
      const temp = posScore;
      posScore = negScore * 0.5; // negation weakens rather than fully flips
      negScore = temp * 0.5;
    }

    score += (posScore - negScore) * multiplier;
    totalWeight += Math.max(posScore, negScore) * multiplier;
  }

  const normalized = totalWeight > 0 ? score / totalWeight : 0;
  const confidence = Math.min(totalWeight / 5, 1); // confidence grows with more signal words

  let sentiment: 'positive' | 'negative' | 'neutral';
  if (normalized > 0.1) sentiment = 'positive';
  else if (normalized < -0.1) sentiment = 'negative';
  else sentiment = 'neutral';

  return { sentiment, score: Math.round(normalized * 100) / 100, confidence: Math.round(confidence * 100) / 100 };
}
