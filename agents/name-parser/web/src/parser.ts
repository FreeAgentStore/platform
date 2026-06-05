/**
 * Name Parser — pure heuristic human name parsing engine.
 * Handles Western, Eastern, Hispanic, Arabic, and mononym formats.
 * Evolved from 1500 labeled name examples across cultures.
 */

export interface ParsedName {
  prefix: string | null;
  first: string;
  middle: string | null;
  last: string | null;
  suffix: string | null;
  format: 'western' | 'eastern' | 'hispanic' | 'mononym' | 'generic';
  confidence: number;
}

// ── Prefixes ────────────────────────────────────────────────────────

const PREFIXES = new Set([
  'mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'rev', 'sir', 'lady',
  'hon', 'sen', 'rep', 'gov', 'pres', 'sgt', 'cpl', 'pvt', 'lt',
  'cpt', 'capt', 'maj', 'col', 'gen', 'adm', 'cmdr', 'fr', 'br',
  'sr', 'dame', 'lord', 'judge', 'justice', 'chancellor', 'dean',
  'rabbi', 'imam', 'sheikh', 'mstr', 'mx',
]);

// ── Suffixes ────────────────────────────────────────────────────────

const SUFFIXES = new Set([
  'jr', 'sr', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii',
  'phd', 'md', 'dds', 'dmd', 'esq', 'cpa', 'mba', 'jd', 'llm',
  'rn', 'do', 'dvm', 'pe', 'cfa', 'clu', 'chfc',
  'ret', 'usn', 'usmc', 'usa', 'usaf',
]);

// ── East Asian family names (top 100+ Chinese, Korean, Japanese, Vietnamese) ──

const EAST_ASIAN_SURNAMES = new Set([
  // Chinese (simplified pinyin) — top 100
  'wang', 'li', 'zhang', 'liu', 'chen', 'yang', 'huang', 'zhao', 'wu', 'zhou',
  'xu', 'sun', 'ma', 'zhu', 'hu', 'guo', 'he', 'lin', 'luo', 'gao',
  'zheng', 'liang', 'xie', 'tang', 'song', 'deng', 'han', 'feng', 'cao', 'peng',
  'zeng', 'xiao', 'tian', 'dong', 'pan', 'yuan', 'cai', 'jiang', 'yu', 'du',
  'ye', 'cheng', 'wei', 'su', 'lu', 'ding', 'ren', 'shen', 'yao', 'zhong',
  'gu', 'cui', 'tan', 'lv', 'fan', 'wang', 'fu', 'jin', 'qiu', 'xia',
  'shi', 'xiong', 'meng', 'qin', 'bai', 'hou', 'lei', 'long', 'duan', 'hao',
  'kong', 'shao', 'wan', 'chang', 'mao', 'qian', 'yan', 'jia', 'xue', 'wen',
  'ge', 'yin', 'dai', 'ni', 'liao', 'you', 'min', 'bi', 'lan', 'niu',
  'tao', 'ping', 'kang', 'zou', 'xi', 'chai', 'rao', 'sha', 'ai', 'mu',
  // Korean
  'kim', 'park', 'lee', 'choi', 'jung', 'kang', 'cho', 'yoon', 'jang',
  'lim', 'han', 'oh', 'seo', 'shin', 'kwon', 'hwang', 'ahn', 'song',
  'yoo', 'hong', 'jeon', 'ko', 'moon', 'yang', 'son', 'bae', 'baek',
  'nam', 'ryu', 'ha', 'kwak', 'noh', 'woo', 'byun', 'min', 'ji',
  // Japanese
  'sato', 'suzuki', 'takahashi', 'tanaka', 'watanabe', 'ito', 'yamamoto',
  'nakamura', 'kobayashi', 'kato', 'yoshida', 'yamada', 'sasaki', 'yamaguchi',
  'matsumoto', 'inoue', 'kimura', 'hayashi', 'shimizu', 'yamazaki',
  'mori', 'abe', 'ikeda', 'hashimoto', 'yamashita', 'ishikawa', 'nakajima',
  'maeda', 'fujita', 'ogawa', 'goto', 'okada', 'hasegawa', 'murakami',
  'kondo', 'ishii', 'saito', 'sakamoto', 'endo', 'aoki', 'fujii',
  'nishimura', 'fukuda', 'ota', 'miura', 'fujiwara', 'okamoto', 'matsuda',
  'nakagawa', 'takeuchi', 'kaneko', 'wada', 'noda', 'ueda', 'morita',
  // Vietnamese
  'nguyen', 'tran', 'le', 'pham', 'huynh', 'hoang', 'phan', 'vu', 'vo',
  'dang', 'bui', 'do', 'ho', 'ngo', 'duong', 'ly', 'truong', 'dinh',
  'mai', 'luong', 'dao', 'ta', 'cao', 'lam', 'quach',
]);

// ── Name particles (lowercase words that are part of a surname) ──────

const PARTICLES = new Set([
  'van', 'von', 'de', 'del', 'della', 'delle', 'degli', 'dei', 'di',
  'el', 'al', 'la', 'le', 'les', 'du', 'des', 'den', 'der', 'het',
  'bin', 'bint', 'ibn', 'abu', 'ben',
  'da', 'das', 'do', 'dos', 'e',
  'af', 'av', 'op', 'ten', 'ter', 'uit', 'unter', 'zu', 'zum', 'zur',
  'y',
]);

// ── Multi-word particle sequences ──

const MULTI_PARTICLES = [
  'van der', 'van den', 'van de', 'van het',
  'von der', 'von dem',
  'de la', 'de las', 'de los', 'de le',
  'del la',
  'op de', 'op den', 'op het',
  'uit de', 'uit den', 'uit het',
  'in de', 'in den', 'in het',
  'zu der', 'zu dem', 'zum',
  'ten ', 'ter ',
];

// ── Helpers ──────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.replace(/\./g, '').toLowerCase().trim();
}

function isPrefix(word: string): boolean {
  return PREFIXES.has(normalize(word));
}

function isSuffix(word: string): boolean {
  return SUFFIXES.has(normalize(word));
}

function isEastAsianSurname(word: string): boolean {
  return EAST_ASIAN_SURNAMES.has(word.toLowerCase());
}

function isParticle(word: string): boolean {
  return PARTICLES.has(word.toLowerCase());
}

function hasHyphen(word: string): boolean {
  return word.includes('-');
}

function isCapitalized(word: string): boolean {
  return word.length > 0 && word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase();
}

function startsWithMcOrO(word: string): boolean {
  const lower = word.toLowerCase();
  return lower.startsWith("o'") || lower.startsWith('mc') || lower.startsWith('mac');
}

// Detect if a multi-word particle sequence starts at position i in tokens
function findMultiParticle(tokens: string[], startIdx: number): number {
  const remaining = tokens.slice(startIdx).map(t => t.toLowerCase()).join(' ');
  for (const mp of MULTI_PARTICLES) {
    if (remaining.startsWith(mp.trimEnd())) {
      const partCount = mp.trimEnd().split(/\s+/).length;
      return partCount;
    }
  }
  return 0;
}

// ── Core parser ──────────────────────────────────────────────────────

export function parseName(input: string): ParsedName {
  const trimmed = input.trim();
  if (!trimmed) {
    return { prefix: null, first: '', middle: null, last: null, suffix: null, format: 'mononym', confidence: 0 };
  }

  // Normalize multiple spaces
  const normalized = trimmed.replace(/\s+/g, ' ');

  // Tokenize — keep punctuation attached to words
  const tokens = normalized.split(' ');

  // === Mononym check ===
  if (tokens.length === 1) {
    return {
      prefix: null,
      first: tokens[0],
      middle: null,
      last: null,
      suffix: null,
      format: 'mononym',
      confidence: 0.95,
    };
  }

  // === Extract prefixes ===
  let prefix: string | null = null;
  let startIdx = 0;

  if (tokens.length > 1 && isPrefix(tokens[0])) {
    prefix = tokens[0];
    startIdx = 1;
    // Handle "Dr." (with period already in token)
  }

  // === Extract suffixes ===
  const suffixes: string[] = [];
  let endIdx = tokens.length;

  // Walk backwards collecting suffixes (may be comma-separated)
  while (endIdx > startIdx + 1) {
    const last = tokens[endIdx - 1].replace(/,/g, '');
    if (isSuffix(last)) {
      suffixes.unshift(tokens[endIdx - 1].replace(/,/g, ''));
      endIdx--;
    } else {
      break;
    }
  }

  // Also check for comma-attached suffix: "Smith, Jr."
  // If the token before suffixes ends with comma, it's separator
  if (endIdx > startIdx && tokens[endIdx - 1].endsWith(',') && endIdx < tokens.length) {
    // Already handled above
  }

  const suffix = suffixes.length > 0 ? suffixes.join(' ') : null;

  // Remaining name tokens
  const nameTokens = tokens.slice(startIdx, endIdx).map(t => t.replace(/,$/, ''));

  if (nameTokens.length === 0) {
    return { prefix, first: '', middle: null, last: null, suffix, format: 'generic', confidence: 0.3 };
  }

  if (nameTokens.length === 1) {
    return {
      prefix,
      first: nameTokens[0],
      middle: null,
      last: null,
      suffix,
      format: prefix ? 'western' : 'mononym',
      confidence: prefix ? 0.7 : 0.9,
    };
  }

  // === Eastern order detection ===
  // If the first token is a known East Asian surname and the remaining tokens
  // are NOT also East Asian surnames, treat as Eastern order.
  const firstIsEA = isEastAsianSurname(nameTokens[0]);
  const secondIsEA = nameTokens.length > 1 && isEastAsianSurname(nameTokens[1]);

  if (firstIsEA && !secondIsEA && nameTokens.length <= 3) {
    // Eastern order: Family Given [Given2]
    const familyName = nameTokens[0];
    if (nameTokens.length === 2) {
      return {
        prefix,
        first: nameTokens[1],
        middle: null,
        last: familyName,
        suffix,
        format: 'eastern',
        confidence: 0.85,
      };
    }
    // 3 tokens: Family Given1 Given2 — or Family Given1-Given2 (hyphenated)
    return {
      prefix,
      first: nameTokens[1],
      middle: nameTokens.length > 2 ? nameTokens[2] : null,
      last: familyName,
      suffix,
      format: 'eastern',
      confidence: 0.8,
    };
  }

  // === Particle detection (van der Berg, de la Cruz, von Braun, etc.) ===
  // Look for particle sequences starting from position 1 onwards
  let particleStart = -1;
  let particleCount = 0;

  for (let i = 1; i < nameTokens.length; i++) {
    const multiLen = findMultiParticle(nameTokens, i);
    if (multiLen > 0 && i + multiLen < nameTokens.length) {
      particleStart = i;
      particleCount = multiLen;
      break;
    }
    if (isParticle(nameTokens[i]) && i + 1 < nameTokens.length) {
      particleStart = i;
      particleCount = 1;
      // Check if next is also a particle
      if (i + 1 < nameTokens.length - 1 && isParticle(nameTokens[i + 1])) {
        particleCount = 2;
      }
      break;
    }
  }

  if (particleStart > 0) {
    const firstNames = nameTokens.slice(0, particleStart);
    const lastParts = nameTokens.slice(particleStart);
    const lastName = lastParts.join(' ');

    return {
      prefix,
      first: firstNames[0],
      middle: firstNames.length > 1 ? firstNames.slice(1).join(' ') : null,
      last: lastName,
      suffix,
      format: 'western',
      confidence: 0.88,
    };
  }

  // === Hispanic compound surname detection ===
  // Pattern: Given [Given2] Surname1-Surname2 (hyphenated)
  // Pattern: Given [Given2] Surname1 Surname2 (two capitalized words at end)
  // "y" connector: "Surname1 y Surname2"

  // Check for hyphenated last name
  const lastToken = nameTokens[nameTokens.length - 1];
  if (hasHyphen(lastToken) && nameTokens.length >= 2) {
    const firstName = nameTokens[0];
    const middleParts = nameTokens.slice(1, -1);
    return {
      prefix,
      first: firstName,
      middle: middleParts.length > 0 ? middleParts.join(' ') : null,
      last: lastToken,
      suffix,
      format: 'hispanic',
      confidence: 0.85,
    };
  }

  // Check for "y" connector: "Surname1 y Surname2"
  const yIndex = nameTokens.findIndex((t, i) => i > 0 && t.toLowerCase() === 'y');
  if (yIndex > 1 && yIndex < nameTokens.length - 1) {
    // Everything before yIndex-1 is first/middle, yIndex-1 through end is compound surname
    const givenParts = nameTokens.slice(0, yIndex - 1);
    const surnameParts = nameTokens.slice(yIndex - 1);

    return {
      prefix,
      first: givenParts[0] || nameTokens[0],
      middle: givenParts.length > 1 ? givenParts.slice(1).join(' ') : null,
      last: surnameParts.join(' '),
      suffix,
      format: 'hispanic',
      confidence: 0.82,
    };
  }

  // Check for two-surname Hispanic pattern (4+ tokens, last two are both capitalized)
  if (nameTokens.length >= 4) {
    const last1 = nameTokens[nameTokens.length - 2];
    const last2 = nameTokens[nameTokens.length - 1];
    if (isCapitalized(last1) && isCapitalized(last2) && !isParticle(last1) && !isParticle(last2)) {
      const givenParts = nameTokens.slice(0, -2);
      return {
        prefix,
        first: givenParts[0],
        middle: givenParts.length > 1 ? givenParts.slice(1).join(' ') : null,
        last: `${last1} ${last2}`,
        suffix,
        format: 'hispanic',
        confidence: 0.75,
      };
    }
  }

  // === O'Brien / McDonald / MacArthur detection ===
  // These are always last names — if found not at position 0, use as last
  for (let i = 1; i < nameTokens.length; i++) {
    if (startsWithMcOrO(nameTokens[i])) {
      const givenParts = nameTokens.slice(0, i);
      const lastParts = nameTokens.slice(i);
      return {
        prefix,
        first: givenParts[0],
        middle: givenParts.length > 1 ? givenParts.slice(1).join(' ') : null,
        last: lastParts.join(' '),
        suffix,
        format: 'western',
        confidence: 0.88,
      };
    }
  }

  // === Standard Western: First [Middle...] Last ===
  if (nameTokens.length === 2) {
    return {
      prefix,
      first: nameTokens[0],
      middle: null,
      last: nameTokens[1],
      suffix,
      format: 'western',
      confidence: 0.9,
    };
  }

  if (nameTokens.length === 3) {
    return {
      prefix,
      first: nameTokens[0],
      middle: nameTokens[1],
      last: nameTokens[2],
      suffix,
      format: 'western',
      confidence: 0.88,
    };
  }

  // 4+ tokens without particles or Hispanic detection: first, middle(s), last
  const first = nameTokens[0];
  const last = nameTokens[nameTokens.length - 1];
  const middle = nameTokens.slice(1, -1).join(' ');

  return {
    prefix,
    first,
    middle: middle || null,
    last,
    suffix,
    format: 'generic',
    confidence: 0.65,
  };
}
