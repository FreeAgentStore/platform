/**
 * Profanity Filter — context-aware profanity detection engine.
 * Handles leetspeak, spacing evasion, compound words, and contextual false positives.
 * Evolved from 5000 labeled examples.
 */

export interface FilterMatch {
  word: string;       // the normalized profane word detected
  original: string;   // the original text as it appeared
  category: string;   // general, sexual, slur, scatological, religious
  context: string;    // surrounding text snippet
}

export interface FilterResult {
  flagged: boolean;
  severity: 'none' | 'mild' | 'moderate' | 'severe';
  score: number;
  matches: FilterMatch[];
  cleaned: string;
}

// ── Profanity dictionary ────────────────────────────────────────────

interface WordEntry {
  severity: 'mild' | 'moderate' | 'severe';
  category: string;
}

const PROFANITY_MAP: Record<string, WordEntry> = {
  // Severe
  'fuck': { severity: 'severe', category: 'general' },
  'fucker': { severity: 'severe', category: 'general' },
  'fucking': { severity: 'severe', category: 'general' },
  'motherfucker': { severity: 'severe', category: 'general' },
  'motherfucking': { severity: 'severe', category: 'general' },
  'fucks': { severity: 'severe', category: 'general' },
  'fucked': { severity: 'severe', category: 'general' },
  'cunt': { severity: 'severe', category: 'sexual' },
  'cunts': { severity: 'severe', category: 'sexual' },
  'nigger': { severity: 'severe', category: 'slur' },
  'niggers': { severity: 'severe', category: 'slur' },
  'nigga': { severity: 'severe', category: 'slur' },
  'faggot': { severity: 'severe', category: 'slur' },
  'faggots': { severity: 'severe', category: 'slur' },
  'retard': { severity: 'severe', category: 'slur' },
  'retarded': { severity: 'severe', category: 'slur' },
  'twat': { severity: 'severe', category: 'sexual' },
  'cocksucker': { severity: 'severe', category: 'sexual' },

  // Moderate
  'shit': { severity: 'moderate', category: 'scatological' },
  'shits': { severity: 'moderate', category: 'scatological' },
  'shitty': { severity: 'moderate', category: 'scatological' },
  'bullshit': { severity: 'moderate', category: 'scatological' },
  'horseshit': { severity: 'moderate', category: 'scatological' },
  'ass': { severity: 'moderate', category: 'general' },
  'asses': { severity: 'moderate', category: 'general' },
  'asshole': { severity: 'moderate', category: 'general' },
  'assholes': { severity: 'moderate', category: 'general' },
  'bitch': { severity: 'moderate', category: 'general' },
  'bitches': { severity: 'moderate', category: 'general' },
  'bitchy': { severity: 'moderate', category: 'general' },
  'dick': { severity: 'moderate', category: 'sexual' },
  'dicks': { severity: 'moderate', category: 'sexual' },
  'dickhead': { severity: 'moderate', category: 'sexual' },
  'cock': { severity: 'moderate', category: 'sexual' },
  'cocks': { severity: 'moderate', category: 'sexual' },
  'pussy': { severity: 'moderate', category: 'sexual' },
  'pussies': { severity: 'moderate', category: 'sexual' },
  'slut': { severity: 'moderate', category: 'sexual' },
  'sluts': { severity: 'moderate', category: 'sexual' },
  'whore': { severity: 'moderate', category: 'sexual' },
  'whores': { severity: 'moderate', category: 'sexual' },
  'bastard': { severity: 'moderate', category: 'general' },
  'bastards': { severity: 'moderate', category: 'general' },
  'wanker': { severity: 'moderate', category: 'sexual' },
  'wankers': { severity: 'moderate', category: 'sexual' },
  'bollocks': { severity: 'moderate', category: 'general' },
  'arsehole': { severity: 'moderate', category: 'general' },
  'arse': { severity: 'moderate', category: 'general' },
  'tosser': { severity: 'moderate', category: 'general' },
  'tits': { severity: 'moderate', category: 'sexual' },
  'boobs': { severity: 'moderate', category: 'sexual' },

  // Mild
  'damn': { severity: 'mild', category: 'religious' },
  'damned': { severity: 'mild', category: 'religious' },
  'dammit': { severity: 'mild', category: 'religious' },
  'goddamn': { severity: 'mild', category: 'religious' },
  'goddamnit': { severity: 'mild', category: 'religious' },
  'hell': { severity: 'mild', category: 'religious' },
  'crap': { severity: 'mild', category: 'scatological' },
  'crappy': { severity: 'mild', category: 'scatological' },
  'piss': { severity: 'mild', category: 'scatological' },
  'pissed': { severity: 'mild', category: 'scatological' },
  'pissing': { severity: 'mild', category: 'scatological' },
  'suck': { severity: 'mild', category: 'general' },
  'sucks': { severity: 'mild', category: 'general' },
  'screw': { severity: 'mild', category: 'general' },
  'screwed': { severity: 'mild', category: 'general' },
  'bloody': { severity: 'mild', category: 'general' },
  'bugger': { severity: 'mild', category: 'general' },
  'freaking': { severity: 'mild', category: 'general' },
  'frigging': { severity: 'mild', category: 'general' },
  'douchebag': { severity: 'mild', category: 'general' },
  'douche': { severity: 'mild', category: 'general' },
  'jackass': { severity: 'mild', category: 'general' },
  'dumbass': { severity: 'mild', category: 'general' },
  'smartass': { severity: 'mild', category: 'general' },
  'badass': { severity: 'mild', category: 'general' },
  'kickass': { severity: 'mild', category: 'general' },
  'lmao': { severity: 'mild', category: 'general' },
  'wtf': { severity: 'mild', category: 'general' },
  'stfu': { severity: 'moderate', category: 'general' },
};

// ── Leetspeak substitution map ──────────────────────────────────────

const LEET_MAP: Record<string, string[]> = {
  'a': ['@', '4'],
  'e': ['3'],
  'i': ['1', '!', '|'],
  'o': ['0'],
  's': ['$', '5'],
  't': ['7', '+'],
  'l': ['1', '|'],
  'b': ['8'],
  'g': ['9'],
};

// Build reverse map: character -> possible letter
const REVERSE_LEET: Record<string, string> = {};
for (const [letter, subs] of Object.entries(LEET_MAP)) {
  for (const sub of subs) {
    REVERSE_LEET[sub] = letter;
  }
}

// ── Innocent words that contain profane substrings ───────────────────

const INNOCENT_WORDS = new Set([
  // Words containing "ass"
  'assemble', 'assembled', 'assembler', 'assembles', 'assembling', 'assembly',
  'assert', 'asserted', 'asserting', 'assertion', 'assertions', 'assertive', 'asserts',
  'assess', 'assessed', 'assesses', 'assessing', 'assessment', 'assessments', 'assessor',
  'asset', 'assets', 'assign', 'assigned', 'assigning', 'assignment', 'assignments', 'assigns',
  'assist', 'assistance', 'assistant', 'assistants', 'assisted', 'assisting', 'assists',
  'associate', 'associated', 'associates', 'associating', 'association', 'associations',
  'assume', 'assumed', 'assumes', 'assuming', 'assumption', 'assumptions',
  'assure', 'assured', 'assures', 'assuring', 'assurance', 'assurances',
  'class', 'classes', 'classic', 'classical', 'classification', 'classified', 'classify',
  'mass', 'masses', 'massive', 'massage', 'massacre',
  'pass', 'passed', 'passenger', 'passengers', 'passes', 'passing', 'passion', 'passionate', 'passive', 'passport',
  'bass', 'embassy', 'embarrass', 'embarrassed', 'embarrassing', 'brass', 'grass', 'harass', 'harassment',
  'cassette', 'cassava', 'lasso', 'compass', 'bypass',
  // Words containing "hell"
  'hello', 'shell', 'shells', 'shelling', 'shelter', 'sheltered', 'shelters',
  'michelle', 'rochelle', 'seashell', 'nutshell', 'eggshell', 'bombshell',
  'othello', 'spelled', 'yelled', 'propelled', 'compelled', 'excelled',
  // Words containing "dick"
  'dickens', 'dickensian', 'benedict', 'benediction', 'addiction', 'dictate', 'dictated',
  'dictation', 'dictionary', 'dictator', 'edict', 'predict', 'predicted', 'prediction',
  'verdict', 'contradict', 'contradicted', 'jurisdiction', 'vindictive',
  // Words containing "damn"
  'adamant', 'fundamental', 'fundamentally',
  // Words containing "crap"
  'scrap', 'scrape', 'scraped', 'scraper', 'scraping', 'scrapped', 'scrappy',
  // Words containing "piss"
  // Words containing "cock"
  'peacock', 'peacocks', 'cockpit', 'cocktail', 'cocktails', 'cockatoo', 'cockatiel',
  'hancock', 'woodcock', 'stopcock', 'weathercock', 'shuttlecock',
  // Words containing "tit"
  'title', 'titled', 'titles', 'titillate', 'titan', 'titanium', 'constitution',
  'constitutional', 'institute', 'institution', 'petition', 'petitioner',
  'competition', 'competitive', 'competitor', 'appetite', 'repetition',
  'quantity', 'identity', 'entity', 'gratitude', 'attitude', 'aptitude',
  // Words containing "cum"
  'document', 'documented', 'documenting', 'documentation', 'documents',
  'circumstance', 'circumstances', 'circumference', 'cucumber', 'accumulate',
  'accumulated', 'accumulating', 'accumulation', 'incumbent',
  // Words containing "hoe"
  'shoe', 'shoes', 'horseshoe', 'phoenix',
  // Words containing "nig"
  'night', 'nights', 'nighttime', 'nightmare', 'nightmares', 'knight', 'knights',
  'knighthood', 'dignity', 'dignified', 'benign', 'malignant', 'significant',
  'significance', 'insignificant', 'resign', 'resigned', 'resignation',
  'design', 'designed', 'designer', 'designing', 'designate', 'ignite', 'ignition',
  // Words containing "fag"
  'fagot', // bundle of sticks (legitimate word)
  // Words containing "ho"
  'home', 'honest', 'honor', 'hope', 'horizon', 'hospital', 'host', 'hotel', 'hour', 'house',
  'household', 'housing', 'how', 'however', 'whole', 'whose', 'whoever',
]);

// ── Context clues for false positive suppression ─────────────────────

// Words near "ass" that indicate non-profane use (animal/assembly context)
const ASS_INNOCENT_CONTEXT = new Set([
  'donkey', 'donkeys', 'mule', 'mules', 'animal', 'animals', 'farm', 'wild',
  'ride', 'riding', 'rode', 'pack', 'beast', 'burden', 'stubborn',
]);

// Words near "hell" that indicate mild/non-profane use
const HELL_MILD_CONTEXT = new Set([
  'what', 'the', 'a', 'of', 'kind', 'sort', 'one', 'heck',
]);

// ── Helpers ──────────────────────────────────────────────────────────

function deleet(text: string): string {
  let result = '';
  for (const ch of text) {
    const mapped = REVERSE_LEET[ch];
    result += mapped || ch;
  }
  return result;
}

function removeSpacingEvasion(text: string): string {
  // Detect patterns like "f u c k", "s.h.i.t", "f-u-c-k", "f_u_c_k"
  // A word is spacing-evaded if it's single chars separated by spaces/dots/dashes
  return text.replace(
    /\b([a-zA-Z])[\s.\-_]+([a-zA-Z])[\s.\-_]+([a-zA-Z])([\s.\-_]+[a-zA-Z])*/g,
    (match) => {
      return match.replace(/[\s.\-_]+/g, '');
    }
  );
}

function isWordBoundary(text: string, start: number, end: number): boolean {
  // Check if the match is at a word boundary (not inside a larger word)
  const before = start > 0 ? text[start - 1] : ' ';
  const after = end < text.length ? text[end] : ' ';
  const isBeforeBoundary = /[\s,.:;!?'"()\-/]/.test(before) || start === 0;
  const isAfterBoundary = /[\s,.:;!?'"()\-/]/.test(after) || end === text.length;
  return isBeforeBoundary && isAfterBoundary;
}

function isProperNoun(text: string, pos: number): boolean {
  // Check if the word at pos is capitalized like a proper noun
  // and preceded by typical name patterns
  if (pos === 0) return false;
  const wordStart = pos;
  if (wordStart < text.length && text[wordStart] === text[wordStart].toUpperCase()) {
    // Check for typical name patterns before it
    const before = text.slice(0, pos).trimEnd();
    const lastWord = before.split(/\s+/).pop() || '';
    // If preceded by a title or another capitalized word, likely a name
    if (/^[A-Z]/.test(lastWord)) return true;
  }
  return false;
}

function getContext(text: string, start: number, end: number, radius: number = 30): string {
  const ctxStart = Math.max(0, start - radius);
  const ctxEnd = Math.min(text.length, end + radius);
  let ctx = text.slice(ctxStart, ctxEnd).trim();
  if (ctxStart > 0) ctx = '...' + ctx;
  if (ctxEnd < text.length) ctx = ctx + '...';
  return ctx;
}

function getAdjacentWords(text: string, start: number, end: number): string[] {
  const words: string[] = [];
  // Words before
  const before = text.slice(0, start).trim().split(/\s+/);
  if (before.length > 0) words.push(...before.slice(-3));
  // Words after
  const after = text.slice(end).trim().split(/\s+/);
  if (after.length > 0) words.push(...after.slice(0, 3));
  return words.map(w => w.toLowerCase().replace(/[^a-z]/g, ''));
}

// ── Severity score map ──────────────────────────────────────────────

const SEVERITY_SCORE: Record<string, number> = {
  'none': 0,
  'mild': 0.3,
  'moderate': 0.6,
  'severe': 0.95,
};

const SEVERITY_ORDER: ('none' | 'mild' | 'moderate' | 'severe')[] = ['none', 'mild', 'moderate', 'severe'];

function maxSeverity(a: 'none' | 'mild' | 'moderate' | 'severe', b: 'none' | 'mild' | 'moderate' | 'severe'): 'none' | 'mild' | 'moderate' | 'severe' {
  return SEVERITY_ORDER.indexOf(a) >= SEVERITY_ORDER.indexOf(b) ? a : b;
}

// ── Core detection ──────────────────────────────────────────────────

export function checkProfanity(text: string): FilterResult {
  if (!text.trim()) {
    return { flagged: false, severity: 'none', score: 0, matches: [], cleaned: text };
  }

  const matches: FilterMatch[] = [];
  let overallSeverity: 'none' | 'mild' | 'moderate' | 'severe' = 'none';

  // Phase 1: Normalize the text for scanning
  const original = text;
  const lower = text.toLowerCase();

  // Phase 2: Remove spacing evasion and create a de-evaded version
  const deEvaded = removeSpacingEvasion(lower);

  // Phase 3: Create a deleeted version
  const deleeted = deleet(deEvaded);

  // Scan all three versions
  const versions = [
    { text: lower, label: 'direct' },
    { text: deEvaded, label: 'evasion' },
    { text: deleeted, label: 'leetspeak' },
  ];

  const foundPositions = new Set<string>(); // avoid duplicate matches

  for (const version of versions) {
    for (const [word, entry] of Object.entries(PROFANITY_MAP)) {
      let searchPos = 0;
      while (true) {
        const idx = version.text.indexOf(word, searchPos);
        if (idx === -1) break;
        searchPos = idx + 1;

        const endIdx = idx + word.length;
        const posKey = `${word}:${idx}`;
        if (foundPositions.has(posKey)) continue;

        // === Word boundary check ===
        // If the word is part of a larger innocent word, skip it
        if (!isWordBoundary(version.text, idx, endIdx)) {
          // Extract the full word containing our match
          let fullWordStart = idx;
          let fullWordEnd = endIdx;
          while (fullWordStart > 0 && /[a-z]/.test(version.text[fullWordStart - 1])) fullWordStart--;
          while (fullWordEnd < version.text.length && /[a-z]/.test(version.text[fullWordEnd])) fullWordEnd++;
          const fullWord = version.text.slice(fullWordStart, fullWordEnd);

          if (INNOCENT_WORDS.has(fullWord)) continue;

          // For compound profanity like "bullshit", "asshole", "motherfucker" — still flag
          // Check if the full word is itself profane
          if (PROFANITY_MAP[fullWord]) {
            // Will be caught by its own iteration
            continue;
          }

          // If the full word isn't in profanity map and isn't innocent, skip
          // (prevents false positives from partial matches in unknown words)
          continue;
        }

        // === Context-aware checks ===

        // "ass" context: skip if in donkey/animal context
        if (word === 'ass') {
          const adjacent = getAdjacentWords(version.text, idx, endIdx);
          if (adjacent.some(w => ASS_INNOCENT_CONTEXT.has(w))) continue;
        }

        // "hell" context: downgrade severity in mild expressions
        if (word === 'hell') {
          const adjacent = getAdjacentWords(version.text, idx, endIdx);
          if (adjacent.some(w => HELL_MILD_CONTEXT.has(w))) {
            // Still flag but as mild
            // (entry.severity is already 'mild' for hell, so no change needed)
          }
        }

        // "dick" context: skip if preceded by capitalized word (proper noun)
        if (word === 'dick' || word === 'dicks') {
          if (isProperNoun(original, idx)) continue;
          // Check if "Dick" is capitalized in original (proper name)
          const origSlice = original.slice(idx, endIdx);
          if (origSlice[0] === origSlice[0].toUpperCase() && origSlice.length <= 5) {
            const adjacent = getAdjacentWords(original, idx, endIdx);
            // If surrounded by other capitalized words, it's a name
            const origAdjacent = getAdjacentWords(original, idx, endIdx);
            if (origAdjacent.some(w => w.length > 0 && w[0] === w[0].toUpperCase())) continue;
          }
        }

        // === Record match ===
        foundPositions.add(posKey);

        // Find the original text corresponding to this match
        const origStart = Math.min(idx, original.length - 1);
        const origEnd = Math.min(endIdx, original.length);
        const origText = version.label === 'direct'
          ? original.slice(origStart, origEnd)
          : original.slice(origStart, Math.min(origEnd + 5, original.length)).split(/\s/)[0] || word;

        matches.push({
          word,
          original: origText,
          category: entry.category,
          context: getContext(original, origStart, origEnd),
        });

        overallSeverity = maxSeverity(overallSeverity, entry.severity);
      }
    }
  }

  // Deduplicate matches by word
  const uniqueMatches: FilterMatch[] = [];
  const seenWords = new Set<string>();
  for (const m of matches) {
    const key = `${m.word}:${m.context}`;
    if (!seenWords.has(key)) {
      seenWords.add(key);
      uniqueMatches.push(m);
    }
  }

  const score = uniqueMatches.length === 0
    ? 0
    : Math.min(1, uniqueMatches.reduce((sum, m) => {
        const entry = PROFANITY_MAP[m.word];
        return sum + (entry ? SEVERITY_SCORE[entry.severity] : 0.3);
      }, 0) / Math.max(1, uniqueMatches.length) + (uniqueMatches.length - 1) * 0.05);

  return {
    flagged: uniqueMatches.length > 0,
    severity: overallSeverity,
    score: Math.min(1, score),
    matches: uniqueMatches,
    cleaned: cleanText(text),
  };
}

export function cleanText(text: string): string {
  let result = text;
  const lower = text.toLowerCase();

  // Sort profanity words by length descending to match longer words first
  const sortedWords = Object.keys(PROFANITY_MAP).sort((a, b) => b.length - a.length);

  for (const word of sortedWords) {
    const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, 'gi');
    result = result.replace(regex, (match) => {
      // Check if it's part of an innocent word
      const idx = lower.indexOf(match.toLowerCase());
      if (idx >= 0) {
        let fullStart = idx;
        let fullEnd = idx + match.length;
        while (fullStart > 0 && /[a-z]/i.test(lower[fullStart - 1])) fullStart--;
        while (fullEnd < lower.length && /[a-z]/i.test(lower[fullEnd])) fullEnd++;
        const fullWord = lower.slice(fullStart, fullEnd);
        if (INNOCENT_WORDS.has(fullWord)) return match;
      }
      return '*'.repeat(match.length);
    });
  }

  return result;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
