/**
 * Formality classifier heuristic — LLM-generated, deterministic, no model needed.
 * This code was evolved through the FunSearch-style loop:
 * feed examples -> LLM writes code -> eval -> improve -> repeat.
 *
 * v1: weighted keyword scoring + structural analysis across 4 formality levels
 * Trained on 700 text examples, 84% accuracy.
 */

export type Formality = 'formal' | 'neutral' | 'casual' | 'slang';

export interface FormalityResult {
  formality: Formality;
  confidence: number;
  scores: Record<Formality, number>;
  signals: string[];
  register: number; // -1 (very informal) to +1 (very formal)
}

// --- Formal signals ---

const FORMAL_WORDS: Record<string, number> = {
  therefore: 2, furthermore: 2, consequently: 2, nevertheless: 2,
  accordingly: 2, hereby: 3, pursuant: 3, henceforth: 3,
  moreover: 2, notwithstanding: 3, regarding: 2, pertaining: 2,
  aforementioned: 3, undersigned: 3, sincerely: 2, respectfully: 2,
  kindly: 1, whereas: 3, whereby: 3, herein: 3, therein: 3,
  thereof: 3, herewith: 3, forthwith: 3, inasmuch: 3,
  shall: 2, endeavor: 2, endeavour: 2, ascertain: 2, procure: 2,
  constitute: 2, facilitate: 2, implement: 1, utilize: 2,
  commence: 2, terminate: 2, substantiate: 2, corroborate: 2,
  delineate: 2, elucidate: 2, enumerate: 2, stipulate: 2,
  acknowledge: 1, apprise: 2, deliberate: 2, deem: 2,
  subsequent: 2, preceding: 2, preliminary: 2, comprehensive: 1,
  correspondence: 2, addendum: 3, amendment: 2, provision: 2,
  requisite: 2, obligatory: 2, mandatory: 1, compliance: 2,
  jurisdiction: 3, legislation: 2, regulation: 2,
  distinguished: 2, esteemed: 2, honorable: 2, eminent: 2,
};

const FORMAL_PHRASES: [string, number][] = [
  ['i would like to', 2], ['please be advised', 3], ['for your consideration', 3],
  ['i am writing to', 3], ['with reference to', 3], ['with regard to', 2],
  ['it has come to my attention', 3], ['we regret to inform', 3],
  ['please find attached', 3], ['please find enclosed', 3],
  ['i wish to inform', 3], ['in accordance with', 3], ['in compliance with', 3],
  ['to whom it may concern', 3], ['dear sir or madam', 3], ['dear sir', 2],
  ['dear madam', 2], ['yours faithfully', 3], ['yours sincerely', 3],
  ['best regards', 2], ['kind regards', 2], ['warm regards', 2],
  ['i would appreciate', 2], ['we would appreciate', 2],
  ['at your earliest convenience', 3], ['upon receipt', 2],
  ['as per our', 2], ['as discussed', 1], ['as mentioned', 1],
  ['for your information', 2], ['for your records', 2],
  ['we hereby', 3], ['it is imperative', 3], ['it is essential', 2],
  ['we are pleased to', 2], ['i am pleased to', 2],
  ['would you be so kind', 3], ['i respectfully', 3],
  ['permit me to', 2], ['i trust that', 2], ['be assured that', 2],
  ['rest assured', 2], ['in the interest of', 2], ['in light of', 2],
  ['in view of', 2], ['on behalf of', 2], ['with respect to', 2],
  ['taking into consideration', 2], ['in due course', 2],
];

// --- Casual signals ---

const CASUAL_WORDS: Record<string, number> = {
  yeah: 2, gonna: 2, wanna: 2, gotta: 2, kinda: 2, sorta: 2,
  basically: 1, literally: 1, actually: 1, honestly: 1, anyway: 1,
  stuff: 1, thing: 1, things: 1, cool: 1, awesome: 1, great: 1,
  ok: 1, okay: 1, yep: 2, nope: 2, nah: 2, yup: 2,
  hey: 1, hi: 1, sup: 2, haha: 2, lol: 1, hehe: 2,
  pretty: 1, really: 1, super: 1, totally: 1, definitely: 1,
  oops: 1, whoops: 1, hmm: 1, umm: 1, uhh: 1, dunno: 2,
  lemme: 2, gimme: 2, gotcha: 2, aint: 2,
  thanks: 1, thx: 2, thanx: 2, ty: 2, np: 2,
  dude: 2, buddy: 1, man: 1, guys: 1, folks: 1,
  btw: 2, fyi: 1, imo: 1, imho: 1, afaik: 2, asap: 1,
  cuz: 2, cause: 1, tho: 2, tho: 2, tru: 2,
};

const CASUAL_PHRASES: [string, number][] = [
  ['you know', 1], ['i mean', 1], ['kind of', 1], ['sort of', 1],
  ['no worries', 2], ['no prob', 2], ['no problem', 1], ['all good', 2],
  ['my bad', 2], ['hang on', 1], ['hold on', 1], ['wait up', 1],
  ['check this out', 1], ['by the way', 1], ['just saying', 2],
  ['for real', 1], ['i guess', 1], ['i dunno', 2], ["i don't know", 1],
  ['what the heck', 2], ['oh well', 1], ['so yeah', 2],
  ['anyways', 2], ['anywho', 2], ['long story short', 1],
  ['bottom line', 1], ['at the end of the day', 1],
  ['the thing is', 1], ['here is the deal', 1], ["here's the deal", 1],
  ['to be honest', 1], ['tbh', 2], ['not gonna lie', 2],
  ['catch you later', 2], ['talk later', 1], ['hit me up', 2],
  ['let me know', 1], ['sounds good', 1], ['works for me', 1],
  ['see ya', 2], ['later', 1], ['peace out', 2],
];

// --- Contractions (casual marker) ---

const CONTRACTIONS: string[] = [
  "don't", "can't", "won't", "shouldn't", "wouldn't", "couldn't", "isn't",
  "aren't", "wasn't", "weren't", "hasn't", "haven't", "hadn't",
  "doesn't", "didn't", "mustn't", "needn't",
  "i'm", "i've", "i'll", "i'd",
  "he's", "she's", "it's", "that's", "who's", "there's", "here's",
  "they're", "we're", "you're",
  "they've", "we've", "you've",
  "they'll", "we'll", "you'll", "he'll", "she'll",
  "they'd", "we'd", "you'd", "he'd", "she'd",
  "what's", "where's", "when's", "how's", "why's",
  "let's", "ain't",
];

// --- Slang signals ---

const SLANG_WORDS: Record<string, number> = {
  lol: 3, lmao: 3, bruh: 3, fam: 3, lowkey: 3, highkey: 3,
  slay: 3, vibe: 2, vibes: 2, sus: 3, bussin: 3, lit: 3,
  ngl: 3, imo: 2, tbh: 2, smh: 3, fr: 3, ong: 3,
  bet: 3, cap: 3, goat: 2, fire: 2, slaps: 3,
  yeet: 3, skibidi: 3, rizz: 3, sigma: 3, based: 2,
  cringe: 2, copium: 3, ratio: 2, mid: 2, valid: 1,
  deadass: 3, boutta: 3, finna: 3, ight: 3, aight: 3,
  bro: 2, sis: 2, bestie: 2, girly: 2, homie: 2,
  periodt: 3, slayyy: 3, ikr: 3, idk: 2, omw: 2,
  rn: 3, wya: 3, wyd: 3, hmu: 3, lmk: 2,
  pls: 2, plz: 2, thx: 2, ty: 2, yw: 2,
  fomo: 2, yolo: 3, goated: 3, sheesh: 3, drip: 3,
  salty: 2, savage: 2, flex: 2, stan: 2, simp: 2,
  clout: 2, clutch: 2, bougie: 2, basic: 1, extra: 1,
  sus: 3, tea: 2, shade: 2, receipts: 1, woke: 2,
  ghosted: 2, catfish: 2, troll: 1, clap: 1,
};

const SLANG_PHRASES: [string, number][] = [
  ['no cap', 3], ['on god', 3], ['for real for real', 3],
  ['i am dead', 2], ["i'm dead", 2], ['it hits different', 3],
  ['hits different', 3], ['living rent free', 3], ['rent free', 2],
  ['main character', 2], ['caught in 4k', 3], ['touch grass', 3],
  ['its giving', 3], ["it's giving", 3], ['that aint it', 3],
  ["that ain't it", 3], ['understood the assignment', 3],
  ['did not pass the vibe check', 3], ['vibe check', 2],
  ['big yikes', 3], ['big mood', 3], ['whole mood', 3],
  ['say less', 3], ['we move', 2], ['keep it a hundred', 3],
  ['keep it 100', 3], ['real talk', 2], ['facts tho', 3],
  ['straight up', 2], ['on my mama', 3], ['on everything', 2],
  ['no shot', 2], ['not even close', 1], ['built different', 3],
];

// --- Abbreviation substitutions (texting style) ---

const TEXT_ABBREVIATIONS: Record<string, number> = {
  u: 2, ur: 2, r: 2, b4: 3, '2': 0, '4': 0, // 2/4 need context
  w: 1, bc: 2, ppl: 2, msg: 2, txt: 2, pic: 1,
  thru: 2, tho: 2, cuz: 2, prolly: 2, probs: 2,
  rn: 2, tmr: 2, tmrw: 2, tn: 2, '2nite': 3,
};

// --- Passive voice markers (formal indicator) ---

const PASSIVE_MARKERS: [string, number][] = [
  ['was done', 1], ['has been', 1], ['have been', 1], ['had been', 1],
  ['will be', 1], ['shall be', 1], ['is being', 1], ['are being', 1],
  ['was being', 1], ['were being', 1], ['been done', 1], ['been made', 1],
  ['been given', 1], ['been taken', 1], ['been provided', 1],
  ['is required', 1], ['are required', 1], ['is expected', 1],
  ['is recommended', 1], ['is considered', 1], ['is requested', 1],
  ['is noted', 1], ['is understood', 1], ['is acknowledged', 1],
];

// --- Main classifier ---

function matchWords(text: string, dict: Record<string, number>, prefix: string): { score: number; signals: string[] } {
  const words = text.toLowerCase().replace(/[^a-z0-9'\s-]/g, '').split(/\s+/).filter(Boolean);
  let score = 0;
  const signals: string[] = [];
  const seen = new Set<string>();
  for (const word of words) {
    if (dict[word] && !seen.has(word)) {
      score += dict[word];
      signals.push(`${prefix}:${word}`);
      seen.add(word);
    }
  }
  return { score, signals };
}

function matchPhrases(text: string, phrases: [string, number][], prefix: string): { score: number; signals: string[] } {
  const lower = text.toLowerCase();
  let score = 0;
  const signals: string[] = [];
  for (const [phrase, weight] of phrases) {
    if (lower.includes(phrase)) {
      score += weight;
      signals.push(`${prefix}:"${phrase}"`);
    }
  }
  return { score, signals };
}

function scoreStructural(text: string): { scores: Record<Formality, number>; signals: string[] } {
  const scores: Record<Formality, number> = { formal: 0, neutral: 0, casual: 0, slang: 0 };
  const signals: string[] = [];
  const lower = text.toLowerCase();

  // Sentence length (formal texts tend to have longer sentences)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(Boolean);
  const avgSentenceLength = sentences.length > 0 ? words.length / sentences.length : words.length;

  if (avgSentenceLength > 20) {
    scores.formal += 2;
    signals.push('struct:long-sentences');
  } else if (avgSentenceLength < 6) {
    scores.casual += 1;
    signals.push('struct:short-sentences');
  }

  // Contractions (casual/slang)
  let contractionCount = 0;
  for (const c of CONTRACTIONS) {
    if (lower.includes(c)) contractionCount++;
  }
  if (contractionCount >= 3) {
    scores.casual += 2;
    signals.push(`struct:${contractionCount}-contractions`);
  } else if (contractionCount > 0) {
    scores.casual += 1;
    signals.push(`struct:${contractionCount}-contractions`);
  }

  // Absence of contractions in longer text = formal
  if (contractionCount === 0 && words.length > 15) {
    // Check for expanded forms that suggest deliberate formality
    const expandedForms = ['do not', 'can not', 'cannot', 'will not', 'shall not', 'would not',
      'could not', 'should not', 'is not', 'are not', 'was not', 'were not',
      'has not', 'have not', 'had not', 'does not', 'did not', 'must not'];
    let expandedCount = 0;
    for (const form of expandedForms) {
      if (lower.includes(form)) expandedCount++;
    }
    if (expandedCount > 0) {
      scores.formal += expandedCount;
      signals.push(`struct:${expandedCount}-expanded-forms`);
    }
  }

  // Exclamation marks
  const exclCount = (text.match(/!/g) || []).length;
  if (exclCount === 0 && words.length > 10) {
    scores.formal += 1;
    signals.push('struct:no-exclamations');
  } else if (exclCount >= 3) {
    scores.casual += 1;
    scores.slang += 1;
    signals.push(`struct:${exclCount}-exclamations`);
  }

  // All lowercase (slang/casual indicator)
  if (text === lower && words.length > 3 && !/[.!?]$/.test(text.trim())) {
    scores.slang += 2;
    signals.push('struct:all-lowercase');
  }

  // No punctuation at end
  if (words.length > 3 && !/[.!?,;:]$/.test(text.trim())) {
    scores.casual += 1;
    signals.push('struct:no-end-punctuation');
  }

  // Proper punctuation (periods, commas, semicolons used correctly)
  const commaCount = (text.match(/,/g) || []).length;
  const semicolonCount = (text.match(/;/g) || []).length;
  const periodCount = (text.match(/\./g) || []).length;
  if (semicolonCount > 0) {
    scores.formal += 1;
    signals.push('struct:semicolons');
  }
  if (commaCount >= 3 && words.length > 15) {
    scores.formal += 1;
    signals.push('struct:proper-comma-usage');
  }
  if (periodCount >= 2 && sentences.length >= 2) {
    scores.formal += 1;
    signals.push('struct:multi-sentence-periods');
  }

  // Passive voice
  const pv = matchPhrases(text, PASSIVE_MARKERS, 'passive');
  if (pv.score > 0) {
    scores.formal += pv.score;
    signals.push(...pv.signals);
  }

  // Text abbreviations (slang indicator)
  const ta = matchWords(text, TEXT_ABBREVIATIONS, 'abbrev');
  if (ta.score > 0) {
    scores.slang += ta.score;
    signals.push(...ta.signals);
  }

  // Very short text (< 5 words) → lean casual
  if (words.length <= 4) {
    scores.casual += 1;
    signals.push('struct:very-short');
  }

  return { scores, signals };
}

export function detectFormality(text: string): FormalityResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      formality: 'neutral',
      confidence: 0,
      scores: { formal: 0, neutral: 0, casual: 0, slang: 0 },
      signals: [],
      register: 0,
    };
  }

  const rawScores: Record<Formality, number> = { formal: 0, neutral: 0, casual: 0, slang: 0 };
  const allSignals: string[] = [];

  // Formal
  const fow = matchWords(trimmed, FORMAL_WORDS, 'formal');
  rawScores.formal += fow.score;
  allSignals.push(...fow.signals);
  const fop = matchPhrases(trimmed, FORMAL_PHRASES, 'formal');
  rawScores.formal += fop.score;
  allSignals.push(...fop.signals);

  // Casual
  const caw = matchWords(trimmed, CASUAL_WORDS, 'casual');
  rawScores.casual += caw.score;
  allSignals.push(...caw.signals);
  const cap = matchPhrases(trimmed, CASUAL_PHRASES, 'casual');
  rawScores.casual += cap.score;
  allSignals.push(...cap.signals);

  // Slang
  const slw = matchWords(trimmed, SLANG_WORDS, 'slang');
  rawScores.slang += slw.score;
  allSignals.push(...slw.signals);
  const slp = matchPhrases(trimmed, SLANG_PHRASES, 'slang');
  rawScores.slang += slp.score;
  allSignals.push(...slp.signals);

  // Structural
  const structural = scoreStructural(trimmed);
  for (const level of ['formal', 'neutral', 'casual', 'slang'] as Formality[]) {
    rawScores[level] += structural.scores[level];
  }
  allSignals.push(...structural.signals);

  // Neutral is the default baseline
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  rawScores.neutral = Math.min(wordCount * 0.2, 3);
  const totalOther = rawScores.formal + rawScores.casual + rawScores.slang;
  if (totalOther < 2) {
    rawScores.neutral += 4;
    allSignals.push('struct:no-strong-signals');
  }

  // --- Normalize ---
  const levels: Formality[] = ['formal', 'neutral', 'casual', 'slang'];
  const total = Object.values(rawScores).reduce((a, b) => a + b, 0);

  const scores: Record<Formality, number> = { formal: 0, neutral: 0, casual: 0, slang: 0 };
  if (total > 0) {
    for (const level of levels) {
      scores[level] = Math.round((rawScores[level] / total) * 100) / 100;
    }
  }

  let bestLevel: Formality = 'neutral';
  let bestScore = -1;
  let secondScore = -1;
  for (const level of levels) {
    if (scores[level] > bestScore) {
      secondScore = bestScore;
      bestScore = scores[level];
      bestLevel = level;
    } else if (scores[level] > secondScore) {
      secondScore = scores[level];
    }
  }

  const separation = bestScore - Math.max(0, secondScore);
  const signalStrength = Math.min(total / 10, 1);
  const confidence = Math.round(Math.min(1, separation + signalStrength * 0.3) * 100) / 100;

  // Compute register: continuous -1 (very informal) to +1 (very formal)
  // formal pushes positive, slang pushes most negative, casual negative, neutral center
  const formalWeight = rawScores.formal;
  const informalWeight = rawScores.casual + rawScores.slang * 1.5;
  const registerTotal = formalWeight + informalWeight;
  let register = 0;
  if (registerTotal > 0) {
    register = (formalWeight - informalWeight) / registerTotal;
  }
  register = Math.round(register * 100) / 100;

  return { formality: bestLevel, confidence, scores, signals: allSignals, register };
}
