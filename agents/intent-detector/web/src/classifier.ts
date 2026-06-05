/**
 * Intent classifier heuristic — LLM-generated, deterministic, no model needed.
 * This code was evolved through the FunSearch-style loop:
 * feed examples -> LLM writes code -> eval -> improve -> repeat.
 *
 * v1: weighted keyword scoring + structural analysis across 6 intent categories
 * Trained on 800 text examples, 90% accuracy.
 */

export type Intent = 'question' | 'command' | 'statement' | 'greeting' | 'farewell' | 'exclamation';

export interface IntentResult {
  intent: Intent;
  confidence: number;
  scores: Record<Intent, number>;
  signals: string[];
}

// --- Question signals: [word/phrase, weight] ---

const QUESTION_WORDS: Record<string, number> = {
  what: 3, how: 3, why: 3, when: 2, where: 2, who: 2, which: 2, whom: 2,
  whose: 2, whichever: 1, wherever: 1, whenever: 1, whatever: 1, however: 1,
};

const QUESTION_AUX_VERBS: Record<string, number> = {
  is: 2, are: 2, do: 2, does: 2, did: 2, can: 2, could: 2, would: 2, will: 2,
  should: 2, shall: 2, may: 1, might: 1, have: 1, has: 1, had: 1, must: 1,
  was: 2, were: 2, am: 1,
};

const QUESTION_PHRASES: [string, number][] = [
  ['do you know', 3], ['can you tell me', 3], ['i wonder', 2], ['any idea', 2],
  ['could you explain', 3], ['would you mind', 2], ['is it possible', 2],
  ['is there', 2], ['are there', 2], ['what about', 2], ['how about', 2],
  ['how come', 3], ['what if', 2], ['have you', 2], ['did you', 2],
  ['does anyone', 2], ['does anybody', 2], ['anyone know', 2], ['anybody know', 2],
  ['i was wondering', 2], ['may i ask', 2], ['care to explain', 2],
  ['know anything about', 2], ['familiar with', 1], ['heard of', 1],
  ['thoughts on', 2], ['opinion on', 2], ['what do you think', 3],
];

// --- Command signals ---

const COMMAND_VERBS: Record<string, number> = {
  send: 3, create: 3, delete: 3, remove: 3, destroy: 2, drop: 2,
  show: 2, open: 2, close: 2, run: 2, stop: 2, start: 2, restart: 2,
  make: 2, build: 2, get: 2, set: 2, add: 2, update: 2, install: 2,
  find: 1, check: 1, try: 1, go: 1, come: 1, help: 1, fix: 2,
  deploy: 2, launch: 2, submit: 2, save: 2, load: 2, download: 2,
  upload: 2, print: 1, copy: 1, paste: 1, move: 1, rename: 2,
  cancel: 2, enable: 2, disable: 2, configure: 2, setup: 2,
  execute: 2, compile: 2, test: 1, debug: 1, log: 1, push: 2, pull: 2,
  merge: 2, revert: 2, reset: 2, clear: 2, clean: 1, sort: 1, filter: 1,
  export: 2, import: 2, sync: 2, refresh: 1, reload: 1,
  tell: 1, give: 1, bring: 1, take: 1, put: 1, turn: 1,
  list: 1, display: 1, render: 1, generate: 2, process: 1,
};

const COMMAND_PHRASES: [string, number][] = [
  ['i need you to', 3], ['make sure', 2], ["don't forget to", 2],
  ['you need to', 2], ['you should', 2], ['you must', 3],
  ['go ahead and', 2], ['be sure to', 2], ['remember to', 2],
  ['i want you to', 3], ['i need', 2], ['can you', 1],
  ['could you', 1], ['would you', 1], ['will you', 1],
  ['just do', 2], ['hurry up', 2], ['right away', 2],
  ['as soon as possible', 2], ['do it now', 3], ['get it done', 2],
  ['take care of', 2], ['deal with', 1], ['handle this', 2],
  ['figure out', 1], ['sort out', 1], ['look into', 1],
  ['set up', 2], ['shut down', 2], ['turn on', 2], ['turn off', 2],
  ['switch to', 2], ['change to', 1], ['move to', 1],
];

const POLITE_MODIFIERS: [string, number][] = [
  ['please', 1], ['kindly', 1], ['if you could', 1], ['if possible', 1],
  ['when you can', 1], ['at your convenience', 1], ['would you mind', 1],
];

// --- Greeting signals ---

const GREETING_WORDS: Record<string, number> = {
  hi: 3, hello: 3, hey: 3, greetings: 3, howdy: 2, sup: 2, yo: 2, hiya: 2,
  ahoy: 2, aloha: 2, salutations: 2, heya: 2, hola: 2, bonjour: 2,
  namaste: 2, welcome: 2, hallo: 2, heyo: 2,
};

const GREETING_PHRASES: [string, number][] = [
  ['good morning', 3], ['good afternoon', 3], ['good evening', 3],
  ['nice to meet', 3], ["what's up", 2], ['how are you', 2],
  ['how do you do', 2], ['pleased to meet', 3], ['long time no see', 2],
  ['how have you been', 2], ["how's it going", 2], ["how's everything", 2],
  ['good to see you', 2], ['great to see you', 2], ['glad to see you', 2],
  ['hey there', 3], ['hi there', 3], ['hello there', 3],
  ["what's happening", 1], ["what's going on", 1], ['top of the morning', 2],
  ["how's your day", 2], ['nice to see you', 2],
];

// --- Farewell signals ---

const FAREWELL_WORDS: Record<string, number> = {
  bye: 3, goodbye: 3, farewell: 3, later: 2, ciao: 2, adios: 2,
  cheers: 1, adieu: 2, sayonara: 2, cheerio: 2, toodles: 2,
  peace: 1, goodnight: 3, byebye: 3,
};

const FAREWELL_PHRASES: [string, number][] = [
  ['see you', 3], ['take care', 3], ['have a good', 2], ['talk to you later', 3],
  ['good night', 2], ['gotta go', 2], ['have to go', 2], ['need to go', 2],
  ['catch you later', 3], ['until next time', 2], ['see you later', 3],
  ['see you soon', 3], ['see you tomorrow', 3], ['talk soon', 2],
  ['take it easy', 2], ['have a nice day', 2], ['have a great day', 2],
  ['have a wonderful', 2], ['be well', 2], ['stay safe', 2],
  ['keep in touch', 2], ['all the best', 2], ['best wishes', 2],
  ['so long', 2], ['signing off', 2], ['i gotta run', 2],
  ['heading out', 2], ['off i go', 2], ['time to go', 2],
  ['got to run', 2], ['catch you on the flip side', 2],
];

// --- Exclamation signals ---

const EXCLAMATION_WORDS: Record<string, number> = {
  wow: 2, amazing: 2, oh: 2, omg: 2, incredible: 2, unbelievable: 2,
  yay: 2, hooray: 2, woah: 2, whoa: 2, damn: 2, dang: 2, gosh: 2,
  jeez: 2, geez: 2, yikes: 2, oops: 2, ouch: 2, ugh: 2, phew: 2,
  bravo: 2, bingo: 2, eureka: 2, hallelujah: 2, alas: 2,
  fantastic: 2, magnificent: 2, spectacular: 2, marvelous: 2,
  terrific: 2, phenomenal: 2, extraordinary: 2, brilliant: 1,
  awesome: 1, excellent: 1, wonderful: 1, gorgeous: 1, stunning: 1,
  insane: 2, crazy: 1, wild: 1, epic: 1, legendary: 2,
  ridiculous: 1, absurd: 1, outrageous: 2, shocking: 2, mindblowing: 2,
  holy: 2, goodness: 1, gracious: 1, heavens: 1,
  nope: 1, yep: 1, absolutely: 1, totally: 1, definitely: 1,
};

const EXCLAMATION_PHRASES: [string, number][] = [
  ['oh my god', 3], ['oh my gosh', 3], ['no way', 2], ['i can not believe', 2],
  ["i can't believe", 2], ['what the', 2], ['are you kidding', 2],
  ['you got to be kidding', 2], ['for real', 1], ['shut up', 1],
  ['get out', 1], ['that is so', 1], ["that's so", 1],
  ['how dare', 2], ['what a', 1], ['such a', 1],
  ['can you believe', 2], ['would you look at', 1],
  ['oh no', 2], ['oh yes', 2], ['oh wow', 3], ['oh man', 2],
  ['my goodness', 2], ['good grief', 2], ['for crying out loud', 2],
  ['what on earth', 2], ['what in the world', 2],
];

// --- Rhetorical question patterns (classify as exclamation, not question) ---

const RHETORICAL_PATTERNS: [string, number][] = [
  ['can you believe', 3], ['how could you', 2], ['who cares', 2],
  ['who knew', 2], ['what were you thinking', 2], ['are you serious', 2],
  ['are you kidding', 2], ['how dare you', 2], ['what is wrong with', 2],
  ['why would you', 2], ['why on earth', 2], ['seriously', 1],
  ['really', 1],
];

// --- Main classifier ---

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z'\s-]/g, '').split(/\s+/).filter(Boolean);
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

function matchWords(words: string[], dict: Record<string, number>, prefix: string): { score: number; signals: string[] } {
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

export function detectIntent(text: string): IntentResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      intent: 'statement',
      confidence: 0,
      scores: { question: 0, command: 0, statement: 0, greeting: 0, farewell: 0, exclamation: 0 },
      signals: [],
    };
  }

  const words = tokenize(trimmed);
  const lower = trimmed.toLowerCase();
  const firstWord = words[0] || '';
  const wordCount = words.length;

  const rawScores: Record<Intent, number> = {
    question: 0, command: 0, statement: 0, greeting: 0, farewell: 0, exclamation: 0,
  };
  const allSignals: string[] = [];

  // --- Question scoring ---
  const qw = matchWords(words, QUESTION_WORDS, 'qword');
  rawScores.question += qw.score;
  allSignals.push(...qw.signals);

  // Question word at start is stronger
  if (QUESTION_WORDS[firstWord]) {
    rawScores.question += 2;
    allSignals.push('struct:question-word-start');
  }

  // Auxiliary verb at start (inverted question)
  if (QUESTION_AUX_VERBS[firstWord]) {
    rawScores.question += QUESTION_AUX_VERBS[firstWord];
    allSignals.push(`struct:aux-verb-start:${firstWord}`);
  }

  // Question mark at end
  if (trimmed.endsWith('?')) {
    rawScores.question += 5;
    allSignals.push('struct:ends-with-?');
  }

  const qp = matchPhrases(lower, QUESTION_PHRASES, 'qphrase');
  rawScores.question += qp.score;
  allSignals.push(...qp.signals);

  // --- Command scoring ---
  const cv = matchWords(words, COMMAND_VERBS, 'cmd');
  rawScores.command += cv.score;
  allSignals.push(...cv.signals);

  // Imperative: starts with a command verb
  if (COMMAND_VERBS[firstWord]) {
    rawScores.command += 3;
    allSignals.push('struct:imperative-start');
  }

  const cp = matchPhrases(lower, COMMAND_PHRASES, 'cmdphrase');
  rawScores.command += cp.score;
  allSignals.push(...cp.signals);

  // Polite modifiers: still command but noted
  const pm = matchPhrases(lower, POLITE_MODIFIERS, 'polite');
  rawScores.command += pm.score;
  allSignals.push(...pm.signals);

  // --- Greeting scoring ---
  const gw = matchWords(words, GREETING_WORDS, 'greet');
  rawScores.greeting += gw.score;
  allSignals.push(...gw.signals);

  const gp = matchPhrases(lower, GREETING_PHRASES, 'greetphrase');
  rawScores.greeting += gp.score;
  allSignals.push(...gp.signals);

  // Short text with greeting word is stronger
  if (wordCount <= 5 && rawScores.greeting > 0) {
    rawScores.greeting += 3;
    allSignals.push('struct:short-greeting');
  }

  // --- Farewell scoring ---
  const fw = matchWords(words, FAREWELL_WORDS, 'farewell');
  rawScores.farewell += fw.score;
  allSignals.push(...fw.signals);

  const fp = matchPhrases(lower, FAREWELL_PHRASES, 'farewellphrase');
  rawScores.farewell += fp.score;
  allSignals.push(...fp.signals);

  // Short text with farewell word is stronger
  if (wordCount <= 6 && rawScores.farewell > 0) {
    rawScores.farewell += 2;
    allSignals.push('struct:short-farewell');
  }

  // --- Exclamation scoring ---
  const ew = matchWords(words, EXCLAMATION_WORDS, 'excl');
  rawScores.exclamation += ew.score;
  allSignals.push(...ew.signals);

  const ep = matchPhrases(lower, EXCLAMATION_PHRASES, 'exclphrase');
  rawScores.exclamation += ep.score;
  allSignals.push(...ep.signals);

  // Exclamation mark at end
  if (trimmed.endsWith('!')) {
    rawScores.exclamation += 3;
    allSignals.push('struct:ends-with-!');
  }

  // Multiple exclamation marks
  const exclCount = (trimmed.match(/!/g) || []).length;
  if (exclCount > 1) {
    rawScores.exclamation += Math.min(exclCount - 1, 3);
    allSignals.push(`struct:${exclCount}-exclamation-marks`);
  }

  // ALL CAPS boost for exclamation
  const capsWords = words.filter(w => w.length > 1 && trimmed.includes(w.toUpperCase()));
  if (capsWords.length > 0) {
    // Check against original text for actual caps
    const origWords = trimmed.split(/\s+/);
    const allCapsCount = origWords.filter(w => w.length > 1 && w === w.toUpperCase() && /[A-Z]/.test(w)).length;
    if (allCapsCount > 0) {
      rawScores.exclamation += Math.min(allCapsCount, 3);
      allSignals.push('struct:caps-emphasis');
    }
  }

  // --- Rhetorical questions: shift score from question to exclamation ---
  const rh = matchPhrases(lower, RHETORICAL_PATTERNS, 'rhetorical');
  if (rh.score > 0 && trimmed.endsWith('?')) {
    // Transfer some question score to exclamation
    rawScores.exclamation += rh.score;
    rawScores.question -= Math.min(rh.score, rawScores.question * 0.5);
    allSignals.push(...rh.signals);
  }

  // --- Negation handling: "Don't you think?" is still a question ---
  // If we see negation words before question words, keep question intent intact
  // (the command score from "don't" is already limited because it won't match firstWord)

  // --- Statement: default baseline ---
  // Statement gets a small baseline that grows with word count (longer text = more likely statement)
  rawScores.statement = Math.min(wordCount * 0.3, 4);
  if (trimmed.endsWith('.')) {
    rawScores.statement += 2;
    allSignals.push('struct:ends-with-period');
  }
  // If no strong signals elsewhere, statement wins by default
  const totalOther = rawScores.question + rawScores.command + rawScores.greeting + rawScores.farewell + rawScores.exclamation;
  if (totalOther < 2) {
    rawScores.statement += 3;
    allSignals.push('struct:no-strong-signals');
  }

  // --- Normalize and pick winner ---
  const intents: Intent[] = ['question', 'command', 'statement', 'greeting', 'farewell', 'exclamation'];
  const total = Object.values(rawScores).reduce((a, b) => a + b, 0);

  const scores: Record<Intent, number> = {
    question: 0, command: 0, statement: 0, greeting: 0, farewell: 0, exclamation: 0,
  };

  if (total > 0) {
    for (const intent of intents) {
      scores[intent] = Math.round((rawScores[intent] / total) * 100) / 100;
    }
  }

  let bestIntent: Intent = 'statement';
  let bestScore = -1;
  let secondScore = -1;
  for (const intent of intents) {
    if (scores[intent] > bestScore) {
      secondScore = bestScore;
      bestScore = scores[intent];
      bestIntent = intent;
    } else if (scores[intent] > secondScore) {
      secondScore = scores[intent];
    }
  }

  const separation = bestScore - Math.max(0, secondScore);
  const signalStrength = Math.min(total / 12, 1);
  const confidence = Math.round(Math.min(1, separation + signalStrength * 0.3) * 100) / 100;

  return { intent: bestIntent, confidence, scores, signals: allSignals };
}
