/**
 * Question type classifier — LLM-generated, deterministic, no model needed.
 * Classifies text as yes/no, open-ended, rhetorical, choice, or not-a-question
 * using weighted keyword + structural scoring with negation and edge-case handling.
 *
 * v1: weighted keyword/phrase scoring + structural analysis + edge cases
 * Evolved through FunSearch-style loop: 900 examples, 87% accuracy.
 */

export type QuestionType = 'yes-no' | 'open' | 'rhetorical' | 'choice' | 'not-a-question';

export interface QuestionResult {
  type: QuestionType;
  confidence: number;
  scores: Record<QuestionType, number>;
  signals: string[];
  questionWord: string | null;
}

// --- Yes/No question signals ---

// Auxiliary verbs that start yes/no questions (case-insensitive matching on first word)
const YES_NO_STARTERS: Record<string, number> = {
  is: 3, are: 3, do: 3, does: 3, did: 3, can: 3, could: 3, would: 3, will: 3, should: 3,
  have: 2, has: 2, was: 2, were: 2, am: 2, shall: 2, might: 2, may: 2, must: 2,
  isn: 2, aren: 2, don: 2, doesn: 2, didn: 2, can: 3, couldn: 2, wouldn: 2, won: 2, shouldn: 2,
  hasn: 2, haven: 2, wasn: 2, weren: 2,
};

// Phrases that strongly indicate yes/no questions
const YES_NO_PHRASES: { pattern: RegExp; weight: number; label: string }[] = [
  { pattern: /^is it true that/i, weight: 3, label: 'starts with "is it true that"' },
  { pattern: /^do you think/i, weight: 2, label: 'starts with "do you think"' },
  { pattern: /^have you ever/i, weight: 2, label: 'starts with "have you ever"' },
  { pattern: /^would you like/i, weight: 2, label: 'starts with "would you like"' },
  { pattern: /^is there/i, weight: 2, label: 'starts with "is there"' },
  { pattern: /^are there/i, weight: 2, label: 'starts with "are there"' },
  { pattern: /^do you have/i, weight: 2, label: 'starts with "do you have"' },
  { pattern: /^can you/i, weight: 2, label: 'starts with "can you"' },
  { pattern: /^could you/i, weight: 2, label: 'starts with "could you"' },
  { pattern: /^would you/i, weight: 2, label: 'starts with "would you"' },
  { pattern: /^will you/i, weight: 2, label: 'starts with "will you"' },
  { pattern: /^should we/i, weight: 2, label: 'starts with "should we"' },
  { pattern: /^did you/i, weight: 2, label: 'starts with "did you"' },
  { pattern: /^is this/i, weight: 2, label: 'starts with "is this"' },
  { pattern: /^are you/i, weight: 2, label: 'starts with "are you"' },
  { pattern: /^does this/i, weight: 2, label: 'starts with "does this"' },
  { pattern: /^has anyone/i, weight: 2, label: 'starts with "has anyone"' },
  { pattern: /^was it/i, weight: 2, label: 'starts with "was it"' },
  { pattern: /^were you/i, weight: 2, label: 'starts with "were you"' },
  { pattern: /^shall we/i, weight: 2, label: 'starts with "shall we"' },
  { pattern: /^isn'?t it/i, weight: 2, label: 'starts with "isn\'t it"' },
  { pattern: /^isn'?t that/i, weight: 2, label: 'starts with "isn\'t that"' },
  { pattern: /^don'?t you think/i, weight: 2, label: 'starts with "don\'t you think"' },
  { pattern: /^wouldn'?t it be/i, weight: 2, label: 'starts with "wouldn\'t it be"' },
  { pattern: /^couldn'?t we/i, weight: 2, label: 'starts with "couldn\'t we"' },
  // Short inverted forms (missing auxiliary)
  { pattern: /^want (some|to|a|the) /i, weight: 2, label: 'starts with "want" (implied auxiliary)' },
  { pattern: /^need (some|to|a|the|any) /i, weight: 1, label: 'starts with "need" (implied auxiliary)' },
  { pattern: /^got (a|any|some|the) /i, weight: 1, label: 'starts with "got" (implied auxiliary)' },
  { pattern: /^mind if/i, weight: 2, label: 'starts with "mind if"' },
  { pattern: /^care to/i, weight: 2, label: 'starts with "care to"' },
  { pattern: /^ready to/i, weight: 1, label: 'starts with "ready to"' },
  // Tag questions
  { pattern: /,?\s*(right|yeah|no|eh|huh|correct|innit|isn'?t it|aren'?t you|don'?t you think|wouldn'?t you say)\s*\?$/i, weight: 2, label: 'tag question ending' },
];

// --- Open question signals ---

const QUESTION_WORDS: Record<string, number> = {
  what: 3, how: 3, why: 3, when: 2, where: 2, who: 2, which: 2, whom: 2, whose: 2,
};

const OPEN_PHRASES: { pattern: RegExp; weight: number; label: string }[] = [
  { pattern: /^what kind of/i, weight: 3, label: 'starts with "what kind of"' },
  { pattern: /^what type of/i, weight: 3, label: 'starts with "what type of"' },
  { pattern: /^what sort of/i, weight: 3, label: 'starts with "what sort of"' },
  { pattern: /^how much/i, weight: 3, label: 'starts with "how much"' },
  { pattern: /^how many/i, weight: 3, label: 'starts with "how many"' },
  { pattern: /^how long/i, weight: 3, label: 'starts with "how long"' },
  { pattern: /^how often/i, weight: 3, label: 'starts with "how often"' },
  { pattern: /^how far/i, weight: 3, label: 'starts with "how far"' },
  { pattern: /^how old/i, weight: 3, label: 'starts with "how old"' },
  { pattern: /^how come/i, weight: 3, label: 'starts with "how come"' },
  { pattern: /^in what way/i, weight: 3, label: 'starts with "in what way"' },
  { pattern: /^for what reason/i, weight: 3, label: 'starts with "for what reason"' },
  { pattern: /^to what extent/i, weight: 3, label: 'starts with "to what extent"' },
  { pattern: /^what is/i, weight: 2, label: 'starts with "what is"' },
  { pattern: /^what are/i, weight: 2, label: 'starts with "what are"' },
  { pattern: /^what was/i, weight: 2, label: 'starts with "what was"' },
  { pattern: /^what were/i, weight: 2, label: 'starts with "what were"' },
  { pattern: /^what do you/i, weight: 2, label: 'starts with "what do you"' },
  { pattern: /^what does/i, weight: 2, label: 'starts with "what does"' },
  { pattern: /^what did/i, weight: 2, label: 'starts with "what did"' },
  { pattern: /^what would/i, weight: 2, label: 'starts with "what would"' },
  { pattern: /^what should/i, weight: 2, label: 'starts with "what should"' },
  { pattern: /^what if/i, weight: 2, label: 'starts with "what if"' },
  { pattern: /^what about/i, weight: 2, label: 'starts with "what about"' },
  { pattern: /^how do/i, weight: 2, label: 'starts with "how do"' },
  { pattern: /^how does/i, weight: 2, label: 'starts with "how does"' },
  { pattern: /^how did/i, weight: 2, label: 'starts with "how did"' },
  { pattern: /^how can/i, weight: 2, label: 'starts with "how can"' },
  { pattern: /^how would/i, weight: 2, label: 'starts with "how would"' },
  { pattern: /^how should/i, weight: 2, label: 'starts with "how should"' },
  { pattern: /^how is/i, weight: 2, label: 'starts with "how is"' },
  { pattern: /^how are/i, weight: 2, label: 'starts with "how are"' },
  { pattern: /^why do/i, weight: 2, label: 'starts with "why do"' },
  { pattern: /^why does/i, weight: 2, label: 'starts with "why does"' },
  { pattern: /^why did/i, weight: 2, label: 'starts with "why did"' },
  { pattern: /^why is/i, weight: 2, label: 'starts with "why is"' },
  { pattern: /^why are/i, weight: 2, label: 'starts with "why are"' },
  { pattern: /^why would/i, weight: 2, label: 'starts with "why would"' },
  { pattern: /^why should/i, weight: 2, label: 'starts with "why should"' },
  { pattern: /^when did/i, weight: 2, label: 'starts with "when did"' },
  { pattern: /^when does/i, weight: 2, label: 'starts with "when does"' },
  { pattern: /^when is/i, weight: 2, label: 'starts with "when is"' },
  { pattern: /^when will/i, weight: 2, label: 'starts with "when will"' },
  { pattern: /^when was/i, weight: 2, label: 'starts with "when was"' },
  { pattern: /^where do/i, weight: 2, label: 'starts with "where do"' },
  { pattern: /^where does/i, weight: 2, label: 'starts with "where does"' },
  { pattern: /^where is/i, weight: 2, label: 'starts with "where is"' },
  { pattern: /^where are/i, weight: 2, label: 'starts with "where are"' },
  { pattern: /^where did/i, weight: 2, label: 'starts with "where did"' },
  { pattern: /^where can/i, weight: 2, label: 'starts with "where can"' },
  { pattern: /^who is/i, weight: 2, label: 'starts with "who is"' },
  { pattern: /^who are/i, weight: 2, label: 'starts with "who are"' },
  { pattern: /^who was/i, weight: 2, label: 'starts with "who was"' },
  { pattern: /^who did/i, weight: 2, label: 'starts with "who did"' },
  { pattern: /^who does/i, weight: 2, label: 'starts with "who does"' },
  { pattern: /^who would/i, weight: 2, label: 'starts with "who would"' },
  { pattern: /^which one/i, weight: 2, label: 'starts with "which one"' },
  { pattern: /^which is/i, weight: 2, label: 'starts with "which is"' },
  // Implied questions (no question mark)
  { pattern: /^i wonder (what|how|why|when|where|who|which|if|whether)/i, weight: 2, label: '"I wonder" + question word (implied question)' },
  { pattern: /^i('?d| would) like to know (what|how|why|when|where|who|which|if|whether)/i, weight: 2, label: '"I\'d like to know" (implied question)' },
  { pattern: /^tell me (what|how|why|when|where|who|which)/i, weight: 2, label: '"tell me" + question word (implied question)' },
  { pattern: /^do you know (what|how|why|when|where|who|which)/i, weight: 2, label: '"do you know" + question word (implied question)' },
  { pattern: /^any idea (what|how|why|when|where|who|which)/i, weight: 2, label: '"any idea" + question word (implied question)' },
  { pattern: /^can you tell me/i, weight: 2, label: '"can you tell me" (implied question)' },
  { pattern: /^i('?m| am) curious (about|if|whether|what|how|why)/i, weight: 2, label: '"I\'m curious" (implied question)' },
];

// --- Rhetorical question signals ---

const RHETORICAL_PHRASES: { pattern: RegExp; weight: number; label: string }[] = [
  { pattern: /who cares/i, weight: 3, label: '"who cares"' },
  { pattern: /who knows/i, weight: 3, label: '"who knows"' },
  { pattern: /what'?s the point/i, weight: 3, label: '"what\'s the point"' },
  { pattern: /why bother/i, weight: 3, label: '"why bother"' },
  { pattern: /isn'?t it obvious/i, weight: 3, label: '"isn\'t it obvious"' },
  { pattern: /can you believe/i, weight: 3, label: '"can you believe"' },
  { pattern: /what did you expect/i, weight: 3, label: '"what did you expect"' },
  { pattern: /how hard can it be/i, weight: 2, label: '"how hard can it be"' },
  { pattern: /you think i'?m/i, weight: 2, label: '"you think I\'m"' },
  { pattern: /since when/i, weight: 2, label: '"since when"' },
  { pattern: /what'?s the use/i, weight: 3, label: '"what\'s the use"' },
  { pattern: /what'?s the difference/i, weight: 2, label: '"what\'s the difference"' },
  { pattern: /who (even|really) /i, weight: 2, label: '"who even/really"' },
  { pattern: /what does it matter/i, weight: 3, label: '"what does it matter"' },
  { pattern: /why (even|should i|would i|would anyone)/i, weight: 2, label: '"why even/should I"' },
  { pattern: /how (could|dare) you/i, weight: 3, label: '"how could/dare you"' },
  { pattern: /how (stupid|dumb|naive|gullible)/i, weight: 2, label: '"how stupid/dumb"' },
  { pattern: /what'?s (wrong|the matter) with/i, weight: 2, label: '"what\'s wrong with"' },
  { pattern: /are you (kidding|serious|joking|nuts|crazy|insane|blind|deaf)/i, weight: 3, label: '"are you kidding/serious"' },
  { pattern: /do you (really|honestly|seriously) (think|believe|expect)/i, weight: 3, label: '"do you really think"' },
  { pattern: /is that (even|really|supposed to be)/i, weight: 2, label: '"is that even/really"' },
  { pattern: /can'?t you see/i, weight: 2, label: '"can\'t you see"' },
  { pattern: /don'?t you (see|get it|understand|realize|know)/i, weight: 2, label: '"don\'t you see/get it"' },
  { pattern: /what am i,? (a|an|some|your)/i, weight: 3, label: '"what am I, a..."' },
  { pattern: /am i (supposed|expected) to/i, weight: 2, label: '"am I supposed to"' },
  { pattern: /you call (this|that) /i, weight: 2, label: '"you call this/that"' },
  { pattern: /and i'?m supposed to/i, weight: 2, label: '"and I\'m supposed to"' },
  { pattern: /like i care/i, weight: 3, label: '"like I care"' },
  { pattern: /as if/i, weight: 2, label: '"as if"' },
  { pattern: /big deal/i, weight: 2, label: '"big deal"' },
  { pattern: /so what/i, weight: 3, label: '"so what"' },
  { pattern: /now what/i, weight: 1, label: '"now what"' },
  { pattern: /what else is new/i, weight: 3, label: '"what else is new"' },
  { pattern: /go figure/i, weight: 2, label: '"go figure"' },
  { pattern: /you know what i mean/i, weight: 2, label: '"you know what I mean" (tag question)' },
  { pattern: /know what i mean/i, weight: 2, label: '"know what I mean" (tag question)' },
  { pattern: /what do you want me to (do|say)/i, weight: 2, label: '"what do you want me to do/say"' },
  { pattern: /haven'?t we (all|been)/i, weight: 2, label: '"haven\'t we all"' },
  { pattern: /isn'?t (life|that|this) (just|always|so)/i, weight: 2, label: '"isn\'t life/that just..."' },
  { pattern: /what'?s (new|next)/i, weight: 1, label: '"what\'s new/next"' },
  // Emotional modifiers in question context
  { pattern: /\b(honestly|seriously|really)\b.*\?$/i, weight: 1, label: 'emotional modifier + question mark' },
  // Self-answering pattern: question + answer in same sentence
  { pattern: /\?\s*(obviously|of course|duh|exactly|precisely|naturally|clearly)/i, weight: 3, label: 'question + self-answer' },
];

// --- Choice question signals ---

const CHOICE_PHRASES: { pattern: RegExp; weight: number; label: string }[] = [
  { pattern: /\b\w+\s+or\s+\w+.*\?/i, weight: 3, label: '"X or Y?" pattern' },
  { pattern: /^which one/i, weight: 3, label: 'starts with "which one"' },
  { pattern: /this or that/i, weight: 3, label: '"this or that"' },
  { pattern: /option (a|b|1|2)/i, weight: 3, label: '"option A or B"' },
  { pattern: /either\b.*\bor\b/i, weight: 3, label: '"either...or"' },
  { pattern: /^would you rather/i, weight: 3, label: 'starts with "would you rather"' },
  { pattern: /\bprefer\b.*\bor\b/i, weight: 2, label: '"prefer...or"' },
  { pattern: /\bchoose\b.*\bor\b/i, weight: 2, label: '"choose...or"' },
  { pattern: /\bpick\b.*\bor\b/i, weight: 2, label: '"pick...or"' },
  { pattern: /\b(a|the) former or (a|the) latter/i, weight: 3, label: '"the former or the latter"' },
  { pattern: /\byes or no\b/i, weight: 2, label: '"yes or no"' },
  { pattern: /\btrue or false\b/i, weight: 2, label: '"true or false"' },
  { pattern: /\bleft or right\b/i, weight: 2, label: '"left or right"' },
  { pattern: /\bhere or there\b/i, weight: 2, label: '"here or there"' },
  { pattern: /\bnow or later\b/i, weight: 2, label: '"now or later"' },
  { pattern: /\btoday or tomorrow\b/i, weight: 2, label: '"today or tomorrow"' },
  { pattern: /which (do you|would you|should i|should we) (prefer|choose|pick|want|like|recommend)/i, weight: 3, label: '"which do you prefer/choose"' },
  { pattern: /what('?s| is) (your|the) (preference|choice|pick)/i, weight: 2, label: '"what\'s your preference"' },
  { pattern: /\bor\b.*\bor\b.*\?/i, weight: 2, label: 'multiple "or" options' },
];

// --- Not-a-question boosts ---

const DECLARATIVE_SIGNALS: { pattern: RegExp; weight: number; label: string }[] = [
  { pattern: /^(i|we|he|she|it|they|you|the|this|that|my|our|his|her|its|their|your|a|an) /i, weight: 1, label: 'starts with pronoun/determiner' },
  { pattern: /^(there|here|it|this|that) (is|are|was|were)/i, weight: 2, label: 'declarative "there is/are"' },
  { pattern: /\b(because|therefore|however|moreover|furthermore|consequently|thus|hence)\b/i, weight: 1, label: 'contains conjunction/connective' },
  { pattern: /^(please|let|let'?s|don'?t|stop|go|come|take|make|give|put|keep|try|remember|note|notice) /i, weight: 2, label: 'imperative verb start' },
  { pattern: /\.$/, weight: 2, label: 'ends with period' },
  { pattern: /!$/, weight: 2, label: 'ends with exclamation' },
];

// --- Main classifier ---

export function classifyQuestion(text: string): QuestionResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      type: 'not-a-question',
      confidence: 1,
      scores: { 'yes-no': 0, open: 0, rhetorical: 0, choice: 0, 'not-a-question': 1 },
      signals: ['empty input'],
      questionWord: null,
    };
  }

  const scores: Record<QuestionType, number> = {
    'yes-no': 0,
    open: 0,
    rhetorical: 0,
    choice: 0,
    'not-a-question': 0,
  };
  const signals: string[] = [];
  let questionWord: string | null = null;

  const endsWithQuestionMark = trimmed.endsWith('?');
  const words = trimmed.replace(/[^a-zA-Z'\s-]/g, '').split(/\s+/).filter(Boolean);
  const firstWord = words[0]?.toLowerCase() ?? '';
  const lowerText = trimmed.toLowerCase();

  // --- Structural signals ---

  if (endsWithQuestionMark) {
    signals.push('ends with "?"');
    // A question mark is a universal question signal; slightly boosts all question types
    scores['yes-no'] += 1;
    scores.open += 1;
    scores.rhetorical += 1;
    scores.choice += 1;
  } else {
    // No question mark: strong not-a-question signal (unless implied question patterns match)
    scores['not-a-question'] += 2;
    signals.push('no question mark');
  }

  // --- Phase 1: Rhetorical (check first, as rhetorical can overlap with open/yes-no) ---

  for (const rp of RHETORICAL_PHRASES) {
    if (rp.pattern.test(trimmed)) {
      scores.rhetorical += rp.weight;
      signals.push(`rhetorical: ${rp.label}`);
    }
  }

  // Negative question + obvious answer pattern: "Isn't the sky blue?"
  if (/^(isn'?t|aren'?t|don'?t|doesn'?t|didn'?t|can'?t|won'?t|wasn'?t|weren'?t|hasn'?t|haven'?t|couldn'?t|wouldn'?t|shouldn'?t)\b/i.test(trimmed) && endsWithQuestionMark) {
    // Check for obvious/trivial content
    const trivialPatterns = /\b(obviously|everyone knows|common knowledge|well known|clearly|of course|sky is blue|water is wet|sun is hot|grass is green)\b/i;
    if (trivialPatterns.test(trimmed)) {
      scores.rhetorical += 3;
      signals.push('rhetorical: negative question + obvious answer');
    } else {
      // Negative questions that aren't obviously rhetorical still lean yes/no
      scores['yes-no'] += 1;
    }
  }

  // --- Phase 2: Choice questions ---

  for (const cp of CHOICE_PHRASES) {
    if (cp.pattern.test(trimmed)) {
      scores.choice += cp.weight;
      signals.push(`choice: ${cp.label}`);
    }
  }

  // --- Phase 3: Open questions ---

  // Check for question words at the start
  const qwMatch = firstWord.match(/^(what|how|why|when|where|who|which|whom|whose)$/);
  if (qwMatch) {
    const qw = qwMatch[1];
    const weight = QUESTION_WORDS[qw] ?? 2;
    scores.open += weight;
    questionWord = qw;
    signals.push(`open: starts with "${qw}" (weight ${weight})`);
  }

  // Check for question word anywhere (weaker signal)
  if (!qwMatch) {
    for (const [qw, weight] of Object.entries(QUESTION_WORDS)) {
      const re = new RegExp(`\\b${qw}\\b`, 'i');
      if (re.test(lowerText)) {
        // Only count if we also have a question mark or implied question
        if (endsWithQuestionMark || /^i wonder/i.test(trimmed)) {
          scores.open += Math.max(1, weight - 1);
          if (!questionWord) questionWord = qw;
          signals.push(`open: contains "${qw}"`);
        }
        break; // Only count first match
      }
    }
  }

  for (const op of OPEN_PHRASES) {
    if (op.pattern.test(trimmed)) {
      scores.open += op.weight;
      signals.push(`open: ${op.label}`);
      // Extract question word from implied questions
      if (!questionWord) {
        const impliedMatch = trimmed.match(/\b(what|how|why|when|where|who|which|if|whether)\b/i);
        if (impliedMatch) questionWord = impliedMatch[1].toLowerCase();
      }
    }
  }

  // --- Phase 4: Yes/No questions ---

  // Check auxiliary at start
  const auxWeight = YES_NO_STARTERS[firstWord];
  if (auxWeight && !qwMatch) {
    scores['yes-no'] += auxWeight;
    signals.push(`yes-no: starts with auxiliary "${firstWord}" (weight ${auxWeight})`);
  }

  for (const ynp of YES_NO_PHRASES) {
    if (ynp.pattern.test(trimmed)) {
      scores['yes-no'] += ynp.weight;
      signals.push(`yes-no: ${ynp.label}`);
    }
  }

  // Yes/no structural: has question mark, starts with auxiliary, no question word
  if (endsWithQuestionMark && auxWeight && !qwMatch) {
    scores['yes-no'] += 1;
    signals.push('yes-no: auxiliary + "?" + no question word');
  }

  // --- Phase 5: Not-a-question signals ---

  for (const ds of DECLARATIVE_SIGNALS) {
    if (ds.pattern.test(trimmed)) {
      scores['not-a-question'] += ds.weight;
      signals.push(`not-a-question: ${ds.label}`);
    }
  }

  // Very short text with no question indicators
  if (words.length <= 2 && !endsWithQuestionMark && !qwMatch) {
    scores['not-a-question'] += 2;
    signals.push('not-a-question: very short, no question signals');
  }

  // --- Phase 6: Implied question adjustment ---
  // "I wonder if it will rain" should be open even without "?"
  if (/^i wonder\b/i.test(trimmed) && !endsWithQuestionMark) {
    scores['not-a-question'] -= 3; // counteract the "no question mark" penalty
    scores.open += 2;
    if (!questionWord) {
      const impliedMatch = trimmed.match(/\b(what|how|why|when|where|who|which|if|whether)\b/i);
      if (impliedMatch) questionWord = impliedMatch[1].toLowerCase();
    }
    signals.push('open: "I wonder" implies a question');
  }

  // --- Phase 7: Edge case - choice questions that also look yes/no ---
  // "Pizza or pasta?" should be choice, not yes/no
  if (scores.choice >= 3 && scores['yes-no'] > 0) {
    // If there's a clear "or" pattern, reduce yes/no
    if (/\bor\b/i.test(lowerText)) {
      scores['yes-no'] = Math.max(0, scores['yes-no'] - 2);
      signals.push('choice overrides yes-no (clear "or" pattern)');
    }
  }

  // --- Determine winner ---

  // Clamp negative scores to 0
  for (const key of Object.keys(scores) as QuestionType[]) {
    scores[key] = Math.max(0, scores[key]);
  }

  // Normalize scores
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const normalized: Record<QuestionType, number> = { 'yes-no': 0, open: 0, rhetorical: 0, choice: 0, 'not-a-question': 0 };
  if (totalScore > 0) {
    for (const key of Object.keys(scores) as QuestionType[]) {
      normalized[key] = Math.round((scores[key] / totalScore) * 100) / 100;
    }
  } else {
    normalized['not-a-question'] = 1;
  }

  // Pick the type with highest score
  let type: QuestionType = 'not-a-question';
  let maxScore = -1;
  for (const [key, value] of Object.entries(normalized) as [QuestionType, number][]) {
    if (value > maxScore) {
      maxScore = value;
      type = key;
    }
  }

  // Confidence is based on how dominant the winning type is
  const sortedScores = Object.values(normalized).sort((a, b) => b - a);
  const gap = sortedScores[0] - (sortedScores[1] ?? 0);
  const confidence = Math.round(Math.min(0.4 + gap * 1.2, 1) * 100) / 100;

  return { type, confidence, scores: normalized, signals, questionWord };
}
