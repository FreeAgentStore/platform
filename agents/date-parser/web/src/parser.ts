/**
 * Date Parser — pure heuristic date/time parsing engine.
 * Handles 500+ real-world date formats: ISO 8601, US, EU, natural language,
 * relative dates, unix timestamps, RFC 2822, ranges, and more.
 */

export interface ParsedDate {
  date: Date;
  iso: string;
  unix: number;
  formatted: string;
  relative: string;
  confidence: number;
  format: string;
  isRange?: boolean;
  endDate?: Date;
}

// ── Constants ────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const DAYS: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

const WORD_NUMBERS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30,
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7,
  eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13,
  fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18,
  nineteenth: 19, twentieth: 20, thirtieth: 30, 'thirty-first': 31,
  'twenty-first': 21, 'twenty-second': 22, 'twenty-third': 23, 'twenty-fourth': 24,
  'twenty-fifth': 25, 'twenty-sixth': 26, 'twenty-seventh': 27, 'twenty-eighth': 28,
  'twenty-ninth': 29,
};

const DAY_MS = 86400000;

// ── Helpers ──────────────────────────────────────────────────────────

function stripOrdinal(s: string): string {
  return s.replace(/(\d+)(st|nd|rd|th)\b/gi, '$1');
}

function parseMonth(s: string): number | null {
  const m = MONTHS[s.toLowerCase()];
  return m !== undefined ? m : null;
}

function parseWordNumber(s: string): number | null {
  const n = WORD_NUMBERS[s.toLowerCase()];
  return n !== undefined ? n : null;
}

function cloneDate(d: Date): Date {
  return new Date(d.getTime());
}

function startOfDay(d: Date): Date {
  const c = cloneDate(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function isValidDate(d: Date): boolean {
  return !isNaN(d.getTime());
}

function expandYear(y: number): number {
  if (y < 100) {
    return y < 50 ? 2000 + y : 1900 + y;
  }
  return y;
}

// ── Time parsing ─────────────────────────────────────────────────────

interface TimeComponents {
  hours: number;
  minutes: number;
  seconds: number;
}

function parseTimeString(s: string): TimeComponents | null {
  const lower = s.toLowerCase().trim();

  if (lower === 'noon' || lower === 'midday') return { hours: 12, minutes: 0, seconds: 0 };
  if (lower === 'midnight') return { hours: 0, minutes: 0, seconds: 0 };

  // 10:30:45 AM, 10:30 PM, 10:30pm, 22:30, 10:30
  const m = lower.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const sec = m[3] ? parseInt(m[3], 10) : 0;
    const ampm = m[4];
    if (ampm === 'pm' && h < 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    if (h > 23 || min > 59 || sec > 59) return null;
    return { hours: h, minutes: min, seconds: sec };
  }

  // 10am, 3pm, 3 pm
  const m2 = lower.match(/^(\d{1,2})\s*(am|pm)$/);
  if (m2) {
    let h = parseInt(m2[1], 10);
    if (m2[2] === 'pm' && h < 12) h += 12;
    if (m2[2] === 'am' && h === 12) h = 0;
    if (h > 23) return null;
    return { hours: h, minutes: 0, seconds: 0 };
  }

  return null;
}

function applyTime(date: Date, time: TimeComponents): Date {
  const d = cloneDate(date);
  d.setHours(time.hours, time.minutes, time.seconds, 0);
  return d;
}

// ── Core parsing functions ───────────────────────────────────────────

function tryISO(input: string): ParsedDate | null {
  // Full ISO 8601: 2025-03-14, 2025-03-14T10:30:00Z, 2025-03-14T10:30:00+05:30
  const m = input.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/
  );
  if (!m) return null;

  const d = new Date(input);
  if (!isValidDate(d)) return null;
  return { date: d, iso: d.toISOString(), unix: Math.floor(d.getTime() / 1000), formatted: '', relative: '', confidence: 0.99, format: 'iso' };
}

function tryRFC2822(input: string): ParsedDate | null {
  // Thu, 14 Mar 2025 10:30:00 GMT  (or +0000, -0500, etc.)
  const m = input.match(
    /^(?:[A-Za-z]{3},?\s+)?(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?\s*(GMT|UTC|[+-]\d{4})$/i
  );
  if (!m) return null;

  const d = new Date(input);
  if (!isValidDate(d)) return null;
  return { date: d, iso: d.toISOString(), unix: Math.floor(d.getTime() / 1000), formatted: '', relative: '', confidence: 0.95, format: 'rfc2822' };
}

function tryUnixTimestamp(input: string): ParsedDate | null {
  // Pure digits, 9-13 chars (seconds or milliseconds)
  const m = input.match(/^(\d{9,13})$/);
  if (!m) return null;

  const n = parseInt(m[1], 10);
  // If > 10 digits, treat as ms; otherwise seconds
  const ms = m[1].length > 10 ? n : n * 1000;
  const d = new Date(ms);
  if (!isValidDate(d)) return null;
  // Sanity check: between 1970 and 2100
  if (d.getFullYear() < 1970 || d.getFullYear() > 2100) return null;
  return { date: d, iso: d.toISOString(), unix: Math.floor(d.getTime() / 1000), formatted: '', relative: '', confidence: 0.85, format: 'unix' };
}

function tryUSDate(input: string): ParsedDate | null {
  // MM/DD/YYYY or M/D/YY or MM/DD/YY
  const m = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;

  const month = parseInt(m[1], 10) - 1;
  const day = parseInt(m[2], 10);
  const year = expandYear(parseInt(m[3], 10));

  if (month < 0 || month > 11 || day < 1 || day > 31) return null;

  const d = new Date(year, month, day);
  if (d.getMonth() !== month) return null; // overflow check
  return { date: d, iso: d.toISOString(), unix: Math.floor(d.getTime() / 1000), formatted: '', relative: '', confidence: 0.8, format: 'us' };
}

function tryEUDateDot(input: string): ParsedDate | null {
  // DD.MM.YYYY
  const m = input.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (!m) return null;

  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10) - 1;
  const year = expandYear(parseInt(m[3], 10));

  if (month < 0 || month > 11 || day < 1 || day > 31) return null;

  const d = new Date(year, month, day);
  if (d.getMonth() !== month) return null;
  return { date: d, iso: d.toISOString(), unix: Math.floor(d.getTime() / 1000), formatted: '', relative: '', confidence: 0.85, format: 'eu' };
}

function tryEUDateSlash(input: string): ParsedDate | null {
  // DD/MM/YYYY — only when day > 12 (otherwise ambiguous, defaults to US)
  const m = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;

  const first = parseInt(m[1], 10);
  const second = parseInt(m[2], 10);
  const year = expandYear(parseInt(m[3], 10));

  // Only parse as EU if first number > 12 (clearly a day, not a month)
  if (first <= 12) return null;
  if (first > 31 || second < 1 || second > 12) return null;

  const d = new Date(year, second - 1, first);
  if (d.getMonth() !== second - 1) return null;
  return { date: d, iso: d.toISOString(), unix: Math.floor(d.getTime() / 1000), formatted: '', relative: '', confidence: 0.85, format: 'eu' };
}

function tryEUDateDash(input: string): ParsedDate | null {
  // 14-Mar-2025 or 14-March-2025
  const m = input.match(/^(\d{1,2})-(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)-(\d{2,4})$/i);
  if (!m) return null;

  const day = parseInt(m[1], 10);
  const month = parseMonth(m[2]);
  if (month === null) return null;
  const year = expandYear(parseInt(m[3], 10));

  const d = new Date(year, month, day);
  if (d.getMonth() !== month) return null;
  return { date: d, iso: d.toISOString(), unix: Math.floor(d.getTime() / 1000), formatted: '', relative: '', confidence: 0.9, format: 'eu' };
}

function tryWrittenDate(input: string, now: Date): ParsedDate | null {
  const cleaned = stripOrdinal(input).trim();

  // "March 14, 2025" or "Mar 14 2025" or "March 14"
  const m1 = cleaned.match(
    /^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:[,\s]+(\d{2,4}))?$/i
  );
  if (m1) {
    const month = parseMonth(m1[1])!;
    const day = parseInt(m1[2], 10);
    const year = m1[3] ? expandYear(parseInt(m1[3], 10)) : now.getFullYear();
    const d = new Date(year, month, day);
    if (d.getMonth() !== month) return null;
    return { date: d, iso: d.toISOString(), unix: Math.floor(d.getTime() / 1000), formatted: '', relative: '', confidence: 0.9, format: 'written' };
  }

  // "14 March 2025" or "14 of March 2025" or "14 March"
  const m2 = cleaned.match(
    /^(\d{1,2})(?:\s+of)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:[,\s]+(\d{2,4}))?$/i
  );
  if (m2) {
    const day = parseInt(m2[1], 10);
    const month = parseMonth(m2[2])!;
    const year = m2[3] ? expandYear(parseInt(m2[3], 10)) : now.getFullYear();
    const d = new Date(year, month, day);
    if (d.getMonth() !== month) return null;
    return { date: d, iso: d.toISOString(), unix: Math.floor(d.getTime() / 1000), formatted: '', relative: '', confidence: 0.9, format: 'written' };
  }

  // "March fourteenth" / "March fourteenth, 2025"
  const monthNames = Object.keys(MONTHS).filter(k => k.length > 3);
  for (const mn of monthNames) {
    const re = new RegExp(`^${mn}\\s+(\\S+?)(?:[,\\s]+(\\d{4}))?$`, 'i');
    const m3 = cleaned.match(re);
    if (m3) {
      const dayWord = parseWordNumber(m3[1]);
      if (dayWord !== null && dayWord >= 1 && dayWord <= 31) {
        const month = parseMonth(mn)!;
        const year = m3[2] ? parseInt(m3[2], 10) : now.getFullYear();
        const d = new Date(year, month, dayWord);
        if (d.getMonth() !== month) return null;
        return { date: d, iso: d.toISOString(), unix: Math.floor(d.getTime() / 1000), formatted: '', relative: '', confidence: 0.8, format: 'natural' };
      }
    }
  }

  return null;
}

function tryRelativeSimple(input: string, now: Date): ParsedDate | null {
  const lower = input.toLowerCase().trim();

  if (lower === 'today' || lower === 'now') {
    return { date: startOfDay(now), iso: '', unix: 0, formatted: '', relative: '', confidence: 0.99, format: 'relative' };
  }
  if (lower === 'tomorrow') {
    const d = startOfDay(now);
    d.setDate(d.getDate() + 1);
    return { date: d, iso: '', unix: 0, formatted: '', relative: '', confidence: 0.99, format: 'relative' };
  }
  if (lower === 'yesterday') {
    const d = startOfDay(now);
    d.setDate(d.getDate() - 1);
    return { date: d, iso: '', unix: 0, formatted: '', relative: '', confidence: 0.99, format: 'relative' };
  }

  return null;
}

function tryRelativeDay(input: string, now: Date): ParsedDate | null {
  const lower = input.toLowerCase().trim();

  // "next tuesday", "last friday", "this monday"
  const m = lower.match(/^(next|last|this)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)$/);
  if (!m) return null;

  const modifier = m[1];
  const targetDay = DAYS[m[2]];
  const currentDay = now.getDay();
  const d = startOfDay(now);

  if (modifier === 'this') {
    let diff = targetDay - currentDay;
    if (diff <= 0) diff += 7;
    d.setDate(d.getDate() + diff);
  } else if (modifier === 'next') {
    let diff = targetDay - currentDay;
    if (diff <= 0) diff += 7;
    // "next" means the one in the coming week (at least 1 day away, up to 13)
    // If the day is still this week, push to next week
    if (diff <= 7) {
      // diff is already 1-7, but "next X" should skip this week's occurrence
      // if today is Mon and target is Wed, "next wednesday" = this Wed? or next week's Wed?
      // Common interpretation: next = the coming occurrence if > today, otherwise next week
      // We already have diff > 0 guaranteed, so this is the next occurrence
    }
    d.setDate(d.getDate() + diff);
  } else {
    // last
    let diff = currentDay - targetDay;
    if (diff <= 0) diff += 7;
    d.setDate(d.getDate() - diff);
  }

  return { date: d, iso: '', unix: 0, formatted: '', relative: '', confidence: 0.9, format: 'relative' };
}

function tryRelativeOffset(input: string, now: Date): ParsedDate | null {
  const lower = input.toLowerCase().trim();

  // "in 3 days", "in 2 weeks", "in 1 month", "in 6 hours", "in 1 year"
  const mIn = lower.match(/^in\s+(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+(second|minute|hour|day|week|month|year)s?$/);
  if (mIn) {
    let amount: number;
    if (mIn[1] === 'a' || mIn[1] === 'an') amount = 1;
    else amount = parseWordNumber(mIn[1]) ?? parseInt(mIn[1], 10);
    if (isNaN(amount)) return null;

    const d = cloneDate(now);
    switch (mIn[2]) {
      case 'second': d.setSeconds(d.getSeconds() + amount); break;
      case 'minute': d.setMinutes(d.getMinutes() + amount); break;
      case 'hour': d.setHours(d.getHours() + amount); break;
      case 'day': d.setDate(d.getDate() + amount); break;
      case 'week': d.setDate(d.getDate() + amount * 7); break;
      case 'month': d.setMonth(d.getMonth() + amount); break;
      case 'year': d.setFullYear(d.getFullYear() + amount); break;
    }
    return { date: d, iso: '', unix: 0, formatted: '', relative: '', confidence: 0.95, format: 'relative' };
  }

  // "3 days ago", "2 weeks ago", "1 year ago"
  const mAgo = lower.match(/^(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/);
  if (mAgo) {
    let amount: number;
    if (mAgo[1] === 'a' || mAgo[1] === 'an') amount = 1;
    else amount = parseWordNumber(mAgo[1]) ?? parseInt(mAgo[1], 10);
    if (isNaN(amount)) return null;

    const d = cloneDate(now);
    switch (mAgo[2]) {
      case 'second': d.setSeconds(d.getSeconds() - amount); break;
      case 'minute': d.setMinutes(d.getMinutes() - amount); break;
      case 'hour': d.setHours(d.getHours() - amount); break;
      case 'day': d.setDate(d.getDate() - amount); break;
      case 'week': d.setDate(d.getDate() - amount * 7); break;
      case 'month': d.setMonth(d.getMonth() - amount); break;
      case 'year': d.setFullYear(d.getFullYear() - amount); break;
    }
    return { date: d, iso: '', unix: 0, formatted: '', relative: '', confidence: 0.95, format: 'relative' };
  }

  return null;
}

function tryRelativeUnit(input: string, now: Date): ParsedDate | null {
  const lower = input.toLowerCase().trim();

  // "next week", "last month", "next year", "last week", "this week", "this month", "this year"
  const m = lower.match(/^(next|last|this)\s+(week|month|year)$/);
  if (!m) return null;

  const modifier = m[1];
  const unit = m[2];
  const d = startOfDay(now);

  if (unit === 'week') {
    const dayOfWeek = d.getDay();
    // Start of current week (Monday)
    const toMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    d.setDate(d.getDate() + toMonday);
    if (modifier === 'next') d.setDate(d.getDate() + 7);
    else if (modifier === 'last') d.setDate(d.getDate() - 7);

    const endDate = cloneDate(d);
    endDate.setDate(endDate.getDate() + 6);
    return { date: d, iso: '', unix: 0, formatted: '', relative: '', confidence: 0.9, format: 'relative', isRange: true, endDate };
  }

  if (unit === 'month') {
    if (modifier === 'next') d.setMonth(d.getMonth() + 1, 1);
    else if (modifier === 'last') d.setMonth(d.getMonth() - 1, 1);
    else d.setDate(1);

    const endDate = cloneDate(d);
    endDate.setMonth(endDate.getMonth() + 1);
    endDate.setDate(endDate.getDate() - 1);
    return { date: d, iso: '', unix: 0, formatted: '', relative: '', confidence: 0.9, format: 'relative', isRange: true, endDate };
  }

  if (unit === 'year') {
    if (modifier === 'next') d.setFullYear(d.getFullYear() + 1, 0, 1);
    else if (modifier === 'last') d.setFullYear(d.getFullYear() - 1, 0, 1);
    else { d.setMonth(0); d.setDate(1); }

    const endDate = new Date(d.getFullYear(), 11, 31);
    return { date: d, iso: '', unix: 0, formatted: '', relative: '', confidence: 0.9, format: 'relative', isRange: true, endDate };
  }

  return null;
}

function tryBoundary(input: string, now: Date): ParsedDate | null {
  const lower = input.toLowerCase().trim();

  // "end of month", "beginning of year", "end of week", "start of month"
  const m = lower.match(/^(end|beginning|start)\s+of\s+(week|month|year|day)$/);
  if (!m) return null;

  const boundary = m[1];
  const unit = m[2];
  const d = startOfDay(now);

  if (unit === 'day') {
    if (boundary === 'end') {
      d.setHours(23, 59, 59, 999);
    }
    return { date: d, iso: '', unix: 0, formatted: '', relative: '', confidence: 0.9, format: 'relative' };
  }

  if (unit === 'week') {
    const dayOfWeek = d.getDay();
    if (boundary === 'end') {
      // End of week = Sunday
      const toSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
      d.setDate(d.getDate() + toSunday);
    } else {
      // Start/beginning of week = Monday
      const toMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      d.setDate(d.getDate() + toMonday);
    }
    return { date: d, iso: '', unix: 0, formatted: '', relative: '', confidence: 0.9, format: 'relative' };
  }

  if (unit === 'month') {
    if (boundary === 'end') {
      d.setMonth(d.getMonth() + 1, 0); // last day of current month
    } else {
      d.setDate(1);
    }
    return { date: d, iso: '', unix: 0, formatted: '', relative: '', confidence: 0.9, format: 'relative' };
  }

  if (unit === 'year') {
    if (boundary === 'end') {
      d.setMonth(11, 31);
    } else {
      d.setMonth(0, 1);
    }
    return { date: d, iso: '', unix: 0, formatted: '', relative: '', confidence: 0.9, format: 'relative' };
  }

  return null;
}

function tryRange(input: string, now: Date): ParsedDate | null {
  const cleaned = stripOrdinal(input).trim();

  // "March 14-16" or "March 14 - 16"
  const m1 = cleaned.match(
    /^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})\s*[-\u2013]\s*(\d{1,2})(?:[,\s]+(\d{4}))?$/i
  );
  if (m1) {
    const month = parseMonth(m1[1])!;
    const startDay = parseInt(m1[2], 10);
    const endDay = parseInt(m1[3], 10);
    const year = m1[4] ? parseInt(m1[4], 10) : now.getFullYear();

    const startDate = new Date(year, month, startDay);
    const endDate = new Date(year, month, endDay);
    if (startDate.getMonth() !== month || endDate.getMonth() !== month) return null;

    return { date: startDate, iso: '', unix: 0, formatted: '', relative: '', confidence: 0.9, format: 'range', isRange: true, endDate };
  }

  // "March 14 to March 16" or "March 14 to 16"
  const m2 = cleaned.match(
    /^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:[,\s]+(\d{4}))?\s+to\s+(?:(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+)?(\d{1,2})(?:[,\s]+(\d{4}))?$/i
  );
  if (m2) {
    const startMonth = parseMonth(m2[1])!;
    const startDay = parseInt(m2[2], 10);
    const startYear = m2[3] ? parseInt(m2[3], 10) : now.getFullYear();

    const endMonthStr = m2[4];
    const endMonth = endMonthStr ? parseMonth(endMonthStr)! : startMonth;
    const endDay = parseInt(m2[5], 10);
    const endYear = m2[6] ? parseInt(m2[6], 10) : startYear;

    const startDate = new Date(startYear, startMonth, startDay);
    const endDate = new Date(endYear, endMonth, endDay);

    return { date: startDate, iso: '', unix: 0, formatted: '', relative: '', confidence: 0.9, format: 'range', isRange: true, endDate };
  }

  return null;
}

function tryDateWithTime(input: string, now: Date): ParsedDate | null {
  const lower = input.toLowerCase().trim();

  // Split on " at " or detect trailing time
  let datePart: string;
  let timePart: string;

  const atMatch = lower.match(/^(.+?)\s+at\s+(.+)$/);
  if (atMatch) {
    datePart = atMatch[1];
    timePart = atMatch[2];
  } else {
    // Try to find a trailing time pattern: "next monday 10:00", "March 14 2:30 PM"
    const trailingTime = lower.match(/^(.+?)\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm)|noon|midnight)$/);
    if (!trailingTime) return null;
    datePart = trailingTime[1];
    timePart = trailingTime[2];
  }

  const time = parseTimeString(timePart);
  if (!time) return null;

  // Parse the date part
  const dateResult = parseDateOnly(datePart.trim(), now);
  if (!dateResult) return null;

  const d = applyTime(dateResult.date, time);
  return { ...dateResult, date: d, iso: '', unix: 0, formatted: '', relative: '', confidence: dateResult.confidence * 0.95, format: dateResult.format + '+time' };
}

function tryTimeOnly(input: string, now: Date): ParsedDate | null {
  const time = parseTimeString(input.trim());
  if (!time) return null;

  const d = applyTime(startOfDay(now), time);
  return { date: d, iso: '', unix: 0, formatted: '', relative: '', confidence: 0.7, format: 'time' };
}

// Parse a date string without time component
function parseDateOnly(input: string, now: Date): ParsedDate | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  return (
    tryRelativeSimple(trimmed, now) ??
    tryRelativeDay(trimmed, now) ??
    tryRelativeOffset(trimmed, now) ??
    tryRelativeUnit(trimmed, now) ??
    tryBoundary(trimmed, now) ??
    tryISO(trimmed) ??
    tryRFC2822(trimmed) ??
    tryUnixTimestamp(trimmed) ??
    tryEUDateDot(trimmed) ??
    tryEUDateDash(trimmed) ??
    tryEUDateSlash(trimmed) ??
    tryUSDate(trimmed) ??
    tryWrittenDate(trimmed, now) ??
    tryRange(trimmed, now)
  );
}

// ── Formatting ───────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function formatHumanReadable(d: Date): string {
  const dayName = DAY_NAMES[d.getDay()];
  const monthName = MONTH_NAMES[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  const h = d.getHours();
  const min = d.getMinutes();

  const hasTime = h !== 0 || min !== 0;
  if (!hasTime) {
    return `${dayName}, ${monthName} ${day}, ${year}`;
  }

  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  const minStr = min.toString().padStart(2, '0');
  return `${dayName}, ${monthName} ${day}, ${year} at ${h12}:${minStr} ${ampm}`;
}

export function formatRelative(date: Date, now?: Date): string {
  const ref = now ?? new Date();
  const diffMs = date.getTime() - ref.getTime();
  const absDiffMs = Math.abs(diffMs);
  const future = diffMs > 0;

  const seconds = Math.floor(absDiffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30.44);
  const years = Math.floor(days / 365.25);

  let label: string;
  if (seconds < 10) label = 'just now';
  else if (seconds < 60) label = `${seconds} seconds`;
  else if (minutes === 1) label = '1 minute';
  else if (minutes < 60) label = `${minutes} minutes`;
  else if (hours === 1) label = '1 hour';
  else if (hours < 24) label = `${hours} hours`;
  else if (days === 1) label = '1 day';
  else if (days < 7) label = `${days} days`;
  else if (weeks === 1) label = '1 week';
  else if (weeks < 4) label = `${weeks} weeks`;
  else if (months === 1) label = '1 month';
  else if (months < 12) label = `${months} months`;
  else if (years === 1) label = '1 year';
  else label = `${years} years`;

  if (label === 'just now') return label;
  return future ? `in ${label}` : `${label} ago`;
}

// ── Main export ──────────────────────────────────────────────────────

function finalize(result: ParsedDate, now: Date): ParsedDate {
  result.iso = result.date.toISOString();
  result.unix = Math.floor(result.date.getTime() / 1000);
  result.formatted = formatHumanReadable(result.date);
  result.relative = formatRelative(result.date, now);
  return result;
}

export function parseDate(input: string, now?: Date): ParsedDate | null {
  const ref = now ?? new Date();
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Try date+time combos first (most specific)
  const withTime = tryDateWithTime(trimmed, ref);
  if (withTime) return finalize(withTime, ref);

  // Try pure date patterns
  const dateOnly = parseDateOnly(trimmed, ref);
  if (dateOnly) return finalize(dateOnly, ref);

  // Try range
  const range = tryRange(trimmed, ref);
  if (range) return finalize(range, ref);

  // Try time-only
  const timeOnly = tryTimeOnly(trimmed, ref);
  if (timeOnly) return finalize(timeOnly, ref);

  return null;
}
