/**
 * Address Parser — pure heuristic address parsing engine.
 * Evolved from 2,000 real-world address examples across US, UK, EU, and JP formats.
 * Handles street addresses, PO Boxes, units/suites, and international formats.
 */

export interface ParsedAddress {
  street: string;
  unit: string | null;
  city: string;
  state: string | null;
  zip: string | null;
  country: string | null;
  formatted: string;
  confidence: number;
  format: 'us' | 'uk' | 'eu' | 'jp' | 'generic';
}

// ── US State abbreviations ──────────────────────────────────────────

const US_STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia', PR: 'Puerto Rico', GU: 'Guam', VI: 'Virgin Islands',
  AS: 'American Samoa', MP: 'Northern Mariana Islands',
};

// Reverse: full name → abbreviation
const STATE_NAME_TO_ABBR: Record<string, string> = {};
for (const [abbr, name] of Object.entries(US_STATES)) {
  STATE_NAME_TO_ABBR[name.toLowerCase()] = abbr;
}

// ── Street type abbreviations ───────────────────────────────────────

const STREET_TYPES: Record<string, string> = {
  st: 'Street', str: 'Street', street: 'Street',
  ave: 'Avenue', av: 'Avenue', avenue: 'Avenue',
  blvd: 'Boulevard', boulevard: 'Boulevard',
  dr: 'Drive', drv: 'Drive', drive: 'Drive',
  ln: 'Lane', lane: 'Lane',
  ct: 'Court', court: 'Court',
  rd: 'Road', road: 'Road',
  pl: 'Place', place: 'Place',
  way: 'Way',
  cir: 'Circle', circle: 'Circle',
  hwy: 'Highway', highway: 'Highway',
  pkwy: 'Parkway', parkway: 'Parkway',
  ter: 'Terrace', terrace: 'Terrace',
  trl: 'Trail', trail: 'Trail',
  sq: 'Square', square: 'Square',
};

// ── Unit type patterns ──────────────────────────────────────────────

const UNIT_PATTERNS = [
  /\b(?:apt|apartment)\.?\s*#?\s*(\S+)/i,
  /\b(?:ste|suite)\.?\s*#?\s*(\S+)/i,
  /\b(?:unit)\.?\s*#?\s*(\S+)/i,
  /\b(?:fl|floor)\.?\s*#?\s*(\S+)/i,
  /\b(?:rm|room)\.?\s*#?\s*(\S+)/i,
  /\b(?:bldg|building)\.?\s*#?\s*(\S+)/i,
  /\b#\s*(\S+)/i,
  /\b(?:flat)\s+(\S+)/i,
];

// ── Country detection ───────────────────────────────────────────────

const COUNTRY_ALIASES: Record<string, string> = {
  us: 'United States', usa: 'United States', 'united states': 'United States',
  'united states of america': 'United States',
  uk: 'United Kingdom', 'united kingdom': 'United Kingdom', 'great britain': 'United Kingdom',
  gb: 'United Kingdom', england: 'United Kingdom',
  germany: 'Germany', deutschland: 'Germany', de: 'Germany',
  france: 'France', fr: 'France',
  italy: 'Italy', italia: 'Italy', it: 'Italy',
  spain: 'Spain', espana: 'Spain', es: 'Spain',
  netherlands: 'Netherlands', nl: 'Netherlands', 'the netherlands': 'Netherlands',
  belgium: 'Belgium', be: 'Belgium',
  austria: 'Austria', at: 'Austria',
  switzerland: 'Switzerland', ch: 'Switzerland',
  japan: 'Japan', jp: 'Japan',
  canada: 'Canada', ca: 'Canada',
  australia: 'Australia', au: 'Australia',
  sweden: 'Sweden', se: 'Sweden',
  norway: 'Norway', no: 'Norway',
  denmark: 'Denmark', dk: 'Denmark',
  finland: 'Finland', fi: 'Finland',
  portugal: 'Portugal', pt: 'Portugal',
  poland: 'Poland', pl: 'Poland',
  'czech republic': 'Czech Republic', cz: 'Czech Republic', czechia: 'Czech Republic',
};

// ── EU country postal code patterns ─────────────────────────────────

const EU_POSTAL_PATTERNS: { regex: RegExp; country: string }[] = [
  { regex: /^\d{5}$/, country: 'Germany' },   // 10117 — also France, Italy, Spain
  { regex: /^\d{4}$/, country: 'Netherlands' }, // also Belgium, Switzerland, Austria, Denmark, Norway, Sweden
  { regex: /^\d{3}\s?\d{2}$/, country: 'Sweden' }, // 123 45
  { regex: /^\d{2}-\d{3}$/, country: 'Poland' }, // 00-950
];

// ── Japanese prefectures ────────────────────────────────────────────

const JP_PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
];

// ── Helpers ──────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function stripTrailingPunctuation(s: string): string {
  return s.replace(/[.,;]+$/, '').trim();
}

function extractUnit(street: string): { street: string; unit: string | null } {
  for (const pat of UNIT_PATTERNS) {
    const m = street.match(pat);
    if (m) {
      const unitValue = m[1].replace(/,$/, '');
      const cleaned = street.replace(m[0], '').replace(/,\s*,/g, ',').trim();
      return { street: stripTrailingPunctuation(normalize(cleaned)), unit: unitValue };
    }
  }
  return { street, unit: null };
}

function resolveState(token: string): string | null {
  const upper = token.toUpperCase();
  if (US_STATES[upper]) return upper;
  const fromName = STATE_NAME_TO_ABBR[token.toLowerCase()];
  if (fromName) return fromName;
  return null;
}

function resolveCountry(token: string): string | null {
  const lower = token.toLowerCase().trim();
  return COUNTRY_ALIASES[lower] ?? null;
}

function hasJapaneseChars(s: string): boolean {
  return /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\u3400-\u4dbf]/.test(s);
}

// ── Format detection ────────────────────────────────────────────────

function detectFormat(input: string): 'us' | 'uk' | 'eu' | 'jp' | 'generic' {
  // Japanese: has CJK characters or 〒 postal code
  if (hasJapaneseChars(input) || /〒\s?\d{3}-?\d{4}/.test(input)) return 'jp';

  // UK: postcode pattern (A9 9AA, A99 9AA, A9A 9AA, AA9 9AA, AA99 9AA, AA9A 9AA)
  if (/\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/i.test(input)) return 'uk';

  // US: 5-digit or 5+4 ZIP
  if (/\b\d{5}(?:-\d{4})?\b/.test(input)) {
    // Could also be EU 5-digit. Check for state abbreviation to confirm US.
    const hasState = Object.keys(US_STATES).some(abbr =>
      new RegExp(`\\b${abbr}\\b`).test(input)
    );
    if (hasState) return 'us';
    // Check for US state full names
    const hasStateName = Object.keys(STATE_NAME_TO_ABBR).some(name =>
      input.toLowerCase().includes(name)
    );
    if (hasStateName) return 'us';
    // Check for PO Box — definitely US pattern
    if (/\bP\.?O\.?\s*Box\b/i.test(input)) return 'us';
  }

  // EU: various postal code patterns + known EU country names
  const euCountries = ['germany', 'france', 'italy', 'spain', 'netherlands', 'belgium',
    'austria', 'switzerland', 'sweden', 'norway', 'denmark', 'finland', 'portugal',
    'poland', 'czech republic', 'czechia', 'deutschland', 'italia', 'espana'];
  const lower = input.toLowerCase();
  if (euCountries.some(c => lower.includes(c))) return 'eu';

  // EU street patterns: "Straße", "straße", "Rue", "Via", "Straat"
  if (/(?:stra[sß]e|rue\s|via\s|straat|gatan|gade|katu|rua\s)/i.test(input)) return 'eu';

  // EU postal code before city: "10117 Berlin"
  if (/\b\d{4,5}\s+[A-Z][a-z]/.test(input)) return 'eu';

  // US fallback: has a state abbreviation
  const usStateMatch = input.match(/\b([A-Z]{2})\b/);
  if (usStateMatch && US_STATES[usStateMatch[1]]) return 'us';

  return 'generic';
}

// ── US parser ───────────────────────────────────────────────────────

function parseUS(input: string): ParsedAddress | null {
  const trimmed = normalize(input);

  // PO Box pattern: PO Box 1234, City, ST 12345
  const poMatch = trimmed.match(
    /^(P\.?O\.?\s*Box\s+\d+)\s*,\s*(.+?)(?:\s*,)?\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i
  );
  if (poMatch) {
    return {
      street: poMatch[1].replace(/\./g, ''),
      unit: null,
      city: stripTrailingPunctuation(poMatch[2]),
      state: poMatch[3].toUpperCase(),
      zip: poMatch[4],
      country: 'United States',
      formatted: '',
      confidence: 0.95,
      format: 'us',
    };
  }

  // Standard US: number street [unit], city, STATE ZIP
  // Try: street, city, ST ZIP or street, city ST ZIP
  const fullMatch = trimmed.match(
    /^(.+?)\s*,\s*(.+?)(?:\s*,)?\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i
  );
  if (fullMatch) {
    const { street, unit } = extractUnit(fullMatch[1]);
    const stateAbbr = fullMatch[3].toUpperCase();
    if (US_STATES[stateAbbr]) {
      return {
        street: stripTrailingPunctuation(street),
        unit,
        city: stripTrailingPunctuation(fullMatch[2]),
        state: stateAbbr,
        zip: fullMatch[4],
        country: 'United States',
        formatted: '',
        confidence: 0.95,
        format: 'us',
      };
    }
  }

  // Try with full state name: street, city, California 94102
  const fullStateMatch = trimmed.match(
    /^(.+?)\s*,\s*(.+?)\s*,\s*([A-Za-z\s]+?)\s+(\d{5}(?:-\d{4})?)$/
  );
  if (fullStateMatch) {
    const stateName = fullStateMatch[3].trim();
    const stateAbbr = resolveState(stateName);
    if (stateAbbr) {
      const { street, unit } = extractUnit(fullStateMatch[1]);
      return {
        street: stripTrailingPunctuation(street),
        unit,
        city: stripTrailingPunctuation(fullStateMatch[2]),
        state: stateAbbr,
        zip: fullStateMatch[4],
        country: 'United States',
        formatted: '',
        confidence: 0.93,
        format: 'us',
      };
    }
  }

  // Minimal US: street, city, ST (no zip)
  const noZipMatch = trimmed.match(/^(.+?)\s*,\s*(.+?)\s*,\s*([A-Z]{2})$/i);
  if (noZipMatch) {
    const stateAbbr = noZipMatch[3].toUpperCase();
    if (US_STATES[stateAbbr]) {
      const { street, unit } = extractUnit(noZipMatch[1]);
      return {
        street: stripTrailingPunctuation(street),
        unit,
        city: stripTrailingPunctuation(noZipMatch[2]),
        state: stateAbbr,
        zip: null,
        country: 'United States',
        formatted: '',
        confidence: 0.8,
        format: 'us',
      };
    }
  }

  return null;
}

// ── UK parser ───────────────────────────────────────────────────────

function parseUK(input: string): ParsedAddress | null {
  const trimmed = normalize(input);

  // UK postcode: A9 9AA, A99 9AA, A9A 9AA, AA9 9AA, AA99 9AA, AA9A 9AA
  const postcodeRegex = /\b([A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b/i;
  const pcMatch = trimmed.match(postcodeRegex);
  if (!pcMatch) return null;

  const postcode = pcMatch[1].toUpperCase();
  // Remove postcode from the string
  let rest = trimmed.replace(postcodeRegex, '').trim();

  // Remove trailing country if present
  let country: string | null = 'United Kingdom';
  const countryMatch = rest.match(/,?\s*(UK|United Kingdom|Great Britain|England|Scotland|Wales|Northern Ireland)$/i);
  if (countryMatch) {
    rest = rest.slice(0, -countryMatch[0].length).trim();
  }

  // Split by comma
  const parts = rest.split(',').map(p => p.trim()).filter(Boolean);

  if (parts.length === 0) return null;

  // Check for "Flat X" at the beginning
  let unit: string | null = null;
  let streetParts = parts;

  if (parts[0] && /^flat\s+/i.test(parts[0])) {
    const flatMatch = parts[0].match(/^flat\s+(\S+)/i);
    if (flatMatch) {
      unit = flatMatch[1];
      // The rest of parts[0] after "Flat X" might have more, or next part is street
      const afterFlat = parts[0].replace(/^flat\s+\S+\s*/i, '').trim();
      if (afterFlat) {
        streetParts = [afterFlat, ...parts.slice(1)];
      } else {
        streetParts = parts.slice(1);
      }
    }
  }

  // Last part is city, everything before is street
  if (streetParts.length >= 2) {
    const city = stripTrailingPunctuation(streetParts[streetParts.length - 1]);
    const street = streetParts.slice(0, -1).join(', ');

    if (!unit) {
      const extracted = extractUnit(street);
      return {
        street: stripTrailingPunctuation(extracted.street),
        unit: extracted.unit,
        city,
        state: null,
        zip: postcode,
        country,
        formatted: '',
        confidence: 0.9,
        format: 'uk',
      };
    }

    return {
      street: stripTrailingPunctuation(street),
      unit,
      city,
      state: null,
      zip: postcode,
      country,
      formatted: '',
      confidence: 0.9,
      format: 'uk',
    };
  }

  // Single part: treat as street, city unknown
  if (streetParts.length === 1) {
    return {
      street: stripTrailingPunctuation(streetParts[0]),
      unit,
      city: '',
      state: null,
      zip: postcode,
      country,
      formatted: '',
      confidence: 0.7,
      format: 'uk',
    };
  }

  return null;
}

// ── EU parser ───────────────────────────────────────────────────────

function parseEU(input: string): ParsedAddress | null {
  const trimmed = normalize(input);

  // Try to extract trailing country
  let country: string | null = null;
  let rest = trimmed;

  // Check if last comma-separated token is a country
  const parts = trimmed.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    const resolved = resolveCountry(lastPart);
    if (resolved) {
      country = resolved;
      rest = parts.slice(0, -1).join(', ');
    }
  }

  // German pattern: "Friedrichstraße 123, 10117 Berlin"
  const germanMatch = rest.match(/^(.+?)\s*,\s*(\d{4,5})\s+(.+)$/);
  if (germanMatch) {
    const { street, unit } = extractUnit(germanMatch[1]);
    return {
      street: stripTrailingPunctuation(street),
      unit,
      city: stripTrailingPunctuation(germanMatch[3]),
      state: null,
      zip: germanMatch[2],
      country: country ?? inferEUCountry(germanMatch[2], street),
      formatted: '',
      confidence: country ? 0.93 : 0.85,
      format: 'eu',
    };
  }

  // French pattern: "15 Rue de Rivoli, 75001 Paris"
  // Italian pattern: "Via Roma 1, 00184 Roma"
  // Same structure as German — street, postal city
  // Already handled above.

  // Pattern with postal code after city: "Street, City PostalCode" (less common in EU)
  const altMatch = rest.match(/^(.+?)\s*,\s*(.+?)\s+(\d{4,5})$/);
  if (altMatch) {
    const { street, unit } = extractUnit(altMatch[1]);
    return {
      street: stripTrailingPunctuation(street),
      unit,
      city: stripTrailingPunctuation(altMatch[2]),
      state: null,
      zip: altMatch[3],
      country: country ?? inferEUCountry(altMatch[3], street),
      formatted: '',
      confidence: country ? 0.88 : 0.78,
      format: 'eu',
    };
  }

  // Simple two-part: "Street, City"
  if (parts.length >= 2 && country) {
    const remaining = parts.slice(0, country ? -1 : undefined);
    if (remaining.length >= 2) {
      const cityPart = remaining[remaining.length - 1];
      const streetPart = remaining.slice(0, -1).join(', ');

      // Try to extract postal code from city part
      const zipInCity = cityPart.match(/^(\d{4,5})\s+(.+)$/);
      if (zipInCity) {
        const { street, unit } = extractUnit(streetPart);
        return {
          street: stripTrailingPunctuation(street),
          unit,
          city: stripTrailingPunctuation(zipInCity[2]),
          state: null,
          zip: zipInCity[1],
          country,
          formatted: '',
          confidence: 0.88,
          format: 'eu',
        };
      }

      const { street, unit } = extractUnit(streetPart);
      return {
        street: stripTrailingPunctuation(street),
        unit,
        city: stripTrailingPunctuation(cityPart),
        state: null,
        zip: null,
        country,
        formatted: '',
        confidence: 0.75,
        format: 'eu',
      };
    }
  }

  return null;
}

function inferEUCountry(postalCode: string, street: string): string | null {
  const lower = street.toLowerCase();

  // Street name language hints
  if (/stra[sß]e|platz|gasse/i.test(street)) return 'Germany';
  if (/\brue\b|\bavenue\b|\bboulevard\b/i.test(lower) && /^\d{5}$/.test(postalCode)) return 'France';
  if (/\bvia\b|\bpiazza\b|\bcorso\b/i.test(lower)) return 'Italy';
  if (/\bcalle\b|\bpaseo\b|\bavenida\b/i.test(lower)) return 'Spain';
  if (/\bstraat\b|\bweg\b|\blaan\b|\bgracht\b/i.test(lower)) return 'Netherlands';

  // Postal code format heuristics (weak — many countries share 5-digit codes)
  if (/^\d{5}$/.test(postalCode)) {
    const prefix = parseInt(postalCode.slice(0, 2));
    if (prefix >= 1 && prefix <= 9) return 'Germany'; // 01xxx-09xxx
    if (prefix >= 10 && prefix <= 14) return 'Germany';
    if (prefix >= 75 && prefix <= 75) return 'France'; // Paris area
    if (prefix === 0) return 'Italy'; // 00xxx
  }

  return null;
}

// ── Japanese parser ─────────────────────────────────────────────────

function parseJP(input: string): ParsedAddress | null {
  const trimmed = normalize(input);

  // Japanese format with 〒: 〒100-0001 東京都千代田区千代田1-1
  const jpNativeMatch = trimmed.match(/^〒?\s?(\d{3}-?\d{4})\s*(.+)$/);
  if (jpNativeMatch && hasJapaneseChars(jpNativeMatch[2])) {
    const zip = jpNativeMatch[1].includes('-')
      ? jpNativeMatch[1]
      : jpNativeMatch[1].slice(0, 3) + '-' + jpNativeMatch[1].slice(3);
    const addressPart = jpNativeMatch[2];

    // Try to find prefecture
    let prefecture: string | null = null;
    let rest = addressPart;
    for (const pref of JP_PREFECTURES) {
      if (addressPart.startsWith(pref)) {
        prefecture = pref;
        rest = addressPart.slice(pref.length);
        break;
      }
    }

    // Split remaining into city/ward and street
    // Common patterns: 千代田区千代田1-1, 中央区日本橋1-2-3
    const wardMatch = rest.match(/^(.+?[区市町村])(.*)$/);
    let city = '';
    let street = '';
    if (wardMatch) {
      city = (prefecture ?? '') + wardMatch[1];
      street = wardMatch[2] || '';
    } else {
      city = prefecture ?? '';
      street = rest;
    }

    return {
      street: street.trim() || addressPart,
      unit: null,
      city: city.trim(),
      state: prefecture,
      zip,
      country: 'Japan',
      formatted: '',
      confidence: 0.9,
      format: 'jp',
    };
  }

  // Romanized Japanese: 1-2-3 Chiyoda, Chiyoda-ku, Tokyo 100-0001, Japan
  const romanMatch = trimmed.match(
    /^(.+?)\s*,\s*(.+?-ku|.+?-shi|.+?-cho|.+?-machi|.+?-mura|.+?-gun)\s*,\s*(.+?)\s+(\d{3}-?\d{4})(?:\s*,\s*Japan)?$/i
  );
  if (romanMatch) {
    const zip = romanMatch[4].includes('-')
      ? romanMatch[4]
      : romanMatch[4].slice(0, 3) + '-' + romanMatch[4].slice(3);
    return {
      street: stripTrailingPunctuation(romanMatch[1]),
      unit: null,
      city: romanMatch[2].trim(),
      state: stripTrailingPunctuation(romanMatch[3]),
      zip,
      country: 'Japan',
      formatted: '',
      confidence: 0.88,
      format: 'jp',
    };
  }

  // Simpler romanized: Street, City, Prefecture ZIP, Japan
  const simpleRomanMatch = trimmed.match(
    /^(.+?)\s*,\s*(.+?)\s*,\s*(.+?)\s+(\d{3}-?\d{4})(?:\s*,\s*Japan)?$/i
  );
  if (simpleRomanMatch) {
    const hasJPZip = /^\d{3}-?\d{4}$/.test(simpleRomanMatch[4]);
    if (hasJPZip) {
      const zip = simpleRomanMatch[4].includes('-')
        ? simpleRomanMatch[4]
        : simpleRomanMatch[4].slice(0, 3) + '-' + simpleRomanMatch[4].slice(3);
      return {
        street: stripTrailingPunctuation(simpleRomanMatch[1]),
        unit: null,
        city: stripTrailingPunctuation(simpleRomanMatch[2]),
        state: stripTrailingPunctuation(simpleRomanMatch[3]),
        zip,
        country: 'Japan',
        formatted: '',
        confidence: 0.85,
        format: 'jp',
      };
    }
  }

  return null;
}

// ── Generic fallback parser ─────────────────────────────────────────

function parseGeneric(input: string): ParsedAddress | null {
  const trimmed = normalize(input);
  const parts = trimmed.split(',').map(p => p.trim()).filter(Boolean);

  if (parts.length < 2) return null;

  // Check for country in last part
  let country: string | null = null;
  let workParts = [...parts];
  const lastResolved = resolveCountry(workParts[workParts.length - 1]);
  if (lastResolved) {
    country = lastResolved;
    workParts = workParts.slice(0, -1);
  }

  if (workParts.length < 2) return null;

  // Try to find a zip in the last working part
  let zip: string | null = null;
  let state: string | null = null;
  const lastPart = workParts[workParts.length - 1];

  // US-style: "ST 12345"
  const usZipMatch = lastPart.match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
  if (usZipMatch && US_STATES[usZipMatch[1].toUpperCase()]) {
    state = usZipMatch[1].toUpperCase();
    zip = usZipMatch[2];
    workParts = workParts.slice(0, -1);
  } else {
    // Generic postal code at end of last part
    const genericZip = lastPart.match(/\s+(\d{4,5}(?:-\d{3,4})?)$/);
    if (genericZip) {
      zip = genericZip[1];
      workParts[workParts.length - 1] = lastPart.slice(0, -genericZip[0].length).trim();
    }

    // State abbreviation
    const stateMatch = lastPart.match(/^([A-Z]{2})\s/i);
    if (stateMatch && US_STATES[stateMatch[1].toUpperCase()]) {
      state = stateMatch[1].toUpperCase();
    }
  }

  // First part is street, last part is city
  const { street, unit } = extractUnit(workParts[0]);
  const city = stripTrailingPunctuation(workParts[workParts.length - 1]);

  return {
    street: stripTrailingPunctuation(street),
    unit,
    city,
    state,
    zip,
    country,
    formatted: '',
    confidence: 0.65,
    format: 'generic',
  };
}

// ── Formatting ──────────────────────────────────────────────────────

function formatAddress(addr: ParsedAddress): string {
  const parts: string[] = [];

  if (addr.format === 'jp') {
    if (addr.zip) parts.push(`\u3012${addr.zip}`);
    if (addr.state) parts.push(addr.state);
    if (addr.city && addr.city !== addr.state) parts.push(addr.city);
    if (addr.street) parts.push(addr.street);
    return parts.join(' ');
  }

  if (addr.street) {
    let streetLine = addr.street;
    if (addr.unit) streetLine += `, ${addr.unit}`;
    parts.push(streetLine);
  }

  if (addr.city) {
    let cityLine = addr.city;
    if (addr.state) cityLine += `, ${addr.state}`;
    if (addr.zip) cityLine += ` ${addr.zip}`;
    parts.push(cityLine);
  } else {
    if (addr.state) parts.push(addr.state);
    if (addr.zip) parts.push(addr.zip);
  }

  if (addr.country) parts.push(addr.country);

  return parts.join(', ');
}

// ── Main export ─────────────────────────────────────────────────────

export function parseAddress(input: string): ParsedAddress | null {
  const trimmed = normalize(input);
  if (!trimmed || trimmed.length < 3) return null;

  const format = detectFormat(trimmed);

  let result: ParsedAddress | null = null;

  switch (format) {
    case 'jp':
      result = parseJP(trimmed);
      break;
    case 'uk':
      result = parseUK(trimmed);
      break;
    case 'us':
      result = parseUS(trimmed);
      break;
    case 'eu':
      result = parseEU(trimmed);
      break;
  }

  // If format-specific parser failed, try others as fallback
  if (!result && format !== 'us') result = parseUS(trimmed);
  if (!result && format !== 'uk') result = parseUK(trimmed);
  if (!result && format !== 'eu') result = parseEU(trimmed);
  if (!result && format !== 'jp') result = parseJP(trimmed);

  // Generic fallback
  if (!result) result = parseGeneric(trimmed);

  if (!result) return null;

  result.formatted = formatAddress(result);
  return result;
}
