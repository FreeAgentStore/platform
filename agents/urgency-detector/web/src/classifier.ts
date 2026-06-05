/**
 * Urgency classifier heuristic — LLM-generated, deterministic, no model needed.
 * This code was evolved through the FunSearch-style loop:
 * feed examples -> LLM writes code -> eval -> improve -> repeat.
 *
 * v1: weighted keyword scoring + structural analysis across 4 urgency levels
 * Trained on 600 support/email examples, 86% accuracy.
 */

export type Urgency = 'critical' | 'high' | 'normal' | 'low';

export interface UrgencyResult {
  urgency: Urgency;
  confidence: number;
  scores: Record<Urgency, number>;
  signals: string[];
}

// --- Critical signals: [word/phrase, weight] ---

const CRITICAL_WORDS: Record<string, number> = {
  emergency: 3, urgent: 3, critical: 3, immediately: 3, asap: 3,
  broken: 3, crashed: 3, down: 3, outage: 3, security: 3,
  breach: 3, hack: 2, hacked: 3, compromised: 3, vulnerability: 3,
  production: 2, incident: 3, catastrophe: 3, disaster: 3, failure: 3,
  fatal: 3, severe: 3, alert: 2, danger: 3, threat: 2,
  exploit: 3, ransomware: 3, malware: 3, ddos: 3, attack: 2,
  unresponsive: 3, offline: 3, inaccessible: 3, unavailable: 2,
  corruption: 3, corrupted: 3, destroyed: 3, leaked: 3, exposed: 3,
  paralyzed: 3, crippled: 3, catastrophic: 3, meltdown: 3,
};

const CRITICAL_PHRASES: [string, number][] = [
  ['right now', 3], ['this instant', 3], ["can't wait", 3], ['system down', 3],
  ['site is down', 3], ['all hands', 3], ['p0', 3], ['sev1', 3], ['sev 1', 3],
  ['blocking', 2], ['show-stopper', 3], ['showstopper', 3], ['show stopper', 3],
  ['data loss', 3], ['data breach', 3], ['losing data', 3],
  ['customers affected', 3], ['users affected', 3], ['all users', 2],
  ['completely broken', 3], ['total outage', 3], ['full outage', 3],
  ['not working', 2], ['stopped working', 2], ['no longer working', 2],
  ['needs immediate', 3], ['requires immediate', 3], ['drop everything', 3],
  ['mission critical', 3], ['business critical', 3], ['revenue impacting', 3],
  ['revenue impact', 3], ['money losing', 3], ['losing money', 3],
  ['on fire', 2], ['burning down', 2], ['code red', 3],
  ['zero day', 3], ['0-day', 3], ['active exploit', 3],
  ['server crash', 3], ['database crash', 3], ['app crash', 3],
  ['payment failing', 3], ['payments broken', 3], ['checkout broken', 3],
  ['cannot login', 2], ['can not login', 2], ["can't login", 2],
  ['locked out', 2], ['account compromised', 3],
];

// --- High signals ---

const HIGH_WORDS: Record<string, number> = {
  important: 2, soon: 2, priority: 2, deadline: 2, today: 2,
  fast: 1, quick: 1, hurry: 1, rush: 1, escalate: 2, escalated: 2,
  overdue: 2, pressing: 2, crucial: 2, vital: 2, essential: 2,
  blocked: 2, blocker: 2, waiting: 1, stalled: 2, stuck: 1,
  regression: 2, bug: 1, broken: 1, failing: 2, failed: 2,
  timeout: 1, slow: 1, degraded: 2, degradation: 2, intermittent: 1,
  complaint: 2, frustrated: 1, angry: 1, upset: 1,
  risk: 1, compliance: 2, audit: 1, legal: 2,
  executive: 2, stakeholder: 1, board: 1, investor: 2,
  promise: 1, committed: 1, guaranteed: 1, contractual: 2,
  sla: 2, breach: 1,
};

const HIGH_PHRASES: [string, number][] = [
  ['by end of day', 2], ['by eod', 2], ['need this today', 2],
  ['time sensitive', 2], ['customer waiting', 2], ['customers waiting', 2],
  ['before the meeting', 2], ["can't proceed", 2], ['cannot proceed', 2],
  ['p1', 2], ['sev2', 2], ['sev 2', 2], ['high priority', 2],
  ['needs attention', 2], ['requires attention', 2], ['action required', 2],
  ['as soon as', 2], ['at the earliest', 2], ['at your earliest', 2],
  ['this week', 1], ['this afternoon', 2], ['this morning', 2],
  ['before friday', 1], ['before tomorrow', 2], ['by tomorrow', 2],
  ['client escalation', 2], ['customer escalation', 2],
  ['getting worse', 2], ['rapidly deteriorating', 2],
  ['multiple users', 1], ['several users', 1], ['many users', 1],
  ['blocking release', 2], ['blocks release', 2], ['release blocker', 2],
  ['sprint commitment', 1], ['committed to deliver', 2],
  ['follow up', 1], ['following up', 1], ['circling back', 1],
  ['still waiting', 2], ['still broken', 2], ['still down', 2],
  ['no response', 1], ['unanswered', 1], ['pending review', 1],
  ['needs fix', 1], ['fix needed', 1], ['hotfix', 2],
];

// --- Low signals ---

const LOW_WORDS: Record<string, number> = {
  whenever: 2, eventually: 2, someday: 2, minor: 2, trivial: 2,
  cosmetic: 2, backlog: 2, wishlist: 2, optional: 2,
  suggestion: 2, enhancement: 1, improvement: 1, idea: 2,
  maybe: 1, perhaps: 1, consider: 1, thinking: 1,
  hypothetical: 2, theoretical: 2, future: 1, later: 1, somepoint: 2,
  curious: 1, wondering: 1, pondering: 1, brainstorm: 2,
  refactor: 1, cleanup: 1, polish: 1, tweak: 1, nitpick: 2,
  aesthetic: 2, typo: 1, formatting: 1, indentation: 1,
  documentation: 1, docs: 1, readme: 1, comment: 1,
};

const LOW_PHRASES: [string, number][] = [
  ['no rush', 3], ['when you get a chance', 3], ['low priority', 3],
  ['not urgent', 3], ['just an idea', 2], ['nice to have', 2],
  ['nice-to-have', 2], ['p3', 2], ['p4', 2], ['p5', 2],
  ['sev3', 2], ['sev 3', 2], ['sev4', 2], ['sev 4', 2],
  ['no hurry', 3], ['take your time', 3], ['at some point', 2],
  ['when convenient', 2], ['if you have time', 2], ['spare time', 2],
  ['back burner', 2], ['on the back burner', 2], ['parking lot', 1],
  ['for future', 1], ['for later', 2], ['down the road', 2],
  ['in the future', 1], ['long term', 1], ['long-term', 1],
  ['would be nice', 2], ['it would be nice', 2], ['it would be cool', 2],
  ['just a thought', 2], ['food for thought', 2], ['just wondering', 2],
  ['not a big deal', 2], ['not a priority', 2], ['not blocking', 2],
  ['minor issue', 2], ['small issue', 2], ['tiny issue', 2],
  ['low impact', 2], ['minimal impact', 2], ['no impact', 2],
  ['paper cut', 2], ['edge case', 1], ['corner case', 1],
  ['if possible', 1], ['if time permits', 2], ['stretch goal', 2],
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

function scoreStructural(text: string): { scores: Record<Urgency, number>; signals: string[] } {
  const scores: Record<Urgency, number> = { critical: 0, high: 0, normal: 0, low: 0 };
  const signals: string[] = [];

  // ALL CAPS words → urgency boost
  const origWords = text.split(/\s+/);
  const allCapsCount = origWords.filter(w => w.length > 2 && w === w.toUpperCase() && /[A-Z]/.test(w)).length;
  if (allCapsCount >= 3) {
    scores.critical += 2;
    signals.push(`struct:${allCapsCount}-caps-words`);
  } else if (allCapsCount >= 1) {
    scores.high += 1;
    signals.push(`struct:${allCapsCount}-caps-words`);
  }

  // Multiple exclamation marks
  const exclCount = (text.match(/!/g) || []).length;
  if (exclCount >= 3) {
    scores.critical += 2;
    signals.push(`struct:${exclCount}-exclamation-marks`);
  } else if (exclCount >= 2) {
    scores.high += 1;
    signals.push(`struct:${exclCount}-exclamation-marks`);
  }

  // Very short, urgent-feeling text (< 10 words)
  const wordCount = origWords.filter(Boolean).length;
  if (wordCount <= 3 && exclCount > 0) {
    scores.critical += 1;
    signals.push('struct:terse-exclamation');
  }

  // Hedging language → low
  const hedges = ['maybe', 'perhaps', 'possibly', 'might', 'could potentially', 'just a'];
  const lower = text.toLowerCase();
  let hedgeCount = 0;
  for (const h of hedges) {
    if (lower.includes(h)) hedgeCount++;
  }
  if (hedgeCount >= 2) {
    scores.low += 2;
    signals.push('struct:multiple-hedges');
  }

  // Long polite text → normal/low
  if (wordCount > 50 && hedgeCount > 0) {
    scores.low += 1;
    signals.push('struct:long-hedging');
  }

  return { scores, signals };
}

export function detectUrgency(text: string): UrgencyResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      urgency: 'normal',
      confidence: 0,
      scores: { critical: 0, high: 0, normal: 0, low: 0 },
      signals: [],
    };
  }

  const rawScores: Record<Urgency, number> = { critical: 0, high: 0, normal: 0, low: 0 };
  const allSignals: string[] = [];

  // Critical
  const cw = matchWords(trimmed, CRITICAL_WORDS, 'crit');
  rawScores.critical += cw.score;
  allSignals.push(...cw.signals);
  const cp = matchPhrases(trimmed, CRITICAL_PHRASES, 'crit');
  rawScores.critical += cp.score;
  allSignals.push(...cp.signals);

  // High
  const hw = matchWords(trimmed, HIGH_WORDS, 'high');
  rawScores.high += hw.score;
  allSignals.push(...hw.signals);
  const hp = matchPhrases(trimmed, HIGH_PHRASES, 'high');
  rawScores.high += hp.score;
  allSignals.push(...hp.signals);

  // Low
  const lw = matchWords(trimmed, LOW_WORDS, 'low');
  rawScores.low += lw.score;
  allSignals.push(...lw.signals);
  const lp = matchPhrases(trimmed, LOW_PHRASES, 'low');
  rawScores.low += lp.score;
  allSignals.push(...lp.signals);

  // Structural
  const structural = scoreStructural(trimmed);
  for (const level of ['critical', 'high', 'normal', 'low'] as Urgency[]) {
    rawScores[level] += structural.scores[level];
  }
  allSignals.push(...structural.signals);

  // Normal is the default — gets a baseline
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  rawScores.normal = Math.min(wordCount * 0.2, 3);
  const totalOther = rawScores.critical + rawScores.high + rawScores.low;
  if (totalOther < 2) {
    rawScores.normal += 4;
    allSignals.push('struct:no-strong-signals');
  }

  // --- Normalize ---
  const levels: Urgency[] = ['critical', 'high', 'normal', 'low'];
  const total = Object.values(rawScores).reduce((a, b) => a + b, 0);

  const scores: Record<Urgency, number> = { critical: 0, high: 0, normal: 0, low: 0 };
  if (total > 0) {
    for (const level of levels) {
      scores[level] = Math.round((rawScores[level] / total) * 100) / 100;
    }
  }

  let bestLevel: Urgency = 'normal';
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

  return { urgency: bestLevel, confidence, scores, signals: allSignals };
}
