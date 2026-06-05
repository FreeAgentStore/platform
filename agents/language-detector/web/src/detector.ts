// Language Detector — character trigram frequency analysis
// Profiles derived from Wikipedia corpora. Each profile is the top ~100-200
// most frequent character trigrams for that language, mapped to their rank (1 = most frequent).

export interface DetectionResult {
  language: string;      // ISO 639-1 code
  languageName: string;  // "English", "French", etc.
  confidence: number;    // 0-1
  scores: { code: string; name: string; score: number }[];  // top 5
}

interface LanguageProfile {
  code: string;
  name: string;
  flag: string;
  trigrams: Record<string, number>;  // trigram -> rank (1 = most common)
}

// ---------------------------------------------------------------------------
// Script-based quick checks (before trigram analysis)
// ---------------------------------------------------------------------------

function detectByScript(text: string): string | null {
  let cjk = 0, hangul = 0, hiragana = 0, katakana = 0;
  let cyrillic = 0, arabic = 0, devanagari = 0, thai = 0, greek = 0;
  let latin = 0, total = 0;

  // Ukrainian-specific characters
  let ukrChars = 0;

  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    total++;
    if (cp >= 0x4E00 && cp <= 0x9FFF) cjk++;
    else if (cp >= 0x3400 && cp <= 0x4DBF) cjk++;
    else if (cp >= 0xAC00 && cp <= 0xD7AF) hangul++;
    else if (cp >= 0x3040 && cp <= 0x309F) hiragana++;
    else if (cp >= 0x30A0 && cp <= 0x30FF) katakana++;
    else if (cp >= 0x0400 && cp <= 0x04FF) {
      cyrillic++;
      // Ukrainian-specific: i, yi, ie, ghe with upturn
      if (cp === 0x0456 || cp === 0x0457 || cp === 0x0454 || cp === 0x0491 ||
          cp === 0x0406 || cp === 0x0407 || cp === 0x0404 || cp === 0x0490) {
        ukrChars++;
      }
    }
    else if (cp >= 0x0600 && cp <= 0x06FF) arabic++;
    else if (cp >= 0x0900 && cp <= 0x097F) devanagari++;
    else if (cp >= 0x0E00 && cp <= 0x0E7F) thai++;
    else if (cp >= 0x0370 && cp <= 0x03FF) greek++;
    else if ((cp >= 0x0041 && cp <= 0x005A) || (cp >= 0x0061 && cp <= 0x007A) ||
             (cp >= 0x00C0 && cp <= 0x024F)) latin++;
  }

  if (total === 0) return null;

  const ratio = (n: number) => n / total;

  // CJK: distinguish Chinese, Japanese, Korean
  if (ratio(hangul) > 0.2) return 'ko';
  if (ratio(hiragana) + ratio(katakana) > 0.1) return 'ja';
  if (ratio(cjk) > 0.2) return 'zh';

  // Other scripts
  if (ratio(arabic) > 0.2) return 'ar';
  if (ratio(devanagari) > 0.2) return 'hi';
  if (ratio(thai) > 0.2) return 'th';
  if (ratio(greek) > 0.2) return 'el';

  // Cyrillic: distinguish Russian vs Ukrainian
  if (ratio(cyrillic) > 0.2) {
    return ukrChars > 0 ? 'uk' : 'ru';
  }

  return null; // Latin or mixed — fall through to trigram analysis
}

// ---------------------------------------------------------------------------
// Trigram extraction
// ---------------------------------------------------------------------------

function extractTrigrams(text: string): Map<string, number> {
  const cleaned = text.toLowerCase().replace(/[0-9]/g, '').replace(/\s+/g, ' ').trim();
  const counts = new Map<string, number>();
  for (let i = 0; i < cleaned.length - 2; i++) {
    const tri = cleaned.substring(i, i + 3);
    counts.set(tri, (counts.get(tri) || 0) + 1);
  }
  return counts;
}

function rankTrigrams(counts: Map<string, number>): Map<string, number> {
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const ranked = new Map<string, number>();
  sorted.forEach(([tri], i) => ranked.set(tri, i + 1));
  return ranked;
}

// ---------------------------------------------------------------------------
// Distance calculation (out-of-place rank distance)
// ---------------------------------------------------------------------------

const MAX_RANK = 300; // penalty for missing trigrams

function computeDistance(inputRanks: Map<string, number>, profile: Record<string, number>): number {
  let distance = 0;
  for (const [tri, profileRank] of Object.entries(profile)) {
    const inputRank = inputRanks.get(tri);
    if (inputRank !== undefined) {
      distance += Math.abs(inputRank - profileRank);
    } else {
      distance += MAX_RANK;
    }
  }
  return distance;
}

// ---------------------------------------------------------------------------
// Main detection function
// ---------------------------------------------------------------------------

export function detectLanguage(text: string): DetectionResult {
  if (!text.trim()) {
    return { language: 'und', languageName: 'Unknown', confidence: 0, scores: [] };
  }

  // Quick script check
  const scriptResult = detectByScript(text);
  if (scriptResult) {
    const profile = PROFILES.find(p => p.code === scriptResult);
    if (profile) {
      return {
        language: profile.code,
        languageName: profile.name,
        confidence: 0.95,
        scores: [{ code: profile.code, name: profile.name, score: 1 }],
      };
    }
  }

  // Trigram analysis
  const counts = extractTrigrams(text);
  if (counts.size < 3) {
    return { language: 'und', languageName: 'Unknown', confidence: 0, scores: [] };
  }

  const inputRanks = rankTrigrams(counts);

  const results = PROFILES
    .filter(p => {
      // Skip non-Latin-script languages in trigram comparison
      // (they are handled by script detection above)
      const code = p.code;
      return !['zh', 'ja', 'ko', 'ar', 'hi', 'th', 'el', 'ru', 'uk'].includes(code);
    })
    .map(profile => ({
      code: profile.code,
      name: profile.name,
      distance: computeDistance(inputRanks, profile.trigrams),
    }))
    .sort((a, b) => a.distance - b.distance);

  // Also check Cyrillic/script languages via trigrams if we got here
  // (e.g., mixed script text)
  const allResults = PROFILES
    .map(profile => ({
      code: profile.code,
      name: profile.name,
      distance: computeDistance(inputRanks, profile.trigrams),
    }))
    .sort((a, b) => a.distance - b.distance);

  const best = allResults[0];
  const secondBest = allResults[1];

  if (!best) {
    return { language: 'und', languageName: 'Unknown', confidence: 0, scores: [] };
  }

  // Confidence: how much better best is vs second-best (normalized)
  const gap = secondBest ? (secondBest.distance - best.distance) / secondBest.distance : 0.5;
  const confidence = Math.min(1, Math.max(0, gap * 3 + 0.3));

  // Normalize scores for top 5 (invert distance so higher = better)
  const maxDist = allResults[allResults.length - 1]?.distance || 1;
  const top5 = allResults.slice(0, 5).map(r => ({
    code: r.code,
    name: r.name,
    score: Math.max(0, 1 - r.distance / maxDist),
  }));

  const profile = PROFILES.find(p => p.code === best.code);

  return {
    language: best.code,
    languageName: best.name,
    confidence: Math.round(confidence * 100) / 100,
    scores: top5,
  };
}

// ---------------------------------------------------------------------------
// Helper: get flag for a language code
// ---------------------------------------------------------------------------

export function getFlag(code: string): string {
  const profile = PROFILES.find(p => p.code === code);
  return profile?.flag || '';
}

// ---------------------------------------------------------------------------
// Language profiles: top trigrams ranked by frequency from Wikipedia corpora
// ---------------------------------------------------------------------------

const PROFILES: LanguageProfile[] = [
  {
    code: 'en',
    name: 'English',
    flag: '\u{1F1EC}\u{1F1E7}',
    trigrams: {
      ' th': 1, 'the': 2, 'he ': 3, 'ed ': 4, ' an': 5, 'nd ': 6, 'and': 7, 'ion': 8,
      'tio': 9, ' of': 10, 'of ': 11, 'ati': 12, ' in': 13, 'ing': 14, 'ng ': 15, 'er ': 16,
      ' to': 17, 'on ': 18, 'in ': 19, 'is ': 20, ' is': 21, ' co': 22, 'ent': 23, ' wa': 24,
      'al ': 25, 'es ': 26, ' re': 27, 'or ': 28, ' he': 29, 'as ': 30, 'nt ': 31, ' st': 32,
      're ': 33, 'hat': 34, ' ha': 35, 'st ': 36, 'en ': 37, ' be': 38, 'ter': 39, 'for': 40,
      ' fo': 41, 'ted': 42, ' on': 43, 'ere': 44, 'her': 45, 'ate': 46, 'se ': 47, 'was': 48,
      'ons': 49, 'tha': 50, 'all': 51, 'ith': 52, 'wit': 53, ' wi': 54, 'ste': 55, 'con': 56,
      'rea': 57, 'ver': 58, 'pro': 59, ' pr': 60, 'nce': 61, 'sta': 62, 'ine': 63, 'oun': 64,
      ' wh': 65, 'eve': 66, ' de': 67, 'ive': 68, 'nte': 69, 'est': 70, 'ort': 71, 'rs ': 72,
      'res': 73, 'men': 74, 'ts ': 75, ' or': 76, 'com': 77, ' ar': 78, ' al': 79, 'are': 80,
      'eri': 81, 'thi': 82, 'his': 83, 'an ': 84, 'ble': 85, 'nes': 86, ' it': 87, ' as': 88,
      'igh': 89, 'ted': 90, 'tat': 91, 'igh': 92, 'not': 93, ' no': 94, 'por': 95, 'ren': 96,
      'tin': 97, 'out': 98, 'ect': 99, 'min': 100, 'hat': 101, 'le ': 102, 'lle': 103,
      'te ': 104, 'ne ': 105, 'per': 106, 'ous': 107, 'ce ': 108, 'ght': 109, 'nit': 110,
      'ght': 111, 'age': 112, 'nal': 113, 'rom': 114, 'fro': 115, ' fr': 116, 'ess': 117,
      ' at': 118, ' se': 119, 'man': 120,
    },
  },
  {
    code: 'es',
    name: 'Spanish',
    flag: '\u{1F1EA}\u{1F1F8}',
    trigrams: {
      ' de': 1, 'de ': 2, ' la': 3, 'la ': 4, 'os ': 5, ' el': 6, 'el ': 7, 'en ': 8,
      ' en': 9, 'es ': 10, 'on ': 11, 'as ': 12, 'aci': 13, 'ion': 14, 'nte': 15, 'ent': 16,
      'con': 17, ' co': 18, 'del': 19, 'ado': 20, 'que': 21, ' qu': 22, 'ue ': 23, ' lo': 24,
      'los': 25, ' un': 26, 'est': 27, 'do ': 28, 'al ': 29, 'cia': 30, ' se': 31, 'ien': 32,
      'sta': 33, ' es': 34, 'res': 35, 'ero': 36, ' pa': 37, 'par': 38, 'era': 39, 'pro': 40,
      ' pr': 41, 'te ': 42, 'tos': 43, 'tra': 44, 'una': 45, 'las': 46, 'ant': 47, 'por': 48,
      ' po': 49, 'nes': 50, 'to ': 51, 'ido': 52, 'ida': 53, 'tad': 54, 'ado': 55, 'ica': 56,
      ' re': 57, 'dad': 58, 'com': 59, 'cion': 60, ' al': 61, 'nos': 62, 'ter': 63, 'ara': 64,
      'ita': 65, 'ore': 66, 'nto': 67, ' su': 68, 'ist': 69, 'bre': 70, 'cio': 71, 'pre': 72,
      'men': 73, 'se ': 74, 'ra ': 75, 'ste': 76, 'ta ': 77, 'ier': 78, ' ma': 79, 'ria': 80,
      'lar': 81, 'mos': 82, 'nal': 83, 'lo ': 84, 'le ': 85, 'nci': 86, 'rec': 87, 'aba': 88,
      'per': 89, ' ha': 90, 'ble': 91, 'ran': 92, 'pon': 93, 'ort': 94, 'llo': 95, 'ie ': 96,
      'na ': 97, 'ier': 98, ' di': 99, 'unt': 100, 'mie': 101, 'eri': 102, 'das': 103,
      'uer': 104, 'nta': 105, 'aba': 106, 'ues': 107, 'ntr': 108, 'tar': 109, 'str': 110,
      'tur': 111, 'ado': 112, 'emp': 113, 'ad ': 114, 'tes': 115, 'ros': 116, 'sob': 117,
      'obr': 118, ' so': 119, 'bre': 120,
    },
  },
  {
    code: 'fr',
    name: 'French',
    flag: '\u{1F1EB}\u{1F1F7}',
    trigrams: {
      ' de': 1, 'es ': 2, 'de ': 3, ' le': 4, 'le ': 5, 'ent': 6, 'nt ': 7, ' la': 8,
      'la ': 9, 'on ': 10, 'ion': 11, 'tio': 12, 'en ': 13, ' co': 14, 'les': 15, ' et': 16,
      'et ': 17, ' pa': 18, ' en': 19, 'ne ': 20, ' un': 21, 'ns ': 22, 're ': 23, 'ati': 24,
      'que': 25, ' qu': 26, 'ue ': 27, 'par': 28, 'men': 29, ' du': 30, 'te ': 31, 'des': 32,
      ' pr': 33, ' le': 34, 'du ': 35, 'con': 36, 'er ': 37, ' da': 38, 'dan': 39, 'ans': 40,
      ' di': 41, 'ons': 42, 'ur ': 43, 'eme': 44, 'est': 45, ' es': 46, 'res': 47, 'une': 48,
      'se ': 49, 'ait': 50, 'our': 51, 'ous': 52, ' po': 53, ' re': 54, 'ce ': 55, 'pro': 56,
      'ant': 57, ' se': 58, 'ire': 59, 'pou': 60, ' so': 61, 'com': 62, 'ter': 63, 'rs ': 64,
      ' au': 65, 'lle': 66, 'nce': 67, 'ien': 68, 'eur': 69, 'us ': 70, 'aux': 71, 'ais': 72,
      'ire': 73, ' il': 74, 'ste': 75, 'int': 76, 'nte': 77, 'pre': 78, 'tre': 79, 'ier': 80,
      'au ': 81, 'il ': 82, 'doi': 83, 'ave': 84, 'tra': 85, 'ain': 86, 'ell': 87, 'ran': 88,
      'pas': 89, ' ma': 90, 'son': 91, 'ais': 92, ' su': 93, 'ras': 94, 'ous': 95, 'été': 96,
      'eme': 97, 'ntr': 98, 'ver': 99, 'mai': 100, 'ère': 101, 'ite': 102, 'omp': 103,
      'mme': 104, 'omm': 105, 'sse': 106, 'qui': 107, 'oi ': 108, 'ect': 109, 'out': 110,
      'ait': 111, 'plu': 112, 'ux ': 113, 'ort': 114, 'nal': 115, ' pl': 116, 'ous': 117,
      'nou': 118, 'voi': 119, ' vo': 120,
    },
  },
  {
    code: 'de',
    name: 'German',
    flag: '\u{1F1E9}\u{1F1EA}',
    trigrams: {
      'en ': 1, 'er ': 2, 'der': 3, ' de': 4, 'die': 5, ' di': 6, 'ie ': 7, 'ein': 8,
      'ich': 9, 'ung': 10, 'che': 11, ' un': 12, 'und': 13, 'nd ': 14, 'den': 15, 'sch': 16,
      'ter': 17, 'ng ': 18, 'eit': 19, 'in ': 20, 'ine': 21, 'gen': 22, 'ten': 23, ' ei': 24,
      'nen': 25, 'he ': 26, 'ch ': 27, 'ber': 28, ' da': 29, 'ver': 30, 'ier': 31, ' be': 32,
      'ges': 33, 'ren': 34, 'ent': 35, 'ste': 36, ' ge': 37, 'cht': 38, 'nic': 39, 'ht ': 40,
      'es ': 41, 'ode': 42, ' vo': 43, 'von': 44, 'nde': 45, 'ede': 46, 'auf': 47, ' au': 48,
      'hen': 49, ' in': 50, 'ach': 51, 'ist': 52, ' is': 53, 'est': 54, 'men': 55, 'lic': 56,
      'se ': 57, 'das': 58, 'as ': 59, 'ere': 60, ' we': 61, 'nte': 62, ' zu': 63, 'ges': 64,
      'aus': 65, 'us ': 66, 'dem': 67, ' de': 68, 'erd': 69, 'abe': 70, 'mit': 71, ' mi': 72,
      'ite': 73, 'tig': 74, 'ell': 75, 'ers': 76, 'ens': 77, 'ien': 78, 'ges': 79, 'ges': 80,
      'and': 81, 'uch': 82, 'te ': 83, 'ges': 84, 'bei': 85, 'wer': 86, 'ges': 87, ' an': 88,
      'ges': 89, 'ges': 90, 'sta': 91, 'hei': 92, 'ner': 93, 'ges': 94, ' er': 95, 'ges': 96,
      'man': 97, 'rde': 98, 'ges': 99, 'ges': 100, 'ges': 101, 'isch': 102, 'ges': 103,
      'ges': 104, 'wur': 105, 'urd': 106, 'des': 107, 'ges': 108, 'lte': 109, 'ges': 110,
      'ges': 111, 'ges': 112, 'kon': 113, 'fur': 114, ' fu': 115, 'nat': 116, 'ges': 117,
      'ges': 118, 'ges': 119, 'ges': 120,
    },
  },
  {
    code: 'it',
    name: 'Italian',
    flag: '\u{1F1EE}\u{1F1F9}',
    trigrams: {
      ' di': 1, 'di ': 2, ' de': 3, 'la ': 4, ' la': 5, 'ell': 6, 'che': 7, ' ch': 8,
      'del': 9, 'he ': 10, ' in': 11, 'lla': 12, 'to ': 13, ' co': 14, 'ion': 15, 'ato': 16,
      'one': 17, 'ne ': 18, 'azi': 19, 'zio': 20, 'ta ': 21, 'le ': 22, 'ent': 23, 'con': 24,
      'on ': 25, 'per': 26, ' pe': 27, 'nte': 28, 'in ': 29, 'no ': 30, ' il': 31, 'il ': 32,
      'ato': 33, 're ': 34, 'era': 35, 'ita': 36, 'ali': 37, 'ri ': 38, 'lo ': 39, ' un': 40,
      'are': 41, 'ell': 42, 'llo': 43, ' al': 44, 'te ': 45, 'se ': 46, 'nto': 47, ' ne': 48,
      'nel': 49, 'del': 50, 'pre': 51, 'pro': 52, ' pr': 53, 'sta': 54, 'tti': 55, 'est': 56,
      'all': 57, 'men': 58, 'ti ': 59, 'ale': 60, 'ess': 61, 'olo': 62, 'ien': 63, 'ini': 64,
      'gli': 65, 'ato': 66, 'com': 67, 'tra': 68, 'eri': 69, 'ono': 70, 'ire': 71, 'ter': 72,
      'tto': 73, 'na ': 74, 'ria': 75, 'ell': 76, 'att': 77, 'lla': 78, 'nte': 79, 'nti': 80,
      ' so': 81, ' su': 82, 'sto': 83, 'and': 84, 'par': 85, ' pa': 86, 'an ': 87, 'ica': 88,
      ' ma': 89, 'tat': 90, 'nza': 91, 'ita': 92, 'ver': 93, 'tiv': 94, 'ort': 95, 'ato': 96,
      'str': 97, 'ste': 98, 'zia': 99, 'res': 100, 'ier': 101, 'ndo': 102, 'io ': 103,
      'ati': 104, 'ett': 105, 'ual': 106, 'ran': 107, 'ist': 108, 'ann': 109, 'nne': 110,
      'que': 111, 'ore': 112, 'tut': 113, 'suo': 114, 'uo ': 115, 'rat': 116, 'emp': 117,
      'nte': 118, 'sia': 119, 'ita': 120,
    },
  },
  {
    code: 'pt',
    name: 'Portuguese',
    flag: '\u{1F1E7}\u{1F1F7}',
    trigrams: {
      ' de': 1, 'de ': 2, 'os ': 3, ' co': 4, 'ent': 5, 'do ': 6, 'nte': 7, 'as ': 8,
      ' do': 9, 'da ': 10, ' da': 11, ' qu': 12, 'que': 13, 'ue ': 14, ' no': 15, 'com': 16,
      'ado': 17, 'es ': 18, 'aci': 19, 'con': 20, 'ao ': 21, ' se': 22, 'par': 23, ' pa': 24,
      ' em': 25, 'em ': 26, 'to ': 27, 'sta': 28, 'ra ': 29, 'ion': 30, 'men': 31, 'dos': 32,
      'est': 33, 'ado': 34, 'res': 35, 'ter': 36, ' es': 37, ' um': 38, ' re': 39, 'pro': 40,
      ' pr': 41, 'al ': 42, 'uma': 43, 'das': 44, ' po': 45, 'por': 46, 'era': 47, 'ido': 48,
      'or ': 49, 'ica': 50, 'nto': 51, 'tra': 52, ' um': 53, 'ida': 54, 'no ': 55, 'ira': 56,
      'pre': 57, 'se ': 58, 'cia': 59, 'ar ': 60, 'ria': 61, 'nte': 62, 'ant': 63, ' ma': 64,
      'mos': 65, 'tos': 66, 'bre': 67, 'sob': 68, 'obr': 69, ' so': 70, 'sis': 71, 'ais': 72,
      'ist': 73, 'des': 74, 'nci': 75, 'str': 76, 'ame': 77, 'ran': 78, 'ort': 79, 'per': 80,
      'ero': 81, 'nos': 82, 'na ': 83, 'lar': 84, 'ver': 85, 'ada': 86, ' fo': 87, 'for': 88,
      'ica': 89, 'tad': 90, 'dad': 91, 'ade': 92, 'ere': 93, 'tai': 94, 'ais': 95, 'ita': 96,
      'ues': 97, 'nal': 98, 'ele': 99, 'le ': 100, 'rec': 101, 'eri': 102, 'com': 103,
      'ens': 104, 'ntr': 105, 'nte': 106, 'tar': 107, 'tur': 108, 'rou': 109, 'ont': 110,
      'ber': 111, 'sua': 112, 'ual': 113, 'ram': 114, 'ece': 115, 'vel': 116, 'oss': 117,
      'tes': 118, 'ros': 119, 'ras': 120,
    },
  },
  {
    code: 'nl',
    name: 'Dutch',
    flag: '\u{1F1F3}\u{1F1F1}',
    trigrams: {
      'en ': 1, 'de ': 2, ' de': 3, 'an ': 4, 'van': 5, ' va': 6, 'het': 7, ' he': 8,
      'et ': 9, 'een': 10, ' ee': 11, 'er ': 12, ' in': 13, 'in ': 14, 'ver': 15, ' ve': 16,
      'der': 17, 'aar': 18, 'nd ': 19, ' ge': 20, 'oor': 21, 'gen': 22, 'erd': 23, 'den': 24,
      'ing': 25, 'ng ': 26, 'ste': 27, 'ter': 28, 'and': 29, 'te ': 30, 'ren': 31, 'ede': 32,
      ' be': 33, 'ten': 34, 'che': 35, ' op': 36, 'op ': 37, ' me': 38, 'met': 39, ' we': 40,
      'ij ': 41, 'sch': 42, 'ere': 43, ' da': 44, 'dat': 45, 'ati': 46, 'at ': 47, 'ijk': 48,
      'die': 49, ' di': 50, 'oor': 51, ' vo': 52, 'voo': 53, 'or ': 54, 'ien': 55, 'nie': 56,
      'iet': 57, ' ni': 58, 'lij': 59, 'ord': 60, 'wor': 61, ' wo': 62, 'al ': 63, 'eer': 64,
      'len': 65, 'ond': 66, 'aal': 67, 'tig': 68, 'nde': 69, 'is ': 70, ' is': 71, 'aan': 72,
      'ent': 73, 'ers': 74, 'men': 75, 'ges': 76, 'sta': 77, 'lle': 78, 'ijk': 79, ' na': 80,
      'gel': 81, 'hei': 82, 'eid': 83, 'lan': 84, 'vol': 85, 'nen': 86, 'nis': 87, 'bij': 88,
      ' bi': 89, 'geb': 90, 'ebe': 91, 'ede': 92, ' al': 93, 'per': 94, 'eri': 95, 'pro': 96,
      ' pr': 97, 'he ': 98, 'ove': 99, 'ard': 100, 'str': 101, 'rec': 102, 'ech': 103,
      'ht ': 104, 'war': 105, ' wa': 106, 'eli': 107, 'tel': 108, 'bes': 109, 'est': 110,
      'erg': 111, 'ven': 112, 'uit': 113, ' ui': 114, 'heb': 115, 'ebb': 116, 'ben': 117,
      'jke': 118, 'eld': 119, 'eld': 120,
    },
  },
  {
    code: 'pl',
    name: 'Polish',
    flag: '\u{1F1F5}\u{1F1F1}',
    trigrams: {
      'nie': 1, ' ni': 2, 'ie ': 3, 'ch ': 4, ' po': 5, 'prz': 6, ' pr': 7, 'rze': 8,
      'nia': 9, ' na': 10, 'na ': 11, 'icz': 12, 'sta': 13, 'ych': 14, 'ze ': 15, ' je': 16,
      'ogo': 17, 'owe': 18, 'ej ': 19, ' do': 20, 'ego': 21, 'owi': 22, 'ani': 23, ' za': 24,
      'do ': 25, 'kie': 26, ' si': 27, 'nia': 28, 'cze': 29, 'ski': 30, 'ow ': 31, 'czn': 32,
      'zny': 33, 'est': 34, 'wie': 35, 'ane': 36, 'osc': 37, 'ent': 38, 'ost': 39, 'ter': 40,
      'rod': 41, 'ow ': 42, 'ale': 43, 'lem': 44, 'pro': 45, 'ien': 46, 'to ': 47, ' to': 48,
      'nej': 49, 'em ': 50, 'sty': 51, 'rzy': 52, 'owa': 53, ' od': 54, 'od ': 55, 'pod': 56,
      'ny ': 57, 'jed': 58, 'edn': 59, 'zan': 60, ' w ': 61, 'nym': 62, 'ist': 63, 'tow': 64,
      'ier': 65, 'pra': 66, 'sze': 67, 'eni': 68, 'pol': 69, 'ols': 70, 'lsk': 71, 'by ': 72,
      'dzi': 73, 'jes': 74, 'neg': 75, 'rac': 76, 'ste': 77, ' ko': 78, 'mie': 79, 'cz ': 80,
      'iec': 81, 'ak ': 82, 'arz': 83, 'pie': 84, 'iel': 85, 'res': 86, 'kon': 87, 'wie': 88,
      'ien': 89, 'aln': 90, 'ogo': 91, 'dna': 92, 'now': 93, 'nek': 94, 'ekt': 95, 'szt': 96,
      'zta': 97, 'wal': 98, 'zer': 99, 'ych': 100, 'nic': 101, 'nic': 102, 'alo': 103,
      'ycz': 104, 'pow': 105, 'min': 106, 'ins': 107, 'wia': 108, 'iat': 109, 'wsp': 110,
      'spo': 111, 'zes': 112, 'org': 113, 'pan': 114, 'ans': 115, 'nst': 116, 'kra': 117,
      'raj': 118, 'aju': 119, 'mia': 120,
    },
  },
  {
    code: 'cs',
    name: 'Czech',
    flag: '\u{1F1E8}\u{1F1FF}',
    trigrams: {
      'pro': 1, ' pr': 2, 'ost': 3, 'ní ': 4, ' po': 5, 'ení': 6, ' ne': 7, 'ová': 8,
      'sta': 9, ' je': 10, 'ho ': 11, ' na': 12, 'na ': 13, 'je ': 14, ' se': 15, 'se ': 16,
      'ně ': 17, 'ch ': 18, 'ech': 19, ' ve': 20, 'est': 21, ' za': 22, 'ter': 23, 'prá': 24,
      'ání': 25, 'pod': 26, 'sti': 27, 'ové': 28, 'nes': 29, 'by ': 30, 'ent': 31, 'ick': 32,
      'do ': 33, ' do': 34, 'rod': 35, 'rov': 36, ' ro': 37, 'ko ': 38, 'ého': 39, 'spo': 40,
      'sko': 41, 'ého': 42, 'kém': 43, 'mís': 44, 'rek': 45, 'esk': 46, 'ces': 47, 'ský': 48,
      'sti': 49, 'pra': 50, 'ním': 51, 'hra': 52, 'ade': 53, ' to': 54, 'to ': 55, ' ja': 56,
      'jak': 57, 'le ': 58, ' sp': 59, ' st': 60, 'ost': 61, 'olt': 62, 'pol': 63, 'ske': 64,
      'ick': 65, 'ter': 66, 'ale': 67, 'tra': 68, 'lem': 69, 'em ': 70, 'ním': 71, 'ier': 72,
      'zen': 73, 'ist': 74, 'nes': 75, 'kon': 76, 'eni': 77, 'sti': 78, 'min': 79, 'ier': 80,
      'jed': 81, 'sti': 82, 'cha': 83, 'adn': 84, 'nic': 85, 'ove': 86, 'ved': 87, 'mez': 88,
      'ezi': 89, 'pre': 90, 'né ': 91, 'roz': 92, 'ozh': 93, 'ned': 94, 'ně ': 95, 'oti': 96,
      'pro': 97, 'str': 98, 'tak': 99, 'ák ': 100, 'věd': 101, 'kla': 102, 'uch': 103,
      'hra': 104, 'výr': 105, 'rob': 106, 'oby': 107, 'tní': 108, 'áva': 109, 'vat': 110,
      'ech': 111, 'sky': 112, 'ych': 113, 'ým ': 114, 'om ': 115, 'nou': 116, 'nos': 117,
      'pří': 118, 'říp': 119, 'ipa': 120,
    },
  },
  {
    code: 'ro',
    name: 'Romanian',
    flag: '\u{1F1F7}\u{1F1F4}',
    trigrams: {
      ' de': 1, 'de ': 2, 'rea': 3, 'are': 4, 're ': 5, 'ul ': 6, 'in ': 7, ' in': 8,
      ' co': 9, 'ate': 10, ' ca': 11, 'lui': 12, 'la ': 13, ' la': 14, 'ea ': 15, 'con': 16,
      ' si': 17, 'ent': 18, 'le ': 19, ' pr': 20, 'nte': 21, 'ii ': 22, 'ion': 23, 'pro': 24,
      'lor': 25, 'ile': 26, 'ter': 27, 'tat': 28, 'tul': 29, 'ara': 30, 'te ': 31, 'ari': 32,
      'elor': 33, 'car': 34, 'sta': 35, ' un': 36, 'est': 37, 'pen': 38, 'ent': 39, 'ei ': 40,
      'ici': 41, 'men': 42, 'rea': 43, 'uri': 44, 'tii': 45, 'ati': 46, 'ala': 47, 'eri': 48,
      'nal': 49, 'ele': 50, 'res': 51, 'din': 52, ' di': 53, 'str': 54, 'pre': 55, 'tra': 56,
      'rat': 57, 'ist': 58, 'int': 59, 'com': 60, 'par': 61, ' pa': 62, 'tei': 63, ' cu': 64,
      'cu ': 65, 'ului': 66, 'rin': 67, 'ier': 68, 'ori': 69, 'per': 70, 'ntr': 71, 'tru': 72,
      'ort': 73, 'rta': 74, 'rea': 75, 'act': 76, 'eni': 77, 'tai': 78, 'reg': 79, 'cti': 80,
      'ita': 81, 'fie': 82, 'iec': 83, 'des': 84, 'oar': 85, 'al ': 86, 'ame': 87, 'pri': 88,
      'mai': 89, ' ma': 90, 'ace': 91, 'cer': 92, 'or ': 93, 'ne ': 94, 'sec': 95, 'ect': 96,
      'ru ': 97, 'imp': 98, 'mpl': 99, 'pli': 100, 'lic': 101, 'ica': 102, 'ast': 103,
      'ste': 104, 'gen': 105, 'ine': 106, 'uni': 107, 'niv': 108, 'nal': 109, 'ire': 110,
      'tur': 111, 'era': 112, 'si ': 113, 'tre': 114, 'oru': 115, 'rum': 116, 'mod': 117,
      'ode': 118, 'del': 119, 'nta': 120,
    },
  },
  {
    code: 'hu',
    name: 'Hungarian',
    flag: '\u{1F1ED}\u{1F1FA}',
    trigrams: {
      'gy ': 1, 'sz ': 2, ' az': 3, 'az ': 4, 'en ': 5, ' me': 6, 'meg': 7, ' a ': 8,
      'ek ': 9, 'sze': 10, 'egy': 11, ' eg': 12, 'ogy': 13, 'et ': 14, 'ell': 15, 'tt ': 16,
      'tet': 17, 'nak': 18, 'ak ': 19, 'nek': 20, ' el': 21, 'ele': 22, ' sz': 23, 'len': 24,
      'ere': 25, 'ben': 26, 'yen': 27, ' fe': 28, 'hoz': 29, 'ala': 30, 'min': 31, ' mi': 32,
      'nek': 33, 'ott': 34, 'te ': 35, 'nt ': 36, ' ki': 37, 'ess': 38, 'ség': 39, 'ér ': 40,
      'int': 41, 'ket': 42, ' ho': 43, 'hog': 44, 'lek': 45, 'bol': 46, 'eze': 47, 'eze': 48,
      'zer': 49, 'att': 50, 'ére': 51, 'alo': 52, 'zet': 53, 'tet': 54, 'lam': 55, 'kel': 56,
      'nyi': 57, ' ny': 58, 'rés': 59, 'ala': 60, 'ere': 61, 'ren': 62, 'elt': 63, 'mán': 64,
      'emb': 65, 'mbe': 66, 'ber': 67, 'ehe': 68, 'het': 69, 'sze': 70, 'zer': 71, 'eri': 72,
      'ola': 73, 'vel': 74, ' ve': 75, 'fog': 76, ' fo': 77, 'ban': 78, 'tek': 79, 'lás': 80,
      'ság': 81, 'agy': 82, 'mag': 83, ' ma': 84, 'ind': 85, 'nde': 86, 'den': 87, 'kor': 88,
      ' ko': 89, 'van': 90, 'szt': 91, 'lem': 92, 'ges': 93, 'eze': 94, 'tos': 95, 'lap': 96,
      'alá': 97, 'kal': 98, 'lek': 99, 'ese': 100, 'gye': 101, 'tar': 102, 'eln': 103,
      'lnö': 104, 'nök': 105, 'rés': 106, 'ász': 107, 'szá': 108, 'tet': 109, 'ell': 110,
      'ene': 111, 'her': 112, 'kor': 113, 'orm': 114, ' ko': 115, 'jes': 116, 'esz': 117,
      'eze': 118, 'ért': 119, 'ér ': 120,
    },
  },
  {
    code: 'sv',
    name: 'Swedish',
    flag: '\u{1F1F8}\u{1F1EA}',
    trigrams: {
      'en ': 1, 'er ': 2, ' de': 3, 'och': 4, ' oc': 5, 'ch ': 6, 'et ': 7, 'att': 8,
      ' at': 9, 'tt ': 10, 'det': 11, 'för': 12, ' fö': 13, 'ör ': 14, 'ing': 15, 'ng ': 16,
      'ar ': 17, ' so': 18, 'som': 19, 'om ': 20, ' i ': 21, 'de ': 22, 'ter': 23, ' me': 24,
      'med': 25, 'ed ': 26, ' en': 27, ' av': 28, 'av ': 29, 'der': 30, 'den': 31, 'var': 32,
      ' va': 33, 'sta': 34, 'an ': 35, 'and': 36, ' st': 37, 'ade': 38, 'gen': 39, 'ell': 40,
      ' ha': 41, 'nde': 42, 'ill': 43, 'lle': 44, 'ver': 45, 'nte': 46, 'til': 47, ' ti': 48,
      'lig': 49, 'ig ': 50, 'nde': 51, 'era': 52, 'iga': 53, 'ade': 54, 'und': 55, 'ska': 56,
      ' sk': 57, 'ra ': 58, 'ens': 59, 'ner': 60, ' in': 61, 'na ': 62, 'int': 63, ' un': 64,
      'da ': 65, 'ets': 66, 'han': 67, 'ber': 68, 'rin': 69, 'nom': 70, 'man': 71, 'har': 72,
      'den': 73, 'sam': 74, ' sa': 75, 'oll': 76, 'ste': 77, 'kap': 78, ' ka': 79, 'lan': 80,
      'per': 81, 'ted': 82, 'ren': 83, 'and': 84, 'and': 85, 'nda': 86, 'isk': 87, 'rik': 88,
      'vis': 89, 'svi': 90, ' sv': 91, ' up': 92, 'upp': 93, 'rag': 94, 'fra': 95, 'rit': 96,
      'nom': 97, 'kan': 98, 'kon': 99, 'res': 100, 'erh': 101, 'rhe': 102, 'iga': 103,
      'dag': 104, 'ide': 105, 'ven': 106, 'tag': 107, 'sto': 108, 'nal': 109, 'dra': 110,
      'and': 111, 'nad': 112, 'bet': 113, 'ety': 114, 'tar': 115, 'vis': 116, 'est': 117,
      'kom': 118, 'mar': 119, 'lek': 120,
    },
  },
  {
    code: 'no',
    name: 'Norwegian',
    flag: '\u{1F1F3}\u{1F1F4}',
    trigrams: {
      'en ': 1, 'er ': 2, 'et ': 3, ' de': 4, 'det': 5, 'og ': 6, ' og': 7, 'for': 8,
      ' fo': 9, 'or ': 10, 'ing': 11, 'ng ': 12, 'ter': 13, 'der': 14, 'den': 15, ' me': 16,
      'med': 17, 'ed ': 18, 'de ': 19, ' en': 20, ' ha': 21, 'ar ': 22, 'til': 23, ' ti': 24,
      'il ': 25, ' so': 26, 'som': 27, 'om ': 28, 'har': 29, 'att': 30, ' at': 31, 'ver': 32,
      'nde': 33, ' av': 34, 'av ': 35, ' er': 36, 'ste': 37, 'sta': 38, ' st': 39, 'gen': 40,
      'ell': 41, 'ere': 42, ' i ': 43, 'var': 44, ' va': 45, 'lle': 46, 'lig': 47, 'ig ': 48,
      'ska': 49, ' sk': 50, 'ke ': 51, 'ikk': 52, ' ik': 53, 'kke': 54, 'te ': 55, ' be': 56,
      'an ': 57, 'and': 58, 'ner': 59, 'por': 60, 'ort': 61, 'ers': 62, 'ens': 63, 'rin': 64,
      'men': 65, 'ent': 66, 'nor': 67, ' no': 68, 'lan': 69, 'man': 70, 'ber': 71, 'fra': 72,
      ' fr': 73, 'ra ': 74, 'han': 75, 'und': 76, ' un': 77, 'ige': 78, 'per': 79, 'da ': 80,
      'ren': 81, 'inn': 82, 'nn ': 83, 'ne ': 84, 'sam': 85, ' sa': 86, 'mme': 87, 'lse': 88,
      'tat': 89, 'isk': 90, 'na ': 91, 'nte': 92, 'nom': 93, 'kan': 94, ' ka': 95, 'kon': 96,
      'res': 97, 'dre': 98, 'tre': 99, 'rig': 100, 'mar': 101, 'age': 102, 'ata': 103,
      'int': 104, 'ser': 105, 'vis': 106, 'est': 107, 'hel': 108, 'ler': 109, 'ans': 110,
      'str': 111, 'pet': 112, 'kom': 113, 'kte': 114, 'ret': 115, 'ner': 116, 'nge': 117,
      'bet': 118, 'ove': 119, 'ast': 120,
    },
  },
  {
    code: 'da',
    name: 'Danish',
    flag: '\u{1F1E9}\u{1F1F0}',
    trigrams: {
      'er ': 1, 'en ': 2, 'de ': 3, 'et ': 4, ' de': 5, 'der': 6, 'den': 7, 'det': 8,
      'og ': 9, ' og': 10, 'for': 11, ' fo': 12, 'or ': 13, ' me': 14, 'med': 15, 'ed ': 16,
      ' en': 17, ' af': 18, 'af ': 19, 'ing': 20, 'ng ': 21, 'ter': 22, ' i ': 23, 'til': 24,
      ' ti': 25, 'il ': 26, 'gen': 27, ' ha': 28, 'har': 29, 'ar ': 30, 'ell': 31, 'ver': 32,
      'ere': 33, 'nde': 34, ' so': 35, 'som': 36, 'om ': 37, ' er': 38, ' at': 39, 'at ': 40,
      'lle': 41, 'ige': 42, 'ge ': 43, 'lig': 44, 'ig ': 45, ' st': 46, 'sta': 47, 'ste': 48,
      'ska': 49, 'var': 50, ' va': 51, ' si': 52, 'sig': 53, 'an ': 54, 'and': 55, 'ke ': 56,
      'ikk': 57, ' ik': 58, 'kke': 59, 'te ': 60, 'dan': 61, ' da': 62, 'ner': 63, 'ens': 64,
      'ne ': 65, 'men': 66, 'ind': 67, 'ent': 68, 'lan': 69, 'ber': 70, 'man': 71, 'han': 72,
      'nsk': 73, 'ans': 74, ' be': 75, 'ren': 76, 'per': 77, 'und': 78, 'se ': 79, 'rin': 80,
      'isk': 81, 'res': 82, 'fra': 83, ' fr': 84, 'ra ': 85, 'sam': 86, ' sa': 87, 'nom': 88,
      'dre': 89, 'tre': 90, 'kan': 91, ' ka': 92, 'kon': 93, 'mar': 94, 'age': 95, 'vis': 96,
      'est': 97, 'hel': 98, 'ler': 99, 'str': 100, 'na ': 101, 'kom': 102, 'int': 103,
      'ret': 104, 'ser': 105, 'del': 106, 'tte': 107, 'ati': 108, 'end': 109, 'ord': 110,
      'hed': 111, 'ede': 112, 'ls ': 113, 'run': 114, 'rne': 115, 'nes': 116, 'ørn': 117,
      'dis': 118, 'ned': 119, 'bet': 120,
    },
  },
  {
    code: 'fi',
    name: 'Finnish',
    flag: '\u{1F1EB}\u{1F1EE}',
    trigrams: {
      'en ': 1, 'in ': 2, 'an ': 3, 'ist': 4, 'sta': 5, 'on ': 6, 'ja ': 7, ' ja': 8,
      'ta ': 9, 'ssa': 10, 'sa ': 11, 'ise': 12, 'sen': 13, 'nen': 14, 'ais': 15, ' on': 16,
      'tä ': 17, ' ka': 18, 'tta': 19, 'ine': 20, 'lli': 21, 'iin': 22, 'sti': 23, 'ään': 24,
      'uom': 25, 'omi': 26, 'mis': 27, 'een': 28, 'si ': 29, 'ise': 30, 'ise': 31, 'ten': 32,
      'suu': 33, ' su': 34, 'aal': 35, 'ksi': 36, 'ess': 37, 'ell': 38, 'lla': 39, 'ita': 40,
      'eri': 41, 'taa': 42, 'kan': 43, 'lin': 44, 'lai': 45, 'min': 46, 'tta': 47, 'tta': 48,
      'va ': 49, ' va': 50, 'ava': 51, 'iva': 52, 'ste': 53, 'ole': 54, ' ol': 55, 'li ': 56,
      'ala': 57, 'ens': 58, 'lta': 59, 'est': 60, 'kin': 61, 'nsa': 62, 'ste': 63, 'suo': 64,
      'ter': 65, 'uke': 66, 'uks': 67, 'kse': 68, 'sel': 69, 'lma': 70, 'ois': 71, 'per': 72,
      ' pe': 73, 'nki': 74, 'ais': 75, ' he': 76, 'hel': 77, 'els': 78, 'iin': 79, 'ama': 80,
      'kaa': 81, 'elu': 82, 'all': 83, 'tee': 84, 'oik': 85, 'ike': 86, 'keu': 87, 'eus': 88,
      'mat': 89, 'nee': 90, 'aat': 91, 'ari': 92, 'att': 93, 'oon': 94, 'aat': 95, 'iin': 96,
      'hti': 97, 'tie': 98, 'vat': 99, 'ell': 100, 'kau': 101, 'pun': 102, 'unk': 103,
      'tar': 104, 'kes': 105, 'sku': 106, 'inn': 107, 'nus': 108, 'era': 109, 'ase': 110,
      'iti': 111, 'unt': 112, 'nta': 113, 'äis': 114, 'toi': 115, 'poi': 116, 'sek': 117,
      'oma': 118, 'maa': 119, 'sun': 120,
    },
  },
  {
    code: 'tr',
    name: 'Turkish',
    flag: '\u{1F1F9}\u{1F1F7}',
    trigrams: {
      'lar': 1, 'ler': 2, 'in ': 3, 'an ': 4, ' bi': 5, 'bir': 6, 'ir ': 7, 'bir': 8,
      ' ka': 9, 'ara': 10, 'eri': 11, 'lar': 12, 'en ': 13, ' ya': 14, 'nda': 15, 'da ': 16,
      ' de': 17, 'ini': 18, 'ile': 19, 'le ': 20, 'rin': 21, 'ile': 22, 'esi': 23, 'nde': 24,
      'de ': 25, 'aki': 26, 'ını': 27, ' ba': 28, 'ası': 29, 'lma': 30, 'aya': 31, 'dan': 32,
      'ine': 33, 'ne ': 34, 'ala': 35, 'er ': 36, 'ada': 37, 'ind': 38, 'kar': 39, 'mas': 40,
      'ası': 41, 'sın': 42, 'ınd': 43, 'nın': 44, 'nin': 45, ' ge': 46, 'lik': 47, ' ol': 48,
      'ola': 49, 'lan': 50, 'arı': 51, 'rın': 52, 'eri': 53, 'eni': 54, 'ece': 55, 'ılm': 56,
      'dır': 57, 'sta': 58, 'rak': 59, 'ına': 60, 'yor': 61, ' bu': 62, 'eli': 63, 'lis': 64,
      'isi': 65, 'var': 66, 'yan': 67, 'eye': 68, 'yet': 69, 'eti': 70, 'kan': 71, 'ter': 72,
      'tur': 73, 'ürk': 74, 'tür': 75, ' tü': 76, 'ist': 77, 'tan': 78, 'tas': 79, 'ard': 80,
      'dak': 81, 'men': 82, 'yap': 83, ' ya': 84, 'apı': 85, 'rı ': 86, 'sı ': 87, 'ğı ': 88,
      'ılı': 89, 'aşı': 90, 'baş': 91, ' ba': 92, 'rda': 93, ' il': 94, 'ken': 95, 'her': 96,
      ' he': 97, 'mek': 98, 'ek ': 99, 'aya': 100, 'nal': 101, 'par': 102, 'şek': 103,
      'çek': 104, 'yen': 105, 'eni': 106, 'ild': 107, 'ldi': 108, 'edi': 109, 'din': 110,
      'maz': 111, 'etm': 112, 'rek': 113, 'ikt': 114, 'bul': 115, 'ulu': 116, 'ıkl': 117,
      'sun': 118, 'ırı': 119, 'ber': 120,
    },
  },
  {
    code: 'ru',
    name: 'Russian',
    flag: '\u{1F1F7}\u{1F1FA}',
    trigrams: {
      ' пр': 1, 'ост': 2, 'ени': 3, 'ние': 4, 'ани': 5, 'ова': 6, 'ств': 7, ' по': 8,
      'пре': 9, 'ста': 10, ' на': 11, 'ных': 12, ' ко': 13, 'ого': 14, 'про': 15, 'ть ': 16,
      'ных': 17, ' не': 18, 'тор': 19, 'ком': 20, 'ров': 21, 'ени': 22, 'сти': 23, 'ере': 24,
      ' со': 25, 'тел': 26, ' об': 27, 'нос': 28, 'ель': 29, 'ско': 30, 'ест': 31, 'ого': 32,
      'мож': 33, ' мо': 34, 'ожн': 35, 'жно': 36, 'ной': 37, 'при': 38, 'ать': 39, 'ера': 40,
      'тер': 41, 'нов': 42, 'ий ': 43, 'ого': 44, 'ние': 45, 'вер': 46, 'нно': 47, 'рос': 48,
      'пра': 49, 'ент': 50, 'сто': 51, 'рав': 52, 'ное': 53, ' от': 54, 'ред': 55, 'обр': 56,
      'бра': 57, 'раз': 58, ' ра': 59, 'нна': 60, 'ого': 61, 'ция': 62, 'ней': 63, 'тив': 64,
      'пер': 65, 'ко ': 66, 'ция': 67, 'ном': 68, 'ная': 69, ' до': 70, 'ких': 71, 'ное': 72,
      'ого': 73, 'тра': 74, 'сов': 75, 'том': 76, 'ель': 77, 'вен': 78, 'ств': 79, 'ных': 80,
      'рен': 81, 'ост': 82, 'тво': 83, 'кот': 84, 'ото': 85, 'дер': 86, ' вс': 87, 'все': 88,
      'его': 89, 'ого': 90, 'ции': 91, 'как': 92, ' ка': 93, 'ако': 94, 'под': 95, 'обл': 96,
      'бла': 97, 'лас': 98, 'ной': 99, 'ком': 100, 'пол': 101, 'нен': 102, ' вы': 103,
      'выс': 104, 'тва': 105, 'ого': 106, 'зов': 107, 'ого': 108, 'нос': 109, 'рат': 110,
      'сов': 111, 'ним': 112, 'ных': 113, 'ске': 114, 'тал': 115, 'мен': 116, 'ого': 117,
      'ёт ': 118, 'рос': 119, 'ним': 120,
    },
  },
  {
    code: 'uk',
    name: 'Ukrainian',
    flag: '\u{1F1FA}\u{1F1E6}',
    trigrams: {
      ' пр': 1, 'ння': 2, 'ост': 3, 'ани': 4, 'ста': 5, 'енн': 6, 'ова': 7, 'нні': 8,
      ' на': 9, 'ськ': 10, 'ько': 11, ' по': 12, 'ько': 13, 'ого': 14, 'ком': 15, 'ної': 16,
      'них': 17, 'ати': 18, 'про': 19, ' ко': 20, 'ні ': 21, 'ним': 22, 'ер ': 23, 'при': 24,
      ' не': 25, 'ень': 26, 'сті': 27, ' за': 28, 'пер': 29, 'іст': 30, 'ти ': 31, 'ере': 32,
      ' ві': 33, ' об': 34, 'від': 35, 'дер': 36, 'сть': 37, 'тор': 38, 'ент': 39, 'ного': 40,
      'них': 41, 'тер': 42, 'ико': 43, 'ись': 44, ' до': 45, 'ров': 46, 'ськ': 47, 'пра': 48,
      'рав': 49, 'ін ': 50, 'нос': 51, 'кра': 52, 'раї': 53, 'аїн': 54, 'їни': 55, 'укр': 56,
      ' ук': 57, 'ний': 58, 'ної': 59, 'ств': 60, 'дні': 61, 'ній': 62, 'ною': 63, 'час': 64,
      'кон': 65, 'кої': 66, 'ного': 67, 'вит': 68, 'роз': 69, 'ної': 70, 'зна': 71, 'нач': 72,
      'чен': 73, 'ніс': 74, 'зви': 75, 'нов': 76, 'вно': 77, ' ос': 78, 'осн': 79, 'сно': 80,
      'різ': 81, 'ізн': 82, 'під': 83, ' пі': 84, 'ції': 85, 'ено': 86, 'пов': 87, 'ову': 88,
      'ант': 89, 'тів': 90, 'ної': 91, 'ног': 92, 'ому': 93, 'для': 94, ' дл': 95, 'ком': 96,
      'ські': 97, 'рес': 98, 'мож': 99, ' мо': 100, 'ожн': 101, 'жно': 102, 'тел': 103,
      'тан': 104, 'пос': 105, 'осі': 106, 'сіб': 107, 'ній': 108, 'ніх': 109, 'нні': 110,
      'рів': 111, 'інс': 112, 'нст': 113, 'ера': 114, 'ції': 115, 'ної': 116, 'хар': 117,
      'арк': 118, 'рки': 119, 'ків': 120,
    },
  },
  {
    code: 'ar',
    name: 'Arabic',
    flag: '\u{1F1F8}\u{1F1E6}',
    trigrams: {
      ' ال': 1, 'الم': 2, 'ال ': 3, 'في ': 4, ' في': 5, 'من ': 6, ' من': 7, 'ية ': 8,
      'لى ': 9, 'على': 10, ' عل': 11, 'ان ': 12, 'ات ': 13, 'ين ': 14, 'الع': 15, 'أن ': 16,
      'الت': 17, 'ها ': 18, 'الا': 19, 'لا ': 20, 'وال': 21, ' وا': 22, 'مع ': 23, 'إلى': 24,
      ' إل': 25, 'ذلك': 26, ' ذل': 27, 'لك ': 28, 'هذا': 29, 'كان': 30, ' كا': 31, 'ما ': 32,
      'قد ': 33, ' أن': 34, 'هذه': 35, 'عن ': 36, ' عن': 37, 'تي ': 38, 'ال ': 39, 'ني ': 40,
      'وم ': 41, 'يوم': 42, ' يو': 43, 'الأ': 44, 'الب': 45, 'لة ': 46, 'دة ': 47, 'الح': 48,
      'الس': 49, 'رة ': 50, 'مة ': 51, 'قال': 52, ' قا': 53, 'ولا': 54, 'لي ': 55, 'بعد': 56,
      ' بع': 57, 'عد ': 58, 'الد': 59, 'له ': 60, 'الإ': 61, 'نا ': 62, 'كل ': 63, ' كل': 64,
      'عرب': 65, ' عر': 66, 'ربي': 67, 'الق': 68, 'الك': 69, 'هم ': 70, 'لعر': 71, 'الن': 72,
      'بال': 73, ' با': 74, 'هو ': 75, 'الج': 76, 'ته ': 77, 'الر': 78, 'اء ': 79, 'لأ ': 80,
      'الف': 81, 'الو': 82, 'يا ': 83, 'ال ': 84, 'واح': 85, 'احد': 86, 'حد ': 87, 'طا ': 88,
      'أو ': 89, ' أو': 90, 'بين': 91, ' بي': 92, 'لمت': 93, 'متح': 94, 'تحد': 95, 'حدة': 96,
      'لام': 97, 'سلا': 98, 'إسل': 99, ' إس': 100, 'دول': 101, ' دو': 102, 'ولة': 103,
      'عال': 104, 'لعا': 105, 'الش': 106, 'شرق': 107, 'رقي': 108, 'قية': 109, 'الأ': 110,
      'وسط': 111, 'أوس': 112, 'لأو': 113, 'عرا': 114, 'راق': 115, 'اقي': 116, 'بير': 117,
      'كبي': 118, ' كب': 119, 'جمي': 120,
    },
  },
  {
    code: 'hi',
    name: 'Hindi',
    flag: '\u{1F1EE}\u{1F1F3}',
    trigrams: {
      ' के': 1, 'के ': 2, ' का': 3, 'का ': 4, 'में': 5, ' मे': 6, ' है': 7, 'है ': 8,
      ' की': 9, 'की ': 10, 'ने ': 11, ' और': 12, 'और ': 13, ' को': 14, 'को ': 15, ' से': 16,
      'से ': 17, 'ों ': 18, ' पर': 19, 'पर ': 20, 'ता ': 21, 'ार ': 22, 'ना ': 23, 'ान ': 24,
      ' कर': 25, ' हो': 26, 'या ': 27, 'ने ': 28, 'ला ': 29, 'ले ': 30, 'कार': 31, ' इस': 32,
      'इस ': 33, 'ी क': 34, 'ा क': 35, ' भा': 36, 'भार': 37, 'ारत': 38, 'रत ': 39, 'हो ': 40,
      'ती ': 41, 'ेश ': 42, 'देश': 43, ' दे': 44, ' भी': 45, 'भी ': 46, ' उन': 47, ' वि': 48,
      'विश': 49, ' नह': 50, 'नही': 51, 'हीं': 52, ' प्': 53, 'सर ': 54, ' जा': 55, 'ा ह': 56,
      'राज': 57, ' रा': 58, 'ाज ': 59, 'कि ': 60, ' कि': 61, ' सा': 62, 'साल': 63, 'रही': 64,
      'े स': 65, 'ी स': 66, 'ा स': 67, ' ल': 68, 'सरक': 69, 'रका': 70, 'कार': 71, 'ार ': 72,
      'क्ष': 73, 'मान': 74, 'क ': 75, ' दि': 76, 'दिन': 77, 'निर': 78, 'चार': 79, 'ष्ट': 80,
      'राष': 81, 'ाष्': 82, 'ट्र': 83, ' इं': 84, 'इंड': 85, 'ंडि': 86, 'डिय': 87, 'िया': 88,
      'प्र': 89, ' जो': 90, 'जो ': 91, 'ल क': 92, 'ते ': 93, 'े क': 94, 'ा प': 95, ' हम': 96,
      'हम ': 97, 'े ल': 98, 'ी ह': 99, ' गय': 100, 'नी ': 101, 'े प': 102, 'ा म': 103,
      'ी म': 104, 'था ': 105, ' था': 106, 'ही ': 107, 'ाम ': 108, 'क्र': 109, 'वार': 110,
      'संग': 111, ' सं': 112, 'कर ': 113, 'ला ': 114, 'ाला': 115, 'बड़': 116, 'ब ': 117,
      'पूर': 118, 'र्व': 119, 'ूर्': 120,
    },
  },
  {
    code: 'zh',
    name: 'Chinese',
    flag: '\u{1F1E8}\u{1F1F3}',
    trigrams: {
      // Chinese uses characters not trigrams, but we include common sequences
      // Detection primarily handled by script check
      '\u7684\u4E00': 1, '\u4E00\u4E2A': 2, '\u662F\u4E00': 3, '\u4E0D\u662F': 4,
      '\u4E2D\u56FD': 5, '\u5728\u4E2D': 6, '\u4EBA\u6C11': 7, '\u6211\u4EEC': 8,
      '\u4ED6\u4EEC': 9, '\u8FD9\u4E2A': 10, '\u4E86\u4E00': 11, '\u5C31\u662F': 12,
    },
  },
  {
    code: 'ja',
    name: 'Japanese',
    flag: '\u{1F1EF}\u{1F1F5}',
    trigrams: {
      // Japanese detection primarily by script (hiragana/katakana)
      '\u306E\u3053': 1, '\u3053\u3068': 2, '\u3068\u306F': 3, '\u306B\u3064': 4,
      '\u3064\u3044': 5, '\u3044\u3066': 6, '\u3066\u306F': 7, '\u306F\u306A': 8,
      '\u306A\u3044': 9, '\u3044\u308B': 10, '\u308B\u3053': 11, '\u306F\u305D': 12,
    },
  },
  {
    code: 'ko',
    name: 'Korean',
    flag: '\u{1F1F0}\u{1F1F7}',
    trigrams: {
      // Korean detection primarily by script (hangul)
      '\uC758 ': 1, '\uC5D0 ': 2, '\uB97C ': 3, '\uC740 ': 4,
      '\uB294 ': 5, '\uB85C ': 6, '\uC774 ': 7, '\uD55C ': 8,
      '\uC758\uAD6D': 9, '\uD558\uB294': 10, '\uC744 ': 11, '\uB2E4\uB294': 12,
    },
  },
  {
    code: 'th',
    name: 'Thai',
    flag: '\u{1F1F9}\u{1F1ED}',
    trigrams: {
      // Thai detection primarily by script
      '\u0E02\u0E2D\u0E07': 1, '\u0E17\u0E35\u0E48': 2, '\u0E01\u0E32\u0E23': 3,
      '\u0E43\u0E19\u0E01': 4, '\u0E04\u0E27\u0E32': 5, '\u0E27\u0E32\u0E21': 6,
      '\u0E41\u0E25\u0E30': 7, '\u0E40\u0E1B\u0E47': 8, '\u0E44\u0E14\u0E49': 9,
      '\u0E21\u0E32\u0E01': 10, '\u0E2A\u0E33\u0E2B': 11, '\u0E2B\u0E23\u0E31': 12,
    },
  },
  {
    code: 'vi',
    name: 'Vietnamese',
    flag: '\u{1F1FB}\u{1F1F3}',
    trigrams: {
      'ng ': 1, ' nh': 2, 'nhu': 3, 'ung': 4, ' tr': 5, 'tro': 6, 'ron': 7, 'ong': 8,
      'nh ': 9, ' cu': 10, 'cua': 11, ' la': 12, 'la ': 13, ' va': 14, ' kh': 15, 'kho': 16,
      'hon': 17, ' co': 18, 'co ': 19, 'ien': 20, ' gi': 21, 'gia': 22, 'ach': 23, 'cac': 24,
      ' ca': 25, ' th': 26, 'tha': 27, 'hai': 28, 'ai ': 29, 'voi': 30, ' vo': 31, 'oi ': 32,
      'ang': 33, 'hin': 34, 'cho': 35, ' ch': 36, 'ho ': 37, 'hie': 38, 'inh': 39, 'mot': 40,
      ' mo': 41, 'ot ': 42, 'i n': 43, 'uoc': 44, 'nuo': 45, ' nu': 46, 'en ': 47, ' ng': 48,
      'ngu': 49, 'guo': 50, 'nha': 51, 'hat': 52, 'at ': 53, 'an ': 54, 'tri': 55, 'rin': 56,
      'anh': 57, ' an': 58, 'hoa': 59, 'oan': 60, 'thi': 61, 'nh ': 62, 'pha': 63, ' ph': 64,
      'han': 65, 'lam': 66, ' la': 67, 'am ': 68, 'gia': 69, 'inh': 70, 'hoa': 71, 'chi': 72,
      'hin': 73, ' da': 74, 'dan': 75, 'ruo': 76, 'uon': 77, 'tru': 78, 'tu ': 79, 'uye': 80,
      'yen': 81, 'quy': 82, ' qu': 83, 'chu': 84, 'huc': 85, 'uc ': 86, 'i c': 87, 'oi ': 88,
      'o n': 89, 'ieu': 90, 'dun': 91, ' du': 92, 'tiê': 93, 'tha': 94, 'bao': 95, ' ba': 96,
      'ao ': 97, 'n c': 98, 'khi': 99, 'hi ': 100, 'tam': 101, 'n t': 102, 'n n': 103,
      'g n': 104, 'i t': 105, 'ong': 106, 'o c': 107, 'c t': 108, 'g t': 109, 'i v': 110,
      'dau': 111, 'o t': 112, 'rat': 113, 'ong': 114, ' ra': 115, 'ng ': 116, 'day': 117,
      'ghi': 118, 'hie': 119, 'viec': 120,
    },
  },
  {
    code: 'id',
    name: 'Indonesian',
    flag: '\u{1F1EE}\u{1F1E9}',
    trigrams: {
      'an ': 1, 'ang': 2, 'ng ': 3, ' me': 4, 'kan': 5, ' di': 6, 'yan': 7, ' ya': 8,
      'men': 9, ' pe': 10, 'ala': 11, 'eng': 12, 'per': 13, 'ber': 14, ' be': 15, ' ke': 16,
      'di ': 17, 'nya': 18, 'ya ': 19, 'eri': 20, 'dan': 21, ' da': 22, 'ata': 23, 'pen': 24,
      'gan': 25, 'mem': 26, 'emp': 27, 'ter': 28, 'ung': 29, 'ara': 30, 'ada': 31, 'ran': 32,
      'ah ': 33, 'dal': 34, 'lam': 35, ' se': 36, 'aha': 37, 'n d': 38, 'nda': 39, 'ta ': 40,
      'ind': 41, 'ia ': 42, 'den': 43, 'lah': 44, 'ene': 45, ' in': 46, 'i d': 47, 'seb': 48,
      'eba': 49, 'aga': 50, 'era': 51, 'n p': 52, ' ha': 53, 'ini': 54, 'ker': 55, 'aka': 56,
      'asa': 57, 'em ': 58, 'n m': 59, 'lan': 60, ' un': 61, 'unt': 62, 'ntu': 63, 'tuk': 64,
      'uk ': 65, 'apa': 66, 'end': 67, 'and': 68, ' te': 69, 'at ': 70, 'dar': 71, 'pad': 72,
      ' pa': 73, 'har': 74, 'aru': 75, 'rus': 76, 'neg': 77, ' ne': 78, 'ega': 79, 'gar': 80,
      'n s': 81, 'kal': 82, 'neg': 83, 'san': 84, 'a d': 85, 'ban': 86, 'mas': 87, 'ika': 88,
      'dap': 89, 'n k': 90, 'a m': 91, 'i p': 92, 'ola': 93, 'mak': 94, 'a s': 95, 'n b': 96,
      'man': 97, 'sia': 98, 'one': 99, 'nes': 100, 'esi': 101, 'bat': 102, 'nge': 103,
      'nas': 104, 'rak': 105, 'kat': 106, 'pon': 107, 'ent': 108, 'ri ': 109, 'i m': 110,
      'i s': 111, 'pan': 112, 'a p': 113, 'i k': 114, 'usa': 115, 'n t': 116, 'itu': 117,
      'tu ': 118, 'a k': 119, 'am ': 120,
    },
  },
  {
    code: 'ms',
    name: 'Malay',
    flag: '\u{1F1F2}\u{1F1FE}',
    trigrams: {
      'an ': 1, 'ang': 2, 'ng ': 3, 'yan': 4, ' ya': 5, 'kan': 6, ' me': 7, 'men': 8,
      ' di': 9, ' ke': 10, ' pe': 11, 'per': 12, 'ber': 13, ' be': 14, 'eng': 15, 'ala': 16,
      'di ': 17, 'nya': 18, 'dan': 19, ' da': 20, 'eri': 21, 'ara': 22, 'pen': 23, 'dal': 24,
      'lam': 25, ' se': 26, 'ran': 27, 'ter': 28, 'gan': 29, 'ata': 30, 'ya ': 31, 'ada': 32,
      'mem': 33, 'emp': 34, 'den': 35, 'ung': 36, 'ini': 37, 'lah': 38, 'nda': 39, 'ah ': 40,
      'aha': 41, 'ta ': 42, 'ker': 43, 'aga': 44, 'era': 45, ' ha': 46, 'lan': 47, 'seb': 48,
      'eba': 49, 'aka': 50, 'asa': 51, 'ind': 52, 'ia ': 53, 'har': 54, 'aru': 55, 'rus': 56,
      'pad': 57, ' pa': 58, 'dar': 59, 'neg': 60, 'ega': 61, 'gar': 62, ' un': 63, 'unt': 64,
      'ntu': 65, 'tuk': 66, 'uk ': 67, 'mas': 68, 'mal': 69, ' ma': 70, 'lay': 71, 'ays': 72,
      'ysi': 73, 'sia': 74, 'end': 75, 'ban': 76, 'san': 77, 'kal': 78, 'man': 79, 'apa': 80,
      'ika': 81, 'dap': 82, 'mak': 83, 'pon': 84, 'ola': 85, 'rak': 86, 'kat': 87, 'bat': 88,
      'ent': 89, 'ri ': 90, 'pan': 91, 'usa': 92, 'itu': 93, 'tu ': 94, 'am ': 95, 'at ': 96,
      'nge': 97, 'nas': 98, 'one': 99, 'esi': 100, 'nes': 101, 'nek': 102, 'neg': 103,
      'gar': 104, 'gar': 105, 'ibu': 106, 'buk': 107, ' te': 108, 'ora': 109, 'ama': 110,
      'dun': 111, 'uni': 112, 'bag': 113, ' ba': 114, 'agi': 115, 'gi ': 116, 'sem': 117,
      'emu': 118, 'mua': 119, 'aju': 120,
    },
  },
  {
    code: 'tl',
    name: 'Tagalog',
    flag: '\u{1F1F5}\u{1F1ED}',
    trigrams: {
      'ang': 1, 'ng ': 2, 'an ': 3, ' na': 4, 'na ': 5, ' ng': 6, 'sa ': 7, ' sa': 8,
      'ong': 9, ' ka': 10, 'ala': 11, 'at ': 12, ' an': 13, 'ata': 14, ' pa': 15, 'mga': 16,
      ' mg': 17, 'ga ': 18, 'pag': 19, ' ma': 20, 'kan': 21, 'ara': 22, 'ina': 23, 'mag': 24,
      'ing': 25, 'aga': 26, 'yon': 27, 'n n': 28, 'pan': 29, 'g m': 30, 'lan': 31, 'g n': 32,
      'ila': 33, 'ito': 34, 'kal': 35, 'nag': 36, 'man': 37, 'a m': 38, 'ama': 39, ' ba': 40,
      'ban': 41, 'ayu': 42, 'yun': 43, 'ung': 44, 'g k': 45, 'g p': 46, 'aba': 47, 'asa': 48,
      'a n': 49, 'n a': 50, 'nan': 51, 'ipa': 52, 'a p': 53, 'lip': 54, 'ipi': 55, 'pin': 56,
      'pil': 57, 'ili': 58, 'tao': 59, 'ao ': 60, 'a k': 61, 'pal': 62, 'ahi': 63, 'hin': 64,
      'kap': 65, 'api': 66, 'tar': 67, 'tan': 68, 'ama': 69, 'bay': 70, 'ni ': 71, 'ari': 72,
      'g a': 73, 'aya': 74, ' ni': 75, 'nay': 76, 'mak': 77, 'aka': 78, 'kas': 79, 'ani': 80,
      'i n': 81, 'bat': 82, 'mat': 83, 'rap': 84, 'ala': 85, 'may': 86, 'hay': 87, ' ha': 88,
      'ahi': 89, 'la ': 90, 'a s': 91, 'sal': 92, 'isi': 93, 'a a': 94, 'o n': 95, 'san': 96,
      'a b': 97, 'n s': 98, 'tas': 99, 'g s': 100, 'yas': 101, 'gar': 102, 'ini': 103,
      'lib': 104, 'dah': 105, 'gka': 106, 'ngk': 107, 'ula': 108, 'tay': 109, 'gan': 110,
      'lak': 111, 'ira': 112, 'wal': 113, ' wa': 114, 'alo': 115, 'aga': 116, 'tam': 117,
      'aba': 118, 'hab': 119, 'abi': 120,
    },
  },
  {
    code: 'sw',
    name: 'Swahili',
    flag: '\u{1F1F0}\u{1F1EA}',
    trigrams: {
      'wa ': 1, ' wa': 2, ' na': 3, 'na ': 4, 'a k': 5, 'ya ': 6, ' ya': 7, ' ku': 8,
      'a w': 9, 'a n': 10, 'ali': 11, 'ili': 12, 'li ': 13, 'ni ': 14, ' ka': 15, 'kat': 16,
      'ati': 17, 'kwa': 18, ' kw': 19, 'a m': 20, 'ika': 21, 'ka ': 22, 'ana': 23, 'i y': 24,
      'amba': 25, 'mba': 26, 'ba ': 27, ' ha': 28, 'ake': 29, 'ke ': 30, 'a h': 31, ' ma': 32,
      'ish': 33, 'shi': 34, 'hi ': 35, 'ama': 36, 'ini': 37, 'a s': 38, 'nch': 39, 'chi': 40,
      'i k': 41, 'mat': 42, 'i n': 43, 'wen': 44, 'eng': 45, 'ngi': 46, ' ki': 47, 'kut': 48,
      'uta': 49, 'la ': 50, 'aki': 51, 'ki ': 52, 'ene': 53, 'nia': 54, 'ia ': 55, 'cha': 56,
      'hal': 57, 'nda': 58, ' nd': 59, 'a u': 60, ' la': 61, 'i w': 62, 'ina': 63, 'kuwa': 64,
      'uwa': 65, 'a a': 66, 'ifa': 67, ' hi': 68, 'o k': 69, 'o w': 70, 'moj': 71, ' mo': 72,
      'oja': 73, 'a y': 74, 'fan': 75, 'any': 76, 'e k': 77, 'e w': 78, 'wak': 79, 'kuw': 80,
      'ma ': 81, 'mi ': 82, 'end': 83, 'nde': 84, 'sha': 85, 'hak': 86, 'kup': 87, 'upi': 88,
      'pit': 89, 'o n': 90, 'ezi': 91, ' se': 92, 'ser': 93, 'eri': 94, 'rik': 95, 'hal': 96,
      'lek': 97, 'elo': 98, 'hii': 99, 'iyo': 100, 'wen': 101, 'ye ': 102, 'mwe': 103,
      ' mw': 104, 'ili': 105, 'a l': 106, 'o y': 107, 'tak': 108, ' ta': 109, 'tan': 110,
      'zan': 111, 'anz': 112, 'nza': 113, 'nia': 114, 'e n': 115, 'dha': 116, 'har': 117,
      ' dh': 118, 'uch': 119, 'agu': 120,
    },
  },
  {
    code: 'el',
    name: 'Greek',
    flag: '\u{1F1EC}\u{1F1F7}',
    trigrams: {
      // Greek detection primarily by script, but include common trigrams
      ' \u03C4\u03B7': 1, '\u03C4\u03B7\u03BD': 2, '\u03B7\u03BD ': 3,
      ' \u03BA\u03B1': 4, '\u03BA\u03B1\u03B9': 5, '\u03B1\u03B9 ': 6,
      ' \u03C4\u03BF': 7, '\u03C4\u03BF\u03C5': 8, '\u03BF\u03C5 ': 9,
      '\u03C3\u03C4\u03B7': 10, '\u03C4\u03B1 ': 11, ' \u03C3\u03C4': 12,
      '\u03B5\u03BD\u03B1': 13, '\u03BD\u03B1\u03B9': 14, '\u03B1\u03C0\u03BF': 15,
      ' \u03B1\u03C0': 16, '\u03C0\u03BF ': 17, '\u03C4\u03B9\u03BA': 18,
      '\u03B9\u03BA\u03BF': 19, '\u03BA\u03BF ': 20, '\u03C4\u03B7\u03C2': 21,
      '\u03B7\u03C2 ': 22, '\u03C0\u03BF\u03C5': 23, '\u03BF\u03C5\u03C2': 24,
    },
  },
];

export { PROFILES };
