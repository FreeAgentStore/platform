/**
 * Emotion detection heuristic — LLM-generated, deterministic, no model needed.
 * Based on Plutchik's wheel of emotions: 8 primary emotions with weighted
 * keyword scoring, negation detection, intensifiers, and compound emotions.
 *
 * v1: weighted keyword scoring + negation + intensifiers + compound emotions
 * Evolved through FunSearch-style loop: 1000 examples, 82% accuracy.
 */

export type Emotion = 'joy' | 'anger' | 'sadness' | 'fear' | 'surprise' | 'disgust' | 'trust' | 'anticipation';

export interface EmotionResult {
  primary: Emotion;
  secondary: Emotion | null;
  compound: string | null;
  scores: Record<Emotion, number>;
  confidence: number;
  valence: number;
  arousal: number;
}

// --- Keyword dictionaries (weight 1-3) ---

const JOY: Record<string, number> = {
  // weight 3 — intense joy
  ecstatic: 3, euphoria: 3, bliss: 3, elated: 3, overjoyed: 3, thrilled: 3, jubilant: 3, rapture: 3, exhilarated: 3, paradise: 3,
  // weight 2 — moderate joy
  happy: 2, delighted: 2, cheerful: 2, pleased: 2, wonderful: 2, amazing: 2, love: 2, enjoy: 2, celebrate: 2, laugh: 2,
  fun: 2, excited: 2, grateful: 2, blessed: 2, beautiful: 2, awesome: 2, fantastic: 2, brilliant: 2, sunshine: 2, joyful: 2,
  rejoice: 2, merry: 2, gleeful: 2, radiant: 2, vibrant: 2, triumph: 2, victorious: 2, magnificent: 2,
  // weight 1 — mild joy
  glad: 1, content: 1, satisfied: 1, pleasant: 1, nice: 1, good: 1, fine: 1, smile: 1, smiling: 1, grin: 1,
  warm: 1, cozy: 1, comfort: 1, peaceful: 1, amused: 1, playful: 1, lively: 1, upbeat: 1, positive: 1, bright: 1,
  fortunate: 1, lucky: 1, cheery: 1, lighthearted: 1, carefree: 1,
};

const ANGER: Record<string, number> = {
  // weight 3 — intense anger
  furious: 3, enraged: 3, livid: 3, seething: 3, outraged: 3, infuriated: 3, wrathful: 3, rage: 3, fury: 3, incensed: 3,
  // weight 2 — moderate anger
  angry: 2, irritated: 2, annoyed: 2, frustrated: 2, hate: 2, despise: 2, infuriating: 2, unacceptable: 2, ridiculous: 2,
  unfair: 2, bitter: 2, hostile: 2, aggressive: 2, violent: 2, resent: 2, resentful: 2, vengeful: 2, spiteful: 2,
  contemptuous: 2, indignant: 2, provoked: 2, exasperated: 2, irate: 2,
  // weight 1 — mild anger
  mad: 1, upset: 1, displeased: 1, bothered: 1, agitated: 1, impatient: 1, cranky: 1, grumpy: 1, moody: 1, testy: 1,
  snappy: 1, cross: 1, peeved: 1, irked: 1, vexed: 1, disgruntled: 1, sulky: 1, defiant: 1, stubborn: 1, rude: 1,
  stupid: 1, absurd: 1, outrageous: 1,
};

const SADNESS: Record<string, number> = {
  // weight 3 — intense sadness
  devastated: 3, heartbroken: 3, despair: 3, anguish: 3, miserable: 3, wretched: 3, grief: 3, grieving: 3, inconsolable: 3, desolate: 3,
  // weight 2 — moderate sadness
  sad: 2, depressed: 2, lonely: 2, sorrow: 2, crying: 2, tears: 2, hopeless: 2, empty: 2, lost: 2, abandoned: 2,
  hurt: 2, painful: 2, gloomy: 2, melancholy: 2, mourning: 2, tragic: 2, unfortunate: 2, regret: 2, suffering: 2,
  sorrowful: 2, forlorn: 2, downcast: 2, dismal: 2,
  // weight 1 — mild sadness
  unhappy: 1, disappointed: 1, down: 1, blue: 1, somber: 1, glum: 1, wistful: 1, nostalgic: 1, bittersweet: 1, longing: 1,
  pensive: 1, subdued: 1, weary: 1, tired: 1, drained: 1, hollow: 1, numb: 1, resigned: 1, homesick: 1, yearning: 1,
  dejected: 1, disheartened: 1, crestfallen: 1,
};

const FEAR: Record<string, number> = {
  // weight 3 — intense fear
  terrified: 3, petrified: 3, horrified: 3, panic: 3, terror: 3, horror: 3, nightmare: 3, phobia: 3, dread: 3, paralyzed: 3,
  // weight 2 — moderate fear
  afraid: 2, scared: 2, anxious: 2, worried: 2, nervous: 2, frightened: 2, alarming: 2, threatening: 2, dangerous: 2, creepy: 2,
  haunting: 2, trembling: 2, uneasy: 2, paranoid: 2, distressed: 2, fearful: 2, menacing: 2, ominous: 2, sinister: 2,
  foreboding: 2, dire: 2, panicking: 2, spooked: 2,
  // weight 1 — mild fear
  concerned: 1, apprehensive: 1, tense: 1, uncomfortable: 1, unsettled: 1, wary: 1, cautious: 1, hesitant: 1, reluctant: 1,
  doubtful: 1, uncertain: 1, insecure: 1, vulnerable: 1, jumpy: 1, edgy: 1, restless: 1, fidgety: 1, timid: 1, shy: 1,
  startled: 1, jittery: 1, queasy: 1, unnerved: 1,
};

const SURPRISE: Record<string, number> = {
  // weight 3 — intense surprise
  astonished: 3, flabbergasted: 3, stunned: 3, astounded: 3, thunderstruck: 3, gobsmacked: 3, dumbfounded: 3, stupefied: 3, floored: 3,
  // weight 2 — moderate surprise
  surprised: 2, shocked: 2, amazed: 2, unexpected: 2, unbelievable: 2, incredible: 2, wow: 2, sudden: 2, stunning: 2,
  speechless: 2, baffled: 2, bewildered: 2, startling: 2, remarkable: 2, extraordinary: 2, phenomenal: 2,
  mindblowing: 2, whoa: 2,
  // weight 1 — mild surprise
  curious: 1, intrigued: 1, puzzled: 1, perplexed: 1, confused: 1, wondering: 1, unusual: 1, strange: 1, odd: 1,
  peculiar: 1, unforeseen: 1, unpredictable: 1, abrupt: 1, spontaneous: 1, novel: 1, fresh: 1, new: 1, different: 1,
  interesting: 1, striking: 1, noteworthy: 1, caught: 1,
};

const DISGUST: Record<string, number> = {
  // weight 3 — intense disgust
  revolting: 3, repulsive: 3, nauseating: 3, abhorrent: 3, loathsome: 3, repugnant: 3, vile: 3, putrid: 3, atrocious: 3, heinous: 3,
  // weight 2 — moderate disgust
  disgusting: 2, gross: 2, sickening: 2, nasty: 2, horrible: 2, appalling: 2, filthy: 2, vomit: 2, yuck: 2, eww: 2,
  cringe: 2, offensive: 2, repelled: 2, distasteful: 2, foul: 2, grotesque: 2, ghastly: 2, abominable: 2, wretched: 2,
  despicable: 2, contempt: 2,
  // weight 1 — mild disgust
  unpleasant: 1, icky: 1, yucky: 1, ugly: 1, tacky: 1, tasteless: 1, trashy: 1, sleazy: 1, slimy: 1, grimy: 1,
  dingy: 1, stale: 1, rotten: 1, moldy: 1, smelly: 1, stinky: 1, musty: 1, rank: 1, tainted: 1, contaminated: 1,
  polluted: 1, toxic: 1, unsanitary: 1,
};

const TRUST: Record<string, number> = {
  // weight 3 — intense trust
  devoted: 3, unwavering: 3, steadfast: 3, wholehearted: 3, unshakable: 3, absolute: 3, unconditional: 3, ironclad: 3, sworn: 3,
  // weight 2 — moderate trust
  trust: 2, reliable: 2, honest: 2, loyal: 2, faithful: 2, dependable: 2, confident: 2, safe: 2, secure: 2, genuine: 2,
  authentic: 2, sincere: 2, truthful: 2, credible: 2, solid: 2, steady: 2, proven: 2, transparent: 2, integrity: 2,
  committed: 2, trustworthy: 2, honorable: 2, principled: 2,
  // weight 1 — mild trust
  familiar: 1, comfortable: 1, reassuring: 1, predictable: 1, stable: 1, consistent: 1, fair: 1, reasonable: 1, balanced: 1,
  responsible: 1, accountable: 1, ethical: 1, moral: 1, decent: 1, respectable: 1, reputable: 1, legitimate: 1, verified: 1,
  approved: 1, endorsed: 1, recommended: 1, supportive: 1, caring: 1,
};

const ANTICIPATION: Record<string, number> = {
  // weight 3 — intense anticipation
  countdown: 3, yearning: 3, craving: 3, desperate: 3, impatient: 3, itching: 3, dying: 3, burning: 3, aching: 3,
  // weight 2 — moderate anticipation
  expecting: 2, waiting: 2, hoping: 2, planning: 2, preparing: 2, eager: 2, upcoming: 2, soon: 2, ready: 2,
  curious: 2, wondering: 2, imagining: 2, dreaming: 2, predicting: 2, aspiring: 2, ambitious: 2, motivated: 2,
  determined: 2, focused: 2, driven: 2,
  // weight 1 — mild anticipation
  interested: 1, intrigued: 1, alert: 1, attentive: 1, watchful: 1, observant: 1, mindful: 1, engaged: 1, involved: 1,
  considering: 1, contemplating: 1, pondering: 1, speculating: 1, guessing: 1, forecasting: 1, projecting: 1, envisioning: 1,
  scheduling: 1, organizing: 1, arranging: 1, setting: 1, building: 1, developing: 1,
};

// Multi-word phrases that boost specific emotions
const PHRASES: { pattern: RegExp; emotion: Emotion; weight: number }[] = [
  { pattern: /can'?t wait/gi, emotion: 'anticipation', weight: 3 },
  { pattern: /looking forward/gi, emotion: 'anticipation', weight: 2 },
  { pattern: /excited about/gi, emotion: 'anticipation', weight: 2 },
  { pattern: /fed up/gi, emotion: 'anger', weight: 2 },
  { pattern: /sick and tired/gi, emotion: 'anger', weight: 3 },
  { pattern: /over the moon/gi, emotion: 'joy', weight: 3 },
  { pattern: /on top of the world/gi, emotion: 'joy', weight: 3 },
  { pattern: /broke my heart/gi, emotion: 'sadness', weight: 3 },
  { pattern: /heart\s?broken/gi, emotion: 'sadness', weight: 3 },
  { pattern: /scared to death/gi, emotion: 'fear', weight: 3 },
  { pattern: /jaw drop/gi, emotion: 'surprise', weight: 3 },
  { pattern: /mind blown/gi, emotion: 'surprise', weight: 3 },
  { pattern: /makes me sick/gi, emotion: 'disgust', weight: 3 },
  { pattern: /count on/gi, emotion: 'trust', weight: 2 },
  { pattern: /believe in/gi, emotion: 'trust', weight: 2 },
];

const EMOTION_KEYWORDS: Record<Emotion, Record<string, number>> = {
  joy: JOY,
  anger: ANGER,
  sadness: SADNESS,
  fear: FEAR,
  surprise: SURPRISE,
  disgust: DISGUST,
  trust: TRUST,
  anticipation: ANTICIPATION,
};

const NEGATORS = new Set(['not', "n't", 'no', 'never', 'neither', 'nor', 'hardly', 'barely', 'scarcely', 'without', 'lack', 'lacking']);
const INTENSIFIERS: Record<string, number> = {
  very: 1.5, really: 1.5, extremely: 2, incredibly: 2, absolutely: 2, totally: 1.5,
  quite: 1.2, so: 1.3, deeply: 1.5, truly: 1.5, utterly: 2, completely: 1.8,
  profoundly: 2, immensely: 2, terribly: 1.5, awfully: 1.5, super: 1.5, insanely: 2,
};

// Plutchik's compound emotions (adjacent primary dyads)
const COMPOUND_EMOTIONS: { emotions: [Emotion, Emotion]; name: string }[] = [
  { emotions: ['joy', 'trust'], name: 'love' },
  { emotions: ['trust', 'fear'], name: 'submission' },
  { emotions: ['fear', 'surprise'], name: 'awe' },
  { emotions: ['surprise', 'sadness'], name: 'disappointment' },
  { emotions: ['sadness', 'disgust'], name: 'remorse' },
  { emotions: ['disgust', 'anger'], name: 'contempt' },
  { emotions: ['anger', 'anticipation'], name: 'aggressiveness' },
  { emotions: ['anticipation', 'joy'], name: 'optimism' },
];

// Emotion valence mapping: positive emotions > 0, negative < 0
const VALENCE_MAP: Record<Emotion, number> = {
  joy: 1, trust: 0.6, anticipation: 0.4, surprise: 0.2,
  anger: -0.8, sadness: -0.9, fear: -0.7, disgust: -0.8,
};

// Emotion arousal mapping: high-energy > 0.5, low-energy < 0.5
const AROUSAL_MAP: Record<Emotion, number> = {
  anger: 0.9, fear: 0.85, surprise: 0.8, joy: 0.75,
  anticipation: 0.6, disgust: 0.4, trust: 0.3, sadness: 0.2,
};

// Negation targets: when an emotion is negated, which emotion gets partial boost
const NEGATION_REDIRECT: Partial<Record<Emotion, Emotion>> = {
  joy: 'sadness',
  sadness: 'joy',
  trust: 'fear',
  fear: 'trust',
  anger: 'trust',
  disgust: 'trust',
};

export function detectEmotions(text: string): EmotionResult {
  const rawScores: Record<Emotion, number> = {
    joy: 0, anger: 0, sadness: 0, fear: 0,
    surprise: 0, disgust: 0, trust: 0, anticipation: 0,
  };
  let totalWeight = 0;

  // Phase 1: multi-word phrase matching (before tokenization)
  for (const phrase of PHRASES) {
    const matches = text.match(phrase.pattern);
    if (matches) {
      const count = matches.length;
      rawScores[phrase.emotion] += phrase.weight * count;
      totalWeight += phrase.weight * count;
    }
  }

  // Phase 2: single-word scoring with negation + intensifiers
  const words = text.toLowerCase().replace(/[^a-z'\s-]/g, '').split(/\s+/).filter(Boolean);

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    // Check for intensifier
    let multiplier = 1;
    if (i > 0 && INTENSIFIERS[words[i - 1]]) {
      multiplier = INTENSIFIERS[words[i - 1]];
    }

    // Check for negation in previous 3 words
    let negated = false;
    for (let j = Math.max(0, i - 3); j < i; j++) {
      if (NEGATORS.has(words[j]) || words[j].endsWith("n't")) {
        negated = true;
        break;
      }
    }

    // Score against all emotion dictionaries
    for (const emotion of Object.keys(EMOTION_KEYWORDS) as Emotion[]) {
      const weight = EMOTION_KEYWORDS[emotion][word];
      if (!weight) continue;

      if (negated) {
        // Reduce the matched emotion
        rawScores[emotion] -= weight * multiplier * 0.5;
        // Optionally boost the opposite emotion
        const redirect = NEGATION_REDIRECT[emotion];
        if (redirect) {
          rawScores[redirect] += weight * multiplier * 0.3;
          totalWeight += weight * multiplier * 0.3;
        }
      } else {
        rawScores[emotion] += weight * multiplier;
      }
      totalWeight += weight * multiplier;
    }
  }

  // Normalize scores to -1..1 range
  const maxAbsScore = Math.max(1, ...Object.values(rawScores).map(Math.abs));
  const scores = {} as Record<Emotion, number>;
  for (const emotion of Object.keys(rawScores) as Emotion[]) {
    scores[emotion] = Math.round((rawScores[emotion] / maxAbsScore) * 100) / 100;
  }

  // Find primary and secondary emotions
  const sorted = (Object.keys(scores) as Emotion[])
    .filter(e => scores[e] > 0)
    .sort((a, b) => scores[b] - scores[a]);

  const primary: Emotion = sorted[0] ?? 'joy';
  const secondary: Emotion | null = sorted[1] && scores[sorted[1]] > 0.15 ? sorted[1] : null;

  // Detect compound emotion
  let compound: string | null = null;
  if (secondary) {
    for (const c of COMPOUND_EMOTIONS) {
      const [a, b] = c.emotions;
      if ((primary === a && secondary === b) || (primary === b && secondary === a)) {
        compound = c.name;
        break;
      }
    }
  }

  // Calculate confidence based on signal density
  const wordCount = words.length || 1;
  const signalDensity = totalWeight / wordCount;
  const confidence = Math.round(Math.min(signalDensity * 2, 1) * 100) / 100;

  // Calculate valence (positive vs negative overall)
  let valenceSum = 0;
  let valenceWeightSum = 0;
  for (const emotion of Object.keys(scores) as Emotion[]) {
    if (scores[emotion] > 0) {
      valenceSum += VALENCE_MAP[emotion] * scores[emotion];
      valenceWeightSum += scores[emotion];
    }
  }
  const valence = valenceWeightSum > 0
    ? Math.round((valenceSum / valenceWeightSum) * 100) / 100
    : 0;

  // Calculate arousal (energy level)
  let arousalSum = 0;
  let arousalWeightSum = 0;
  for (const emotion of Object.keys(scores) as Emotion[]) {
    if (scores[emotion] > 0) {
      arousalSum += AROUSAL_MAP[emotion] * scores[emotion];
      arousalWeightSum += scores[emotion];
    }
  }
  const arousal = arousalWeightSum > 0
    ? Math.round((arousalSum / arousalWeightSum) * 100) / 100
    : 0;

  return { primary, secondary, compound, scores, confidence, valence, arousal };
}
