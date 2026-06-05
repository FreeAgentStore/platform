/**
 * Regex Builder — pattern library + heuristic builder.
 * ~30 common patterns, keyword matching, and natural-language-to-regex builder.
 */

export interface Pattern {
  name: string;
  description: string;
  regex: string;
  flags: string;
  examples: string[];
}

export const PATTERNS: Pattern[] = [
  { name: 'Email', description: 'Email address', regex: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}', flags: 'g', examples: ['user@example.com', 'test.name+tag@domain.co.uk'] },
  { name: 'URL', description: 'HTTP/HTTPS URL', regex: 'https?:\\/\\/[\\w\\-._~:/?#\\[\\]@!$&\'()*+,;=%]+', flags: 'g', examples: ['https://example.com/path?q=1', 'http://sub.domain.org'] },
  { name: 'Phone (US)', description: 'US phone number', regex: '(?:\\+?1[-.\\s]?)?\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}', flags: 'g', examples: ['(555) 123-4567', '+1-555-123-4567', '5551234567'] },
  { name: 'Phone (Intl)', description: 'International phone number', regex: '\\+?\\d{1,4}[-.\\s]?\\(?\\d{1,4}\\)?[-.\\s]?\\d{1,4}[-.\\s]?\\d{1,9}', flags: 'g', examples: ['+44 20 7946 0958', '+33 1 23 45 67 89'] },
  { name: 'Date (YYYY-MM-DD)', description: 'ISO date format', regex: '\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])', flags: 'g', examples: ['2024-01-15', '2023-12-31'] },
  { name: 'Date (MM/DD/YYYY)', description: 'US date format', regex: '(?:0[1-9]|1[0-2])\\/(?:0[1-9]|[12]\\d|3[01])\\/\\d{4}', flags: 'g', examples: ['01/15/2024', '12/31/2023'] },
  { name: 'Date (DD/MM/YYYY)', description: 'European date format', regex: '(?:0[1-9]|[12]\\d|3[01])\\/(?:0[1-9]|1[0-2])\\/\\d{4}', flags: 'g', examples: ['15/01/2024', '31/12/2023'] },
  { name: 'Time (24h)', description: '24-hour time', regex: '(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d)?', flags: 'g', examples: ['14:30', '23:59:59', '00:00'] },
  { name: 'Time (12h)', description: '12-hour time with AM/PM', regex: '(?:1[0-2]|0?[1-9]):[0-5]\\d\\s?(?:AM|PM|am|pm)', flags: 'g', examples: ['2:30 PM', '12:00 AM', '9:45am'] },
  { name: 'IPv4', description: 'IPv4 address', regex: '(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)', flags: 'g', examples: ['192.168.1.1', '10.0.0.255'] },
  { name: 'IPv6', description: 'IPv6 address (simplified)', regex: '(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}', flags: 'g', examples: ['2001:0db8:85a3:0000:0000:8a2e:0370:7334'] },
  { name: 'Hex Color', description: 'CSS hex color (#RGB or #RRGGBB)', regex: '#(?:[0-9a-fA-F]{3}){1,2}\\b', flags: 'g', examples: ['#ff5733', '#F00', '#a1b2c3'] },
  { name: 'Credit Card', description: 'Credit card number (basic)', regex: '\\b(?:\\d{4}[- ]?){3}\\d{4}\\b', flags: 'g', examples: ['4111-1111-1111-1111', '5500 0000 0000 0004'] },
  { name: 'SSN', description: 'US Social Security Number', regex: '\\b\\d{3}-\\d{2}-\\d{4}\\b', flags: 'g', examples: ['123-45-6789'] },
  { name: 'Zip Code (US)', description: 'US zip code (5 or 9 digit)', regex: '\\b\\d{5}(?:-\\d{4})?\\b', flags: 'g', examples: ['90210', '10001-1234'] },
  { name: 'Username', description: 'Alphanumeric username (3-20 chars)', regex: '^[a-zA-Z][a-zA-Z0-9_-]{2,19}$', flags: '', examples: ['user_name', 'JohnDoe42'] },
  { name: 'Password (Strong)', description: 'Min 8 chars, upper, lower, digit, special', regex: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&#])[A-Za-z\\d@$!%*?&#]{8,}$', flags: '', examples: ['Str0ng!Pass'] },
  { name: 'HTML Tag', description: 'HTML opening/closing tag', regex: '<\\/?[a-zA-Z][a-zA-Z0-9]*(?:\\s[^>]*)?\\/?>',  flags: 'g', examples: ['<div class="test">', '</span>', '<br />'] },
  { name: 'CSS Selector', description: 'Simple CSS selector', regex: '[.#]?[a-zA-Z_][a-zA-Z0-9_-]*(?:\\s*[>+~]\\s*[.#]?[a-zA-Z_][a-zA-Z0-9_-]*)*', flags: 'g', examples: ['.class-name', '#id', 'div > p'] },
  { name: 'File Extension', description: 'Filename with extension', regex: '[\\w.-]+\\.(?:js|ts|tsx|jsx|css|html|json|md|py|rb|go|rs|java|cpp|c|h|sh|yml|yaml|xml|sql|txt|csv|png|jpg|gif|svg|pdf|zip)', flags: 'g', examples: ['app.tsx', 'styles.css', 'data.json'] },
  { name: 'Domain Name', description: 'Domain name', regex: '(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}', flags: 'g', examples: ['example.com', 'sub.domain.co.uk'] },
  { name: 'Slug', description: 'URL-friendly slug', regex: '^[a-z0-9]+(?:-[a-z0-9]+)*$', flags: '', examples: ['my-page-title', 'hello-world'] },
  { name: 'Integer', description: 'Whole number (optional sign)', regex: '[+-]?\\d+', flags: 'g', examples: ['42', '-7', '+100'] },
  { name: 'Float', description: 'Decimal number', regex: '[+-]?\\d+\\.\\d+', flags: 'g', examples: ['3.14', '-0.5', '+2.718'] },
  { name: 'Scientific', description: 'Scientific notation number', regex: '[+-]?\\d+(?:\\.\\d+)?[eE][+-]?\\d+', flags: 'g', examples: ['1.5e10', '-3.14E-2'] },
  { name: 'Currency', description: 'Currency amount ($, EUR, GBP)', regex: '[$\\u20AC\\u00A3]\\s?\\d{1,3}(?:,\\d{3})*(?:\\.\\d{2})?', flags: 'g', examples: ['$1,234.56', '$99.99'] },
  { name: 'Percentage', description: 'Percentage value', regex: '\\d+(?:\\.\\d+)?\\s?%', flags: 'g', examples: ['50%', '3.14 %', '100%'] },
  { name: 'UUID', description: 'UUID v4', regex: '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}', flags: 'gi', examples: ['550e8400-e29b-41d4-a716-446655440000'] },
  { name: 'MAC Address', description: 'Network MAC address', regex: '(?:[0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}', flags: 'g', examples: ['00:1B:44:11:3A:B7', 'AA-BB-CC-DD-EE-FF'] },
  { name: 'Hashtag', description: 'Social media hashtag', regex: '#[a-zA-Z_][a-zA-Z0-9_]*', flags: 'g', examples: ['#javascript', '#100DaysOfCode'] },
];

// ── Keyword matching ─────────────────────────────────────────────────

const KEYWORD_MAP: Record<string, string[]> = {
  email: ['email', 'mail', 'e-mail', 'address'],
  url: ['url', 'link', 'website', 'http', 'https', 'web address'],
  'phone (us)': ['phone', 'telephone', 'cell', 'mobile', 'us phone'],
  'phone (intl)': ['international phone', 'intl phone', 'global phone'],
  'date (yyyy-mm-dd)': ['date', 'iso date', 'yyyy-mm-dd'],
  'date (mm/dd/yyyy)': ['us date', 'mm/dd/yyyy', 'american date'],
  'date (dd/mm/yyyy)': ['european date', 'dd/mm/yyyy', 'eu date'],
  'time (24h)': ['time', '24 hour', '24h', 'military time'],
  'time (12h)': ['12 hour', '12h', 'am pm', 'clock'],
  ipv4: ['ip', 'ipv4', 'ip address', 'ip4'],
  ipv6: ['ipv6', 'ip6'],
  'hex color': ['hex', 'color', 'colour', 'hex color', 'css color'],
  'credit card': ['credit card', 'card number', 'cc', 'visa', 'mastercard'],
  ssn: ['ssn', 'social security', 'social'],
  'zip code (us)': ['zip', 'zip code', 'postal', 'zipcode'],
  username: ['username', 'user name', 'login', 'handle'],
  'password (strong)': ['password', 'strong password', 'secure password'],
  'html tag': ['html', 'tag', 'html tag', 'element'],
  'css selector': ['css', 'selector', 'css selector', 'class', 'id selector'],
  'file extension': ['file', 'extension', 'filename', 'file extension'],
  'domain name': ['domain', 'domain name', 'hostname'],
  slug: ['slug', 'url slug', 'friendly url', 'permalink'],
  integer: ['integer', 'int', 'whole number', 'number'],
  float: ['float', 'decimal', 'double', 'real number'],
  scientific: ['scientific', 'scientific notation', 'exponent'],
  currency: ['currency', 'money', 'dollar', 'price', 'amount'],
  percentage: ['percent', 'percentage', '%'],
  uuid: ['uuid', 'guid', 'unique id'],
  'mac address': ['mac', 'mac address', 'network address'],
  hashtag: ['hashtag', 'hash tag', 'tag'],
};

export function matchPattern(query: string): Pattern[] {
  const lower = query.toLowerCase().trim();
  if (!lower) return [];

  const scored: { pattern: Pattern; score: number }[] = [];

  for (const pattern of PATTERNS) {
    let score = 0;
    const nameLower = pattern.name.toLowerCase();
    const descLower = pattern.description.toLowerCase();

    // Exact name match
    if (nameLower === lower) { score += 100; }
    // Name contains query
    else if (nameLower.includes(lower)) { score += 50; }
    // Description contains query
    else if (descLower.includes(lower)) { score += 30; }

    // Keyword matching
    const keywords = KEYWORD_MAP[nameLower];
    if (keywords) {
      for (const kw of keywords) {
        if (lower.includes(kw) || kw.includes(lower)) {
          score += 40;
          break;
        }
      }
      // Check individual words
      const words = lower.split(/\s+/);
      for (const word of words) {
        if (keywords.some(kw => kw.includes(word) || word.includes(kw))) {
          score += 10;
        }
      }
    }

    if (score > 0) scored.push({ pattern, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.pattern);
}

// ── Heuristic builder from natural language ──────────────────────────

export function buildFromDescription(query: string): string | null {
  const lower = query.toLowerCase().trim();
  const parts: string[] = [];

  // Anchors
  const anchorStart = /\b(?:starts?\s+with|beginning|^must\s+start)\b/.test(lower);
  const anchorEnd = /\b(?:ends?\s+with|ending)\b/.test(lower);

  if (anchorStart) parts.push('^');

  // "starts with X"
  const startsMatch = lower.match(/starts?\s+with\s+["']?([^"',]+)["']?/);
  if (startsMatch) {
    parts.push(escapeRegex(startsMatch[1].trim()));
  }

  // "contains X"
  const containsMatch = lower.match(/contains?\s+["']?([^"',]+)["']?/);
  if (containsMatch) {
    parts.push('.*' + escapeRegex(containsMatch[1].trim()));
  }

  // Character classes
  if (/\bdigits?\b|\bnumbers?\b/.test(lower)) {
    const countMatch = lower.match(/(?:exactly\s+)?(\d+)\s+digits?/);
    if (countMatch) {
      parts.push(`\\d{${countMatch[1]}}`);
    } else if (/\bone\s+or\s+more\s+digits?\b/.test(lower)) {
      parts.push('\\d+');
    } else if (/\boptional\s+digits?\b/.test(lower)) {
      parts.push('\\d*');
    } else {
      parts.push('\\d+');
    }
  }

  if (/\bletters?\b|\balphabetic\b/.test(lower)) {
    const countMatch = lower.match(/(?:exactly\s+)?(\d+)\s+letters?/);
    if (countMatch) {
      parts.push(`[a-zA-Z]{${countMatch[1]}}`);
    } else if (/\bone\s+or\s+more\s+letters?\b/.test(lower)) {
      parts.push('[a-zA-Z]+');
    } else if (/\buppercase\b/.test(lower)) {
      parts.push('[A-Z]+');
    } else if (/\blowercase\b/.test(lower)) {
      parts.push('[a-z]+');
    } else {
      parts.push('[a-zA-Z]+');
    }
  }

  if (/\balphanumeric\b|\bword\s+characters?\b/.test(lower)) {
    parts.push('\\w+');
  }

  if (/\bwhitespace\b|\bspaces?\b/.test(lower)) {
    if (/\boptional\b/.test(lower)) {
      parts.push('\\s*');
    } else {
      parts.push('\\s+');
    }
  }

  if (/\bany\s+character\b|\bwildcard\b/.test(lower)) {
    parts.push('.');
  }

  // "between X and Y characters"
  const betweenMatch = lower.match(/between\s+(\d+)\s+and\s+(\d+)\s+(?:characters?|chars?)/);
  if (betweenMatch) {
    parts.push(`.{${betweenMatch[1]},${betweenMatch[2]}}`);
  }

  // "exactly N characters"
  const exactlyMatch = lower.match(/exactly\s+(\d+)\s+(?:characters?|chars?)/);
  if (exactlyMatch && !lower.match(/exactly\s+\d+\s+(?:digits?|letters?)/)) {
    parts.push(`.{${exactlyMatch[1]}}`);
  }

  // "followed by X"
  const followedMatch = lower.match(/followed\s+by\s+["']?([^"',]+)["']?/);
  if (followedMatch) {
    parts.push(escapeRegex(followedMatch[1].trim()));
  }

  // "optional X"
  const optionalMatch = lower.match(/optional\s+["']?([^"',]+?)["']?(?:\s|$)/);
  if (optionalMatch && !/optional\s+(?:digits?|letters?|spaces?|whitespace)/.test(lower)) {
    parts.push(`(?:${escapeRegex(optionalMatch[1].trim())})?`);
  }

  // "one or more X"
  const oneOrMoreMatch = lower.match(/one\s+or\s+more\s+["']?([^"',]+?)["']?(?:\s|$)/);
  if (oneOrMoreMatch && !/one\s+or\s+more\s+(?:digits?|letters?)/.test(lower)) {
    parts.push(`(?:${escapeRegex(oneOrMoreMatch[1].trim())})+`);
  }

  // "ends with X"
  const endsMatch = lower.match(/ends?\s+with\s+["']?([^"',]+)["']?/);
  if (endsMatch) {
    parts.push(escapeRegex(endsMatch[1].trim()));
  }

  if (anchorEnd || endsMatch) parts.push('$');

  // "or" combinator
  if (/\b(?:or)\b/.test(lower) && parts.length === 0) {
    const orParts = lower.split(/\s+or\s+/).map(p => p.replace(/['"]/g, '').trim()).filter(Boolean);
    if (orParts.length >= 2) {
      return `(?:${orParts.map(escapeRegex).join('|')})`;
    }
  }

  if (parts.length === 0) return null;
  return parts.join('');
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Chrome Built-in AI fallback ──────────────────────────────────────

export async function tryBuiltInAI(query: string): Promise<{ regex: string; flags: string } | null> {
  try {
    const factory = (globalThis as any).LanguageModel ?? (globalThis as any).ai?.languageModel;
    if (!factory?.create) return null;

    const model = await factory.create();
    const prompt = `Generate a JavaScript regular expression for: "${query}".
Return ONLY a JSON object with "regex" (the pattern string without delimiters) and "flags" (like "gi" or "g"). No markdown, no explanation. Example:
{"regex":"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\\\.[a-zA-Z]{2,}","flags":"g"}`;

    const response = await model.prompt(prompt);
    const match = response.match(/\{[\s\S]*?\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]);
    if (!parsed.regex) return null;

    // Validate the regex
    new RegExp(parsed.regex, parsed.flags || '');
    return { regex: parsed.regex, flags: parsed.flags || 'g' };
  } catch {
    return null;
  }
}
