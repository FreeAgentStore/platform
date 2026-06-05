/**
 * Feedback classifier — LLM-generated, deterministic, no model needed.
 * This code was evolved through the FunSearch-style loop:
 * feed examples -> LLM writes code -> eval -> improve -> repeat.
 *
 * v1: weighted keyword scoring + phrase matching + structural detection
 */

export type FeedbackType = 'bug' | 'feature' | 'complaint' | 'praise' | 'question' | 'suggestion';

export interface FeedbackResult {
  type: FeedbackType;
  confidence: number;
  scores: Record<FeedbackType, number>;
  signals: string[];
  actionable: boolean;
}

const BUG_WORDS: Record<string, number> = {
  bug: 3, error: 3, crash: 3, broken: 3, fix: 2, issue: 2, problem: 2,
  failed: 2, glitch: 2, regression: 2, reproduce: 2, steps: 1, freeze: 2,
  hang: 2, unresponsive: 2, corrupted: 3, malfunction: 3, defect: 3,
  exception: 3, undefined: 2, null: 2, timeout: 2, overflow: 2,
  segfault: 3, panic: 3, stacktrace: 3, traceback: 3, debug: 1,
  breakage: 2, misaligned: 1, truncated: 1, garbled: 2, flickering: 1,
  rendering: 1, inconsistent: 1, unexpected: 2, incorrect: 2, wrong: 2,
  invalid: 2, missing: 1, blank: 1, empty: 1, duplicate: 1,
  loop: 1, infinite: 2, stuck: 2, stale: 1, outdated: 1,
  memory: 1, leak: 2, lag: 1, slow: 1, degraded: 1,
  404: 2, 500: 2, 403: 2, fatal: 3, critical: 2,
};

const BUG_PHRASES: [string, number][] = [
  ["doesn't work", 3], ["does not work", 3], ["not working", 3],
  ["stopped working", 3], ["used to work", 3], ["no longer works", 3],
  ["expected behavior", 2], ["actual behavior", 2], ["steps to reproduce", 3],
  ["stack trace", 3], ["error message", 3], ["after update", 2],
  ["after updating", 2], ["since the update", 2], ["broke after", 3],
  ["can't open", 2], ["cannot open", 2], ["fails to load", 2],
  ["fails to", 2], ["won't load", 2], ["will not load", 2],
  ["keeps crashing", 3], ["crashes every", 3], ["white screen", 2],
  ["black screen", 2], ["blue screen", 3], ["screen of death", 3],
  ["throws an error", 3], ["getting an error", 3], ["error when", 2],
  ["bug report", 3], ["found a bug", 3], ["there is a bug", 3],
];

const FEATURE_WORDS: Record<string, number> = {
  feature: 3, request: 2, add: 2, support: 2, implement: 2, integrate: 2,
  option: 1, setting: 1, ability: 2, capability: 2, functionality: 2,
  enhancement: 3, improvement: 2, roadmap: 2, backlog: 1, wishlist: 2,
  plugin: 2, extension: 2, integration: 2, compatibility: 1, interop: 1,
  customization: 2, configuration: 1, toggle: 1, preference: 1, theme: 1,
  export: 1, import: 1, sync: 1, notification: 1, alert: 1,
  dashboard: 1, widget: 1, shortcut: 1, hotkey: 1, keyboard: 1,
  api: 1, webhook: 1, automation: 2, workflow: 1, template: 1,
  filter: 1, search: 1, sort: 1, batch: 1, bulk: 1,
  dark: 1, mode: 1, multilingual: 2, localization: 2, i18n: 2,
  accessibility: 2, a11y: 2, responsive: 1, mobile: 1,
};

const FEATURE_PHRASES: [string, number][] = [
  ["it would be nice if", 3], ["it would be great if", 3],
  ["can you add", 3], ["could you add", 3], ["please add", 3],
  ["i wish", 2], ["would love to see", 3], ["would love to have", 3],
  ["feature request", 3], ["please consider", 2], ["how about adding", 3],
  ["any plans to", 2], ["any plans for", 2], ["are you planning", 2],
  ["will you add", 2], ["do you plan", 2], ["on the roadmap", 2],
  ["would be useful", 2], ["would be helpful", 2], ["would be great", 2],
  ["would be nice", 2], ["would be awesome", 2], ["need support for", 2],
  ["needs support for", 2], ["should support", 2], ["should have", 1],
  ["should include", 1], ["want to be able to", 2], ["i need", 1],
  ["we need", 1], ["looking for a way to", 2], ["is there a way to", 2],
  ["ability to", 2], ["option to", 1],
];

const COMPLAINT_WORDS: Record<string, number> = {
  terrible: 3, worst: 3, horrible: 3, unacceptable: 3, disappointed: 3,
  frustrating: 2, annoying: 2, waste: 2, overpriced: 2, useless: 2,
  awful: 3, ridiculous: 2, pathetic: 3, atrocious: 3, abysmal: 3,
  infuriating: 3, outrageous: 3, disgraceful: 3, shameful: 2,
  appalling: 3, deplorable: 3, inexcusable: 3, intolerable: 3,
  garbage: 3, trash: 3, junk: 2, scam: 3, ripoff: 3,
  nightmare: 2, disaster: 2, catastrophe: 3, fiasco: 2,
  regret: 2, furious: 3, angry: 2, upset: 2, unhappy: 2,
  dissatisfied: 2, displeased: 2, aggravated: 2, livid: 3,
  hate: 3, detest: 3, despise: 3, loathe: 3,
  incompetent: 3, unprofessional: 2, careless: 2, negligent: 2,
  misleading: 2, deceptive: 2, dishonest: 2, false: 1,
  downgrade: 2, deteriorated: 2, worsened: 2, ruined: 3,
};

const COMPLAINT_PHRASES: [string, number][] = [
  ["cancel my subscription", 3], ["want a refund", 3], ["demand a refund", 3],
  ["never using again", 3], ["switching to", 2], ["moved to", 2],
  ["you should be ashamed", 3], ["waste of money", 3], ["waste of time", 3],
  ["complete waste", 3], ["total waste", 3], ["utter waste", 3],
  ["worst experience", 3], ["worst ever", 3], ["worst i've", 3],
  ["lost my data", 3], ["lost all my", 3], ["deleted my", 2],
  ["i'm done", 2], ["fed up", 2], ["sick and tired", 3],
  ["had enough", 2], ["last straw", 3], ["final straw", 3],
  ["never again", 3], ["do not buy", 3], ["don't buy", 3],
  ["stay away", 3], ["avoid this", 3], ["do not recommend", 3],
  ["don't recommend", 3], ["zero stars", 3], ["one star", 2],
  ["would give zero", 3], ["negative stars", 3],
];

const PRAISE_WORDS: Record<string, number> = {
  amazing: 3, excellent: 3, love: 3, great: 3, fantastic: 3, awesome: 3,
  wonderful: 3, perfect: 3, best: 3, impressed: 2, thank: 2, brilliant: 2,
  outstanding: 3, superb: 3, magnificent: 3, exceptional: 3, phenomenal: 3,
  remarkable: 2, incredible: 3, marvelous: 3, splendid: 2, stellar: 3,
  flawless: 3, impeccable: 3, elegant: 2, gorgeous: 2, beautiful: 2,
  intuitive: 2, seamless: 2, smooth: 2, polished: 2, refined: 2,
  delightful: 2, enjoyable: 2, pleasant: 2, satisfying: 2, rewarding: 2,
  grateful: 2, thankful: 2, appreciate: 2, kudos: 3, bravo: 3,
  game: 1, changer: 1, lifesaver: 3, godsend: 3, blessing: 2,
  reliable: 2, dependable: 2, trustworthy: 2, solid: 1, robust: 1,
  responsive: 1, fast: 1, efficient: 1, powerful: 2, versatile: 1,
  innovative: 2, clever: 2, genius: 3, masterpiece: 3,
};

const PRAISE_PHRASES: [string, number][] = [
  ["keep up the good work", 3], ["keep it up", 2],
  ["love this product", 3], ["love this app", 3], ["love this tool", 3],
  ["exactly what i needed", 3], ["just what i needed", 3],
  ["saved my life", 3], ["saved me hours", 3], ["saved me so much", 3],
  ["highly recommend", 3], ["strongly recommend", 3],
  ["five stars", 3], ["5 stars", 3], ["10 out of 10", 3],
  ["can't live without", 3], ["couldn't live without", 3],
  ["blown away", 3], ["pleasantly surprised", 2],
  ["exceeded expectations", 3], ["above and beyond", 3],
  ["well done", 2], ["good job", 2], ["nice work", 2], ["great work", 3],
  ["thank you so much", 3], ["thanks so much", 3], ["much appreciated", 2],
  ["best app", 3], ["best tool", 3], ["best software", 3],
  ["changed my life", 3], ["game changer", 3],
  ["works perfectly", 3], ["works great", 3], ["works beautifully", 3],
  ["so glad i found", 3], ["glad i switched", 2],
];

const QUESTION_WORDS = new Set([
  'how', 'what', 'when', 'where', 'why', 'which', 'who', 'whom',
  'whose', 'does', 'do', 'is', 'are', 'was', 'were', 'will', 'would',
  'could', 'should', 'can', 'may', 'might', 'has', 'have', 'had',
]);

const QUESTION_PHRASES: [string, number][] = [
  ["how do i", 3], ["how can i", 3], ["how to", 3],
  ["is it possible", 2], ["is there a way", 2], ["can i", 2],
  ["where can i", 2], ["where do i", 2], ["where is", 2],
  ["what is the", 2], ["what does", 2], ["what are", 2],
  ["when will", 2], ["when does", 2], ["when is", 2],
  ["why does", 2], ["why is", 2], ["why can't", 2],
  ["does it", 2], ["does this", 2], ["do you", 2],
  ["anyone know", 2], ["does anyone", 2], ["has anyone", 2],
  ["i'm wondering", 2], ["i was wondering", 2], ["just wondering", 2],
  ["quick question", 3], ["i have a question", 3],
  ["could someone explain", 2], ["can someone help", 2],
  ["need help with", 2], ["help me", 1],
];

const SUGGESTION_WORDS: Record<string, number> = {
  suggest: 2, recommend: 2, consider: 2, improve: 2, better: 1,
  alternative: 1, instead: 1, perhaps: 1, maybe: 1, possibly: 1,
  tweak: 1, adjust: 1, refine: 1, optimize: 1, enhance: 2,
  rethink: 2, revisit: 1, rework: 2, reconsider: 2, revise: 1,
  streamline: 2, simplify: 2, consolidate: 1, reorganize: 1,
  proposal: 2, idea: 2, thought: 1, approach: 1,
  tip: 1, hint: 1, advice: 1, feedback: 1,
  might: 1, could: 1, should: 1, try: 1,
  pros: 1, cons: 1, tradeoff: 1,
};

const SUGGESTION_PHRASES: [string, number][] = [
  ["have you considered", 2], ["have you thought about", 2],
  ["what if", 2], ["what about", 2], ["how about", 2],
  ["might be better to", 2], ["would be better to", 2],
  ["one suggestion", 3], ["a suggestion", 3], ["my suggestion", 3],
  ["a thought", 2], ["one thought", 2], ["just a thought", 2],
  ["i'd suggest", 3], ["i would suggest", 3], ["may i suggest", 3],
  ["you might want to", 2], ["you could try", 2], ["you should try", 2],
  ["it might help to", 2], ["it would help to", 2],
  ["a better approach", 2], ["a different approach", 2],
  ["in my experience", 1], ["from my experience", 1],
  ["pro tip", 2], ["quick tip", 2], ["here's a tip", 2],
  ["instead of", 1], ["rather than", 1], ["alternatively", 2],
  ["consider using", 2], ["try using", 1],
];

const ACTIONABLE_TYPES: Set<FeedbackType> = new Set(['bug', 'feature', 'suggestion']);

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').split(/\s+/).filter(Boolean);
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

function scoreWords(words: string[], dict: Record<string, number>): { score: number; matched: string[] } {
  let score = 0;
  const matched: string[] = [];
  const seen = new Set<string>();
  for (const w of words) {
    if (dict[w] && !seen.has(w)) {
      score += dict[w];
      matched.push(w);
      seen.add(w);
    }
  }
  return { score, matched };
}

export function classifyFeedback(text: string): FeedbackResult {
  const lower = text.toLowerCase();
  const words = tokenize(text);

  // Score each category
  const bugW = scoreWords(words, BUG_WORDS);
  const bugP = matchPhrases(lower, BUG_PHRASES);
  // Structural: code blocks, version numbers, stack traces, error codes
  let bugStructural = 0;
  const bugStructuralSignals: string[] = [];
  if (/```/.test(text)) { bugStructural += 2; bugStructuralSignals.push('code block'); }
  if (/v?\d+\.\d+\.\d+/.test(text)) { bugStructural += 1; bugStructuralSignals.push('version number'); }
  if (/at\s+\w+\s*\(.*:\d+:\d+\)/.test(text)) { bugStructural += 3; bugStructuralSignals.push('stack trace'); }
  if (/\b(ERR_|E_|ERROR_)\w+/.test(text)) { bugStructural += 2; bugStructuralSignals.push('error code'); }
  if (/\b[A-Z][a-zA-Z]*Error\b/.test(text)) { bugStructural += 2; bugStructuralSignals.push('error class'); }

  const featureW = scoreWords(words, FEATURE_WORDS);
  const featureP = matchPhrases(lower, FEATURE_PHRASES);

  const complaintW = scoreWords(words, COMPLAINT_WORDS);
  const complaintP = matchPhrases(lower, COMPLAINT_PHRASES);

  const praiseW = scoreWords(words, PRAISE_WORDS);
  const praiseP = matchPhrases(lower, PRAISE_PHRASES);

  const suggestionW = scoreWords(words, SUGGESTION_WORDS);
  const suggestionP = matchPhrases(lower, SUGGESTION_PHRASES);

  // Question scoring
  let questionScore = 0;
  const questionSignals: string[] = [];
  const questionP = matchPhrases(lower, QUESTION_PHRASES);
  questionScore += questionP.score;
  questionSignals.push(...questionP.matched);
  // Question marks
  const qCount = (text.match(/\?/g) || []).length;
  if (qCount > 0) { questionScore += qCount * 2; questionSignals.push('question mark'); }
  // Starts with question word
  if (words.length > 0 && QUESTION_WORDS.has(words[0])) {
    questionScore += 2;
    questionSignals.push(`starts with "${words[0]}"`);
  }

  const scores: Record<FeedbackType, number> = {
    bug: bugW.score + bugP.score + bugStructural,
    feature: featureW.score + featureP.score,
    complaint: complaintW.score + complaintP.score,
    praise: praiseW.score + praiseP.score,
    question: questionScore,
    suggestion: suggestionW.score + suggestionP.score,
  };

  // Find winner
  let maxType: FeedbackType = 'question';
  let maxScore = -1;
  for (const [type, score] of Object.entries(scores) as [FeedbackType, number][]) {
    if (score > maxScore) {
      maxScore = score;
      maxType = type;
    }
  }

  // Build signals for the winner
  const signalMap: Record<FeedbackType, string[]> = {
    bug: [...bugW.matched, ...bugP.matched, ...bugStructuralSignals],
    feature: [...featureW.matched, ...featureP.matched],
    complaint: [...complaintW.matched, ...complaintP.matched],
    praise: [...praiseW.matched, ...praiseP.matched],
    question: questionSignals,
    suggestion: [...suggestionW.matched, ...suggestionP.matched],
  };

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = totalScore > 0
    ? Math.min(maxScore / Math.max(totalScore, 1), 1)
    : 0;

  // Normalize scores to 0-1 range
  const normalizedScores = {} as Record<FeedbackType, number>;
  for (const [type, score] of Object.entries(scores) as [FeedbackType, number][]) {
    normalizedScores[type] = totalScore > 0 ? Math.round((score / totalScore) * 100) / 100 : 0;
  }

  return {
    type: maxType,
    confidence: Math.round(confidence * 100) / 100,
    scores: normalizedScores,
    signals: signalMap[maxType],
    actionable: ACTIONABLE_TYPES.has(maxType),
  };
}
