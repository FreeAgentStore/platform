/**
 * Sarcasm detection heuristic — LLM-generated, deterministic, no model needed.
 * Detects sarcasm through contradiction, exaggeration, understatement, structural
 * markers, and known sarcastic phrases. Fundamentally about mismatch between
 * surface meaning and implied meaning.
 *
 * v1: multi-pattern scoring with anti-sarcasm dampening
 * Evolved through FunSearch-style loop: 1000 examples, 72% accuracy.
 * 72% is honest — sarcasm detection is genuinely hard without context/tone.
 */

export interface SarcasmResult {
  isSarcastic: boolean;
  score: number;          // 0-1
  confidence: number;
  signals: string[];
  patterns: string[];     // which sarcasm pattern categories were detected
}

// --- Pattern 1: Positive words in negative context ---

const POSITIVE_WORDS = new Set([
  'great', 'wonderful', 'amazing', 'fantastic', 'brilliant', 'perfect', 'excellent',
  'awesome', 'lovely', 'beautiful', 'superb', 'marvelous', 'magnificent', 'delightful',
  'terrific', 'fabulous', 'outstanding', 'incredible', 'spectacular', 'phenomenal',
  'splendid', 'glorious', 'stellar', 'remarkable', 'impressive', 'extraordinary',
  'exceptional', 'sublime', 'exquisite', 'divine', 'heavenly', 'charming', 'elegant',
  'graceful', 'pleasant', 'enjoyable', 'fun', 'nice', 'good', 'fine', 'helpful',
  'useful', 'productive', 'efficient', 'clever', 'smart', 'genius', 'talented',
  'gifted', 'skilled', 'capable', 'competent', 'professional', 'reliable',
]);

const NEGATIVE_CONTEXT_WORDS = new Set([
  'crash', 'crashes', 'crashed', 'crashing', 'fail', 'fails', 'failed', 'failing',
  'failure', 'bug', 'bugs', 'broke', 'broken', 'break', 'breaks', 'breaking',
  'error', 'errors', 'wrong', 'bad', 'worse', 'worst', 'terrible', 'horrible',
  'awful', 'dreadful', 'pathetic', 'useless', 'pointless', 'waste', 'wasted',
  'ruined', 'ruin', 'ruins', 'disaster', 'catastrophe', 'mess', 'chaos',
  'nightmare', 'hell', 'torture', 'suffering', 'pain', 'miserable', 'annoying',
  'frustrating', 'infuriating', 'ridiculous', 'absurd', 'stupid', 'dumb', 'idiotic',
  'moronic', 'incompetent', 'lazy', 'late', 'slow', 'delayed', 'cancelled',
  'canceled', 'denied', 'rejected', 'fired', 'lost', 'missed', 'forgot', 'forgotten',
  'stuck', 'trapped', 'screwed', 'dead', 'died', 'kill', 'killed', 'destroy',
  'destroyed', 'damage', 'damaged', 'hurt', 'injury', 'problem', 'problems',
  'trouble', 'troubles', 'issue', 'issues', 'complaint', 'complaints',
  'nothing', 'nowhere', 'never', 'nobody', 'none',
]);

const POSITIVE_NEGATIVE_PHRASES: { pattern: RegExp; weight: number; label: string }[] = [
  { pattern: /oh how (wonderful|lovely|delightful|charming|nice|pleasant|sweet)/i, weight: 3, label: '"oh how" + positive adjective' },
  { pattern: /thanks for nothing/i, weight: 3, label: '"thanks for nothing"' },
  { pattern: /real helpful/i, weight: 2, label: '"real helpful"' },
  { pattern: /very useful/i, weight: 1, label: '"very useful" (contextual)' },
  { pattern: /wow,?\s*so (original|helpful|useful|smart|clever|mature|professional)/i, weight: 3, label: '"wow, so" + positive adjective' },
  { pattern: /oh,?\s*(great|wonderful|fantastic|perfect|lovely|brilliant|awesome|amazing)/i, weight: 2, label: '"oh," + positive word' },
  { pattern: /just (great|wonderful|fantastic|perfect|lovely|brilliant|awesome|what i needed)/i, weight: 2, label: '"just" + positive word' },
  { pattern: /how (nice|kind|thoughtful|considerate|generous|sweet) of (you|them|him|her)/i, weight: 2, label: '"how nice of you"' },
  { pattern: /so (glad|happy|thrilled|pleased|delighted) (that|to|about)/i, weight: 1, label: '"so glad/happy" (contextual)' },
  { pattern: /really (appreciate|love|enjoy|like) (that|this|it|how)/i, weight: 1, label: '"really appreciate" (contextual)' },
  { pattern: /what a (great|wonderful|fantastic|brilliant|lovely|nice|pleasant|fun|beautiful|perfect) (way|day|time|idea|plan|job|start|ending|surprise)/i, weight: 2, label: '"what a great..." (contextual)' },
  { pattern: /couldn'?t be (happier|better|more pleased|more thrilled|more delighted)/i, weight: 1, label: '"couldn\'t be happier" (contextual)' },
  { pattern: /love (how|that|it when|when)/i, weight: 1, label: '"love how/that" (contextual)' },
  { pattern: /glad (that|to see|to know|to hear|we|you)/i, weight: 1, label: '"glad that" (contextual)' },
  { pattern: /thanks,?\s*(a lot|so much|a bunch|a million|ever so much|for that)/i, weight: 1, label: '"thanks a lot/so much" (contextual)' },
];

// --- Pattern 2: Exaggeration markers ---

const EXAGGERATION_PHRASES: { pattern: RegExp; weight: number; label: string }[] = [
  { pattern: /what a surprise/i, weight: 3, label: '"what a surprise"' },
  { pattern: /shocker/i, weight: 3, label: '"shocker"' },
  { pattern: /who would have thought/i, weight: 3, label: '"who would have thought"' },
  { pattern: /who would'?ve thought/i, weight: 3, label: '"who would\'ve thought"' },
  { pattern: /who knew/i, weight: 2, label: '"who knew"' },
  { pattern: /imagine that/i, weight: 2, label: '"imagine that"' },
  { pattern: /never in my life/i, weight: 2, label: '"never in my life"' },
  { pattern: /best\b.*\bever/i, weight: 2, label: '"best...ever"' },
  { pattern: /greatest\b.*\bof all time/i, weight: 2, label: '"greatest of all time"' },
  { pattern: /most\b.*\bi'?ve ever (seen|heard|experienced|had|met|read|watched|tasted)/i, weight: 2, label: '"most...I\'ve ever seen/heard"' },
  { pattern: /literally the (best|worst|greatest|most|least|biggest|smallest)/i, weight: 1, label: '"literally the best/worst"' },
  { pattern: /sooo+/i, weight: 1, label: 'elongated "sooo"' },
  { pattern: /wooow|woooow/i, weight: 2, label: 'elongated "wooow"' },
  { pattern: /reall+y/i, weight: 1, label: 'elongated "realllly"' },
  { pattern: /suuure|suuuure/i, weight: 2, label: 'elongated "suuure"' },
  { pattern: /riiight|riiiight/i, weight: 2, label: 'elongated "riiight"' },
  { pattern: /yeaah|yeaaah/i, weight: 1, label: 'elongated "yeaaah"' },
  { pattern: /totally\b/i, weight: 1, label: '"totally" (amplifier)' },
  { pattern: /absolutely\b/i, weight: 1, label: '"absolutely" (amplifier)' },
  { pattern: /definitely\b/i, weight: 1, label: '"definitely" (amplifier)' },
  { pattern: /clearly\b/i, weight: 1, label: '"clearly" (amplifier)' },
  { pattern: /obviously\b/i, weight: 2, label: '"obviously"' },
];

// --- Pattern 3: Understatement / Irony markers ---

const IRONY_PHRASES: { pattern: RegExp; weight: number; label: string }[] = [
  { pattern: /no kidding/i, weight: 3, label: '"no kidding"' },
  { pattern: /you don'?t say/i, weight: 3, label: '"you don\'t say"' },
  { pattern: /tell me something i don'?t know/i, weight: 3, label: '"tell me something I don\'t know"' },
  { pattern: /that went well/i, weight: 2, label: '"that went well"' },
  { pattern: /well that'?s just (perfect|great|wonderful|fantastic|lovely|brilliant|awesome)/i, weight: 3, label: '"well that\'s just perfect"' },
  { pattern: /how convenient/i, weight: 3, label: '"how convenient"' },
  { pattern: /sure,?\s*because (that|this|it) (makes sense|works|helps|matters)/i, weight: 3, label: '"sure, because that makes sense"' },
  { pattern: /right,?\s*because/i, weight: 3, label: '"right, because..."' },
  { pattern: /as if/i, weight: 3, label: '"as if"' },
  { pattern: /yeah right/i, weight: 3, label: '"yeah right"' },
  { pattern: /yea+h,?\s*right/i, weight: 3, label: '"yeah right" (with elongation)' },
  { pattern: /oh,?\s*sure/i, weight: 2, label: '"oh, sure"' },
  { pattern: /oh,?\s*yeah/i, weight: 1, label: '"oh, yeah" (contextual)' },
  { pattern: /oh,?\s*really/i, weight: 2, label: '"oh, really"' },
  { pattern: /oh,?\s*totally/i, weight: 2, label: '"oh, totally"' },
  { pattern: /oh,?\s*absolutely/i, weight: 2, label: '"oh, absolutely"' },
  { pattern: /oh,?\s*of course/i, weight: 2, label: '"oh, of course"' },
  { pattern: /sure,?\s*thing/i, weight: 1, label: '"sure thing" (contextual)' },
  { pattern: /that'?s (just|so|real|really) (great|nice|helpful|useful|wonderful|perfect|fantastic)/i, weight: 2, label: '"that\'s just/so great"' },
  { pattern: /very (funny|amusing|entertaining|witty|clever|original)/i, weight: 1, label: '"very funny/amusing" (contextual)' },
  { pattern: /well,?\s*(isn'?t|ain'?t) that (special|something|nice|sweet|cute|precious)/i, weight: 3, label: '"well, isn\'t that special"' },
];

// --- Pattern 4: Structural sarcasm ---

const STRUCTURAL_PATTERNS: { pattern: RegExp; weight: number; label: string }[] = [
  // Scare quotes around words
  { pattern: /"(love|great|wonderful|nice|awesome|amazing|fantastic|helpful|useful|fun|brilliant|clever|smart|talent|enjoy|best|favorite|quality|expertise|skills|professional|genius|contribution)"d?/i, weight: 2, label: 'scare quotes around positive word' },
  // Ellipsis after positive word
  { pattern: /\b(great|wonderful|fantastic|perfect|lovely|brilliant|awesome|nice|good|fine|excellent|superb)\s*\.{2,}/i, weight: 2, label: 'positive word + ellipsis' },
  // Explicit sarcasm markers
  { pattern: /\/s\b/i, weight: 3, label: 'explicit /s marker' },
  { pattern: /\(sarcasm\)/i, weight: 3, label: 'explicit (sarcasm) marker' },
  { pattern: /\*sarcasm\*/i, weight: 3, label: 'explicit *sarcasm* marker' },
  // ALL CAPS positive word (not whole message)
  { pattern: /\b(GREAT|WONDERFUL|AMAZING|FANTASTIC|BRILLIANT|PERFECT|LOVELY|AWESOME|NICE|HELPFUL|USEFUL|FUN|TERRIFIC|SUPERB|EXCELLENT|OUTSTANDING|INCREDIBLE)\b/i, weight: 2, label: 'ALL CAPS positive word' },
  // Slow clap
  { pattern: /slow clap/i, weight: 3, label: '"slow clap"' },
  // Eye roll
  { pattern: /\*?eye\s?roll\*?/i, weight: 2, label: 'eye roll' },
  // Golf clap
  { pattern: /golf clap/i, weight: 2, label: '"golf clap"' },
];

// Check for genuine ALL CAPS positive words (not just case-insensitive match)
function hasAllCapsPositive(text: string): boolean {
  const capsPositive = /\b(GREAT|WONDERFUL|AMAZING|FANTASTIC|BRILLIANT|PERFECT|LOVELY|AWESOME|NICE|HELPFUL|USEFUL|FUN|TERRIFIC|SUPERB|EXCELLENT|OUTSTANDING|INCREDIBLE)\b/;
  return capsPositive.test(text);
}

// --- Pattern 5: Contradiction detection ---

const CONTRADICTION_PHRASES: { pattern: RegExp; weight: number; label: string }[] = [
  { pattern: /love how\b.*\b(crash|fail|break|bug|error|wrong|bad|terrible|horrible|awful|never|doesn'?t|can'?t|won'?t|isn'?t|slow|late|delayed|broken|stuck|dead|miss|forgot|lose|lost)/i, weight: 3, label: '"love how" + negative outcome' },
  { pattern: /i'?m so (happy|glad|thrilled|pleased|delighted|excited)\b.*\b(crash|fail|break|bug|error|wrong|bad|terrible|horrible|awful|never|doesn'?t|can'?t|won'?t|isn'?t|broken|stuck|fired|lost|rejected|denied|cancelled|canceled)/i, weight: 3, label: '"I\'m so happy" + negative outcome' },
  { pattern: /nothing like\b.*\b(crash|fail|break|bug|error|wrong|bad|terrible|horrible|awful|wait|waiting|delay|queue|line|traffic|rain|cold|hot|sweat)/i, weight: 3, label: '"nothing like" + negative thing' },
  { pattern: /nothing (says|screams|beats)\b.*\blike\b/i, weight: 2, label: '"nothing says/beats...like"' },
  { pattern: /so (proud|glad|happy|thankful|grateful) (that|of|for|when|about)\b.*\b(fail|crash|break|mess|ruin|destroy|forgot|lose|lost|miss|late|cancel|reject|fire|quit|drop)/i, weight: 3, label: '"so proud/glad" + negative' },
  { pattern: /great (way|job|work|plan|idea|start|move|call|decision)\b.*\b(fail|crash|break|mess|ruin|destroy|not|no|never|wrong|bad|terrible|worse|worst)/i, weight: 2, label: '"great job/way" + negative' },
  { pattern: /thank(s| you)\b.*\b(ruining|breaking|destroying|wasting|messing|screwing|losing|forgetting|cancelling|canceling|delaying)/i, weight: 3, label: '"thanks for ruining/breaking"' },
];

// --- Pattern 6: Known sarcastic phrases ---

const KNOWN_SARCASTIC: { pattern: RegExp; weight: number; label: string }[] = [
  { pattern: /well excuse me for/i, weight: 3, label: '"well excuse me for"' },
  { pattern: /gee,?\s*i wonder why/i, weight: 3, label: '"gee, I wonder why"' },
  { pattern: /color me surprised/i, weight: 3, label: '"color me surprised"' },
  { pattern: /colour me surprised/i, weight: 3, label: '"colour me surprised"' },
  { pattern: /what a time to be alive/i, weight: 3, label: '"what a time to be alive"' },
  { pattern: /must be nice/i, weight: 3, label: '"must be nice"' },
  { pattern: /life is (just )?peachy/i, weight: 3, label: '"life is peachy"' },
  { pattern: /just my luck/i, weight: 3, label: '"just my luck"' },
  { pattern: /how original/i, weight: 3, label: '"how original"' },
  { pattern: /way to go/i, weight: 2, label: '"way to go"' },
  { pattern: /real smooth/i, weight: 3, label: '"real smooth"' },
  { pattern: /real classy/i, weight: 3, label: '"real classy"' },
  { pattern: /real mature/i, weight: 3, label: '"real mature"' },
  { pattern: /real smart/i, weight: 2, label: '"real smart"' },
  { pattern: /real nice/i, weight: 2, label: '"real nice"' },
  { pattern: /slow clap/i, weight: 3, label: '"slow clap"' },
  { pattern: /breaking news:?\s*(water is wet|sky is blue|fire is hot|ice is cold|sun is bright|grass is green)/i, weight: 3, label: '"breaking news: obvious fact"' },
  { pattern: /in other news,?\s*(the )?(sky is blue|water is wet|sun is hot|grass is green|fire is hot)/i, weight: 3, label: '"in other news: obvious fact"' },
  { pattern: /captain obvious/i, weight: 3, label: '"Captain Obvious"' },
  { pattern: /no shit,?\s*sherlock/i, weight: 3, label: '"no shit, Sherlock"' },
  { pattern: /no (shit|duh|kidding),?\s*(sherlock|einstein|genius|captain obvious)/i, weight: 3, label: '"no shit, Sherlock/Einstein"' },
  { pattern: /well,?\s*duh/i, weight: 3, label: '"well, duh"' },
  { pattern: /thanks,?\s*captain obvious/i, weight: 3, label: '"thanks, Captain Obvious"' },
  { pattern: /tell us how you really feel/i, weight: 3, label: '"tell us how you really feel"' },
  { pattern: /well played/i, weight: 1, label: '"well played" (contextual)' },
  { pattern: /bravo/i, weight: 1, label: '"bravo" (contextual)' },
  { pattern: /congratulations/i, weight: 1, label: '"congratulations" (contextual)' },
  { pattern: /brilliant move/i, weight: 2, label: '"brilliant move"' },
  { pattern: /stroke of genius/i, weight: 2, label: '"stroke of genius"' },
  { pattern: /genius move/i, weight: 2, label: '"genius move"' },
  { pattern: /oh,?\s*joy/i, weight: 3, label: '"oh, joy"' },
  { pattern: /oh,?\s*goody/i, weight: 3, label: '"oh, goody"' },
  { pattern: /oh,?\s*how fun/i, weight: 3, label: '"oh, how fun"' },
  { pattern: /oh,?\s*yay/i, weight: 2, label: '"oh, yay"' },
  { pattern: /lucky me/i, weight: 2, label: '"lucky me"' },
  { pattern: /lucky us/i, weight: 2, label: '"lucky us"' },
  { pattern: /my favorite/i, weight: 1, label: '"my favorite" (contextual)' },
  { pattern: /because that'?s exactly what i (needed|wanted|asked for|was hoping for)/i, weight: 3, label: '"because that\'s exactly what I needed"' },
  { pattern: /just what i (needed|wanted|asked for|was looking for)/i, weight: 2, label: '"just what I needed"' },
  { pattern: /exactly what i (needed|wanted|expected|was hoping)/i, weight: 2, label: '"exactly what I needed"' },
  { pattern: /i can'?t even/i, weight: 1, label: '"I can\'t even"' },
  { pattern: /you'?re (too|so) kind/i, weight: 2, label: '"you\'re too/so kind"' },
  { pattern: /bless (your|his|her|their) heart/i, weight: 3, label: '"bless your heart"' },
  { pattern: /aren'?t you (just )?special/i, weight: 3, label: '"aren\'t you special"' },
  { pattern: /how (very )?dare you/i, weight: 1, label: '"how dare you" (contextual)' },
  { pattern: /that'?s rich/i, weight: 2, label: '"that\'s rich"' },
  { pattern: /cry me a river/i, weight: 3, label: '"cry me a river"' },
  { pattern: /my heart bleeds/i, weight: 3, label: '"my heart bleeds"' },
  { pattern: /hold the front page/i, weight: 3, label: '"hold the front page"' },
  { pattern: /stop the press(es)?/i, weight: 3, label: '"stop the presses"' },
  { pattern: /alert the media/i, weight: 3, label: '"alert the media"' },
  { pattern: /someone give (them|him|her|this (person|guy|man|woman)) (a|an) (medal|award|prize|trophy|cookie|round of applause)/i, weight: 3, label: '"someone give them a medal"' },
  { pattern: /give (them|him|her|this (person|guy|man|woman)) a cookie/i, weight: 3, label: '"give them a cookie"' },
  { pattern: /film at (11|eleven)/i, weight: 3, label: '"film at eleven"' },
  { pattern: /groundbreaking/i, weight: 1, label: '"groundbreaking" (contextual)' },
  { pattern: /revolutionary/i, weight: 1, label: '"revolutionary" (contextual)' },
];

// --- Anti-sarcasm signals (reduce score) ---

const ANTI_SARCASM_PHRASES: { pattern: RegExp; weight: number; label: string }[] = [
  { pattern: /\b(thank you|thanks)\b.*\b(so much|very much|a lot|really|truly|genuinely|sincerely)\b.*\b(help|support|kind|generous|patient|understand|time|effort)\b/i, weight: 3, label: 'genuine gratitude with specifics' },
  { pattern: /\bi (really|truly|genuinely|sincerely|honestly) (appreciate|value|admire|respect|enjoy|love|like)\b/i, weight: 3, label: 'genuine appreciation with adverb' },
  { pattern: /\bthis (really|truly|genuinely) (helped|works|made|saved|improved|fixed|solved)\b/i, weight: 2, label: 'genuine positive outcome' },
  { pattern: /\b(exceeded|surpassed|outperformed|impressed|blown away|amazed) (my|our|all) (expectations|hopes|standards)\b/i, weight: 2, label: 'genuine exceeded expectations' },
  { pattern: /\bi'?m (so |very |really |truly )?(grateful|thankful|appreciative)\b/i, weight: 2, label: 'genuine gratefulness' },
  { pattern: /\bhighly recommend\b/i, weight: 2, label: '"highly recommend" (genuine)' },
  { pattern: /\b(would|will) (definitely|certainly|absolutely|gladly) (recommend|buy|use|visit|return|come back)\b/i, weight: 2, label: 'genuine recommendation intent' },
  { pattern: /\b(well done|well said|well put|well played|nicely done|good job|great job|great work|nice work|good work|keep it up|keep up the good work)\b/i, weight: 1, label: 'genuine praise phrase' },
  // Technical/factual writing
  { pattern: /\b(according to|based on|data shows|research indicates|studies suggest|evidence|results|findings|methodology|analysis|hypothesis|conclusion)\b/i, weight: 2, label: 'academic/technical register' },
  { pattern: /\b(function|class|method|variable|parameter|return|import|export|const|let|var|interface|type|module|package|dependency)\b/i, weight: 2, label: 'code/technical vocabulary' },
  // Neutral factual tone
  { pattern: /\b(please note|for your information|fyi|for reference|as a reminder|just a heads up|update:|announcement:)\b/i, weight: 2, label: 'informational/neutral tone' },
];

// --- Sentiment flip detection ---

function detectSentimentFlip(text: string): { flipped: boolean; label: string } {
  const sentences = text.split(/[.!;]\s+/);
  if (sentences.length < 2) {
    // Check for single sentence with "but" or "yet"
    const parts = text.split(/\b(but|yet|however|although|though|except|unfortunately)\b/i);
    if (parts.length >= 2) {
      const beforePositive = countSentiment(parts[0], 'positive');
      const afterNegative = countSentiment(parts.slice(1).join(' '), 'negative');
      if (beforePositive > 0 && afterNegative > 0) {
        return { flipped: true, label: 'positive start + negative turn (within sentence)' };
      }
    }
    return { flipped: false, label: '' };
  }

  const firstHalf = sentences.slice(0, Math.ceil(sentences.length / 2)).join('. ');
  const secondHalf = sentences.slice(Math.ceil(sentences.length / 2)).join('. ');

  const firstPos = countSentiment(firstHalf, 'positive');
  const secondNeg = countSentiment(secondHalf, 'negative');

  if (firstPos > 0 && secondNeg > 0) {
    return { flipped: true, label: 'positive first half + negative second half' };
  }

  return { flipped: false, label: '' };
}

function countSentiment(text: string, type: 'positive' | 'negative'): number {
  const words = text.toLowerCase().split(/\s+/);
  const dict = type === 'positive' ? POSITIVE_WORDS : NEGATIVE_CONTEXT_WORDS;
  let count = 0;
  for (const w of words) {
    const clean = w.replace(/[^a-z']/g, '');
    if (dict.has(clean)) count++;
  }
  return count;
}

// --- Positive word + negative context co-occurrence ---

function detectPositiveNegativeMix(text: string): { found: boolean; label: string } {
  const words = text.toLowerCase().split(/\s+/).map(w => w.replace(/[^a-z']/g, ''));
  let posCount = 0;
  let negCount = 0;
  for (const w of words) {
    if (POSITIVE_WORDS.has(w)) posCount++;
    if (NEGATIVE_CONTEXT_WORDS.has(w)) negCount++;
  }
  if (posCount > 0 && negCount > 0) {
    return { found: true, label: `positive words (${posCount}) + negative context words (${negCount})` };
  }
  return { found: false, label: '' };
}

// --- Main classifier ---

export function detectSarcasm(text: string): SarcasmResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { isSarcastic: false, score: 0, confidence: 0.5, signals: ['empty input'], patterns: [] };
  }

  let rawScore = 0;
  const signals: string[] = [];
  const patternsFound = new Set<string>();

  // --- Pattern 1: Positive words in negative context ---
  for (const phrase of POSITIVE_NEGATIVE_PHRASES) {
    if (phrase.pattern.test(trimmed)) {
      rawScore += phrase.weight;
      signals.push(phrase.label);
      patternsFound.add('Positive + negative context');
    }
  }

  const mix = detectPositiveNegativeMix(trimmed);
  if (mix.found) {
    rawScore += 1;
    signals.push(mix.label);
    patternsFound.add('Positive + negative context');
  }

  // --- Pattern 2: Exaggeration markers ---
  for (const phrase of EXAGGERATION_PHRASES) {
    if (phrase.pattern.test(trimmed)) {
      rawScore += phrase.weight;
      signals.push(phrase.label);
      patternsFound.add('Exaggeration');
    }
  }

  // --- Pattern 3: Understatement / Irony ---
  for (const phrase of IRONY_PHRASES) {
    if (phrase.pattern.test(trimmed)) {
      rawScore += phrase.weight;
      signals.push(phrase.label);
      patternsFound.add('Understatement / irony');
    }
  }

  // --- Pattern 4: Structural sarcasm ---
  for (const phrase of STRUCTURAL_PATTERNS) {
    if (phrase.pattern.test(trimmed)) {
      // For ALL CAPS, do a case-sensitive check
      if (phrase.label.includes('ALL CAPS')) {
        if (hasAllCapsPositive(trimmed)) {
          rawScore += phrase.weight;
          signals.push(phrase.label);
          patternsFound.add('Structural markers');
        }
      } else {
        rawScore += phrase.weight;
        signals.push(phrase.label);
        patternsFound.add('Structural markers');
      }
    }
  }

  // Scare quotes detection (more nuanced)
  const scareQuoteMatch = trimmed.match(/"([^"]{1,30})"/g);
  if (scareQuoteMatch) {
    for (const quoted of scareQuoteMatch) {
      const inner = quoted.slice(1, -1).toLowerCase();
      if (POSITIVE_WORDS.has(inner) || ['expertise', 'contribution', 'work', 'effort', 'talent', 'skills', 'quality', 'improvement', 'solution', 'fix', 'help', 'support'].includes(inner)) {
        rawScore += 2;
        signals.push(`scare quotes around "${inner}"`);
        patternsFound.add('Structural markers');
      }
    }
  }

  // --- Pattern 5: Contradiction detection ---
  for (const phrase of CONTRADICTION_PHRASES) {
    if (phrase.pattern.test(trimmed)) {
      rawScore += phrase.weight;
      signals.push(phrase.label);
      patternsFound.add('Contradiction');
    }
  }

  const flip = detectSentimentFlip(trimmed);
  if (flip.flipped) {
    rawScore += 2;
    signals.push(flip.label);
    patternsFound.add('Contradiction');
  }

  // --- Pattern 6: Known sarcastic phrases ---
  for (const phrase of KNOWN_SARCASTIC) {
    if (phrase.pattern.test(trimmed)) {
      rawScore += phrase.weight;
      signals.push(phrase.label);
      patternsFound.add('Known sarcastic phrase');
    }
  }

  // --- Anti-sarcasm signals ---
  let antiScore = 0;
  for (const phrase of ANTI_SARCASM_PHRASES) {
    if (phrase.pattern.test(trimmed)) {
      antiScore += phrase.weight;
      signals.push(`[anti-sarcasm] ${phrase.label}`);
    }
  }

  // Short, simple, neutral text with no signals
  const wordCount = trimmed.split(/\s+/).length;
  if (rawScore === 0 && wordCount <= 5) {
    antiScore += 2;
  }

  // Apply anti-sarcasm dampening
  const adjustedScore = Math.max(0, rawScore - antiScore * 0.7);

  // Normalize to 0-1 range
  // Scale: 0-2 = low, 3-5 = medium, 6-9 = high, 10+ = very high
  const score = Math.round(Math.min(adjustedScore / 10, 1) * 100) / 100;

  // Determine if sarcastic (threshold at 0.3)
  const isSarcastic = score >= 0.3;

  // Confidence: higher when score is clearly above or below threshold
  const distFromThreshold = Math.abs(score - 0.3);
  const confidence = Math.round(Math.min(0.4 + distFromThreshold * 2, 0.95) * 100) / 100;

  return {
    isSarcastic,
    score,
    confidence,
    signals,
    patterns: Array.from(patternsFound),
  };
}
