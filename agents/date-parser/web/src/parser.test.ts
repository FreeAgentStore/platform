import { describe, it, expect } from 'vitest';
import { parseDate } from './parser';

describe('parseDate', () => {
  const refDate = new Date('2025-06-06T12:00:00Z');

  it('parses ISO format', () => {
    const result = parseDate('2025-03-14');
    expect(result).not.toBeNull();
    expect(result!.date.getFullYear()).toBe(2025);
    expect(result!.date.getMonth()).toBe(2); // March = 2
    expect(result!.date.getDate()).toBe(14);
    expect(result!.format).toBe('iso');
  });

  it('parses US format MM/DD/YYYY', () => {
    const result = parseDate('03/14/2025');
    expect(result).not.toBeNull();
    expect(result!.date.getFullYear()).toBe(2025);
    expect(result!.date.getMonth()).toBe(2);
    expect(result!.date.getDate()).toBe(14);
    expect(result!.format).toBe('us');
  });

  it('parses relative "tomorrow"', () => {
    const result = parseDate('tomorrow', refDate);
    expect(result).not.toBeNull();
    const expected = new Date(refDate);
    expected.setHours(0, 0, 0, 0);
    expected.setDate(expected.getDate() + 1);
    expect(result!.date.getTime()).toBe(expected.getTime());
    expect(result!.format).toBe('relative');
  });

  it('parses relative "in 3 days"', () => {
    const result = parseDate('in 3 days', refDate);
    expect(result).not.toBeNull();
    const diff = result!.date.getTime() - refDate.getTime();
    const daysDiff = Math.round(diff / 86400000);
    expect(daysDiff).toBe(3);
    expect(result!.format).toBe('relative');
  });

  it('parses ISO with time component', () => {
    const result = parseDate('2025-03-14T10:30:00Z');
    expect(result).not.toBeNull();
    expect(result!.date.getUTCHours()).toBe(10);
    expect(result!.date.getUTCMinutes()).toBe(30);
    expect(result!.format).toBe('iso');
  });

  it('parses "next monday" as a Monday', () => {
    const result = parseDate('next monday', refDate);
    expect(result).not.toBeNull();
    expect(result!.date.getDay()).toBe(1); // Monday = 1
    expect(result!.format).toBe('relative');
  });

  it('returns null for invalid input', () => {
    const result = parseDate('not a date');
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseDate('')).toBeNull();
  });

  it('has confidence > 0 for valid dates', () => {
    const result = parseDate('2025-03-14');
    expect(result).not.toBeNull();
    expect(result!.confidence).toBeGreaterThan(0);
  });

  it('parses EU dot format DD.MM.YYYY', () => {
    const result = parseDate('14.03.2025');
    expect(result).not.toBeNull();
    expect(result!.date.getFullYear()).toBe(2025);
    expect(result!.date.getMonth()).toBe(2);
    expect(result!.date.getDate()).toBe(14);
    expect(result!.format).toBe('eu');
  });

  it('parses "yesterday"', () => {
    const result = parseDate('yesterday', refDate);
    expect(result).not.toBeNull();
    const expected = new Date(refDate);
    expected.setHours(0, 0, 0, 0);
    expected.setDate(expected.getDate() - 1);
    expect(result!.date.getTime()).toBe(expected.getTime());
  });

  it('parses written date "March 14, 2025"', () => {
    const result = parseDate('March 14, 2025');
    expect(result).not.toBeNull();
    expect(result!.date.getFullYear()).toBe(2025);
    expect(result!.date.getMonth()).toBe(2);
    expect(result!.date.getDate()).toBe(14);
    expect(result!.format).toBe('written');
  });

  it('populates iso and unix fields for valid dates', () => {
    const result = parseDate('2025-03-14');
    expect(result).not.toBeNull();
    expect(result!.iso).toContain('2025-03-14');
    expect(result!.unix).toBeGreaterThan(0);
  });

  it('parses "3 days ago"', () => {
    const result = parseDate('3 days ago', refDate);
    expect(result).not.toBeNull();
    const diff = refDate.getTime() - result!.date.getTime();
    const daysDiff = Math.round(diff / 86400000);
    expect(daysDiff).toBe(3);
  });
});
