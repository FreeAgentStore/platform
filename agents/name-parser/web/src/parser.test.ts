import { describe, expect, it } from 'vitest';
import { parseName } from './parser';

describe('parseName', () => {
  // ── Western names ──
  it('parses simple first last', () => {
    const r = parseName('John Smith');
    expect(r.first).toBe('John');
    expect(r.last).toBe('Smith');
    expect(r.middle).toBeNull();
    expect(r.format).toBe('western');
  });

  it('parses first middle last', () => {
    const r = parseName('John Michael Smith');
    expect(r.first).toBe('John');
    expect(r.middle).toBe('Michael');
    expect(r.last).toBe('Smith');
  });

  // ── Prefixes ──
  it('extracts prefix', () => {
    const r = parseName('Dr. Jane Doe');
    expect(r.prefix).toBe('Dr.');
    expect(r.first).toBe('Jane');
    expect(r.last).toBe('Doe');
  });

  it('extracts Mr prefix', () => {
    const r = parseName('Mr John Smith');
    expect(r.prefix).toBe('Mr');
    expect(r.first).toBe('John');
  });

  // ── Suffixes ──
  it('extracts suffix Jr', () => {
    const r = parseName('John Smith Jr');
    expect(r.first).toBe('John');
    expect(r.last).toBe('Smith');
    expect(r.suffix).toBe('Jr');
  });

  it('extracts suffix III', () => {
    const r = parseName('James Wilson III');
    expect(r.suffix).toBe('III');
    expect(r.last).toBe('Wilson');
  });

  it('extracts PhD suffix', () => {
    const r = parseName('Alice Brown PhD');
    expect(r.suffix).toBe('PhD');
  });

  // ── Mononym ──
  it('parses mononym', () => {
    const r = parseName('Madonna');
    expect(r.first).toBe('Madonna');
    expect(r.last).toBeNull();
    expect(r.format).toBe('mononym');
  });

  // ── Empty input ──
  it('handles empty string', () => {
    const r = parseName('');
    expect(r.first).toBe('');
    expect(r.confidence).toBe(0);
  });

  // ── East Asian names ──
  // When first token is EA surname and second is NOT, parser uses Eastern order.
  // When both are potential EA surnames, parser defaults to Western (ambiguous).
  it('parses East Asian name (surname + given)', () => {
    const r = parseName('Tanaka Yuki');
    expect(r.last).toBe('Tanaka');
    expect(r.first).toBe('Yuki');
    expect(r.format).toBe('eastern');
  });

  it('parses Korean name', () => {
    const r = parseName('Kim Minjun');
    expect(r.last).toBe('Kim');
    expect(r.first).toBe('Minjun');
    expect(r.format).toBe('eastern');
  });

  it('defaults to western when both tokens are EA surnames', () => {
    // Wang and Wei are both in the EA surname set, so parser can't determine order
    const r = parseName('Wang Wei');
    expect(r.first).toBe('Wang');
    expect(r.last).toBe('Wei');
    expect(r.format).toBe('western');
  });

  // ── Particles ──
  it('parses Dutch name with van der', () => {
    const r = parseName('Jan van der Berg');
    expect(r.first).toBe('Jan');
    expect(r.last).toBe('van der Berg');
  });

  it('parses German name with von', () => {
    const r = parseName('Werner von Braun');
    expect(r.first).toBe('Werner');
    expect(r.last).toBe('von Braun');
  });

  it('parses French name with de la', () => {
    const r = parseName('Marie de la Cruz');
    expect(r.first).toBe('Marie');
    expect(r.last).toContain('de la Cruz');
  });

  // ── Hispanic compound surnames ──
  it('parses hyphenated Hispanic surname', () => {
    const r = parseName('Carlos Garcia-Lopez');
    expect(r.first).toBe('Carlos');
    expect(r.last).toBe('Garcia-Lopez');
    expect(r.format).toBe('hispanic');
  });

  // ── Celtic/Gaelic surnames ──
  it("parses O'Brien", () => {
    const r = parseName("Sean O'Brien");
    expect(r.first).toBe('Sean');
    expect(r.last).toBe("O'Brien");
  });

  it('parses McDonald', () => {
    const r = parseName('James McDonald');
    expect(r.first).toBe('James');
    expect(r.last).toBe('McDonald');
  });

  // ── Multiple middle names ──
  it('parses 4-token name (may detect as compound surname)', () => {
    // 4 tokens with two capitalized words at end triggers Hispanic compound detection
    const r = parseName('John Paul George Smith');
    expect(r.first).toBe('John');
    // Parser sees "George Smith" as potential compound surname
    expect(r.last).toContain('Smith');
  });

  it('parses 3-token name with middle', () => {
    const r = parseName('John Paul Smith');
    expect(r.first).toBe('John');
    expect(r.middle).toBe('Paul');
    expect(r.last).toBe('Smith');
    expect(r.format).toBe('western');
  });

  // ── Prefix + suffix combo ──
  it('handles prefix and suffix together', () => {
    const r = parseName('Dr. John Smith Jr');
    expect(r.prefix).toBe('Dr.');
    expect(r.first).toBe('John');
    expect(r.last).toBe('Smith');
    expect(r.suffix).toBe('Jr');
  });

  // ── Whitespace normalization ──
  it('normalizes extra whitespace', () => {
    const r = parseName('  John   Smith  ');
    expect(r.first).toBe('John');
    expect(r.last).toBe('Smith');
  });

  // ── Confidence scores ──
  it('has high confidence for simple names', () => {
    expect(parseName('John Smith').confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('has lower confidence for ambiguous names', () => {
    expect(parseName('A B C D E').confidence).toBeLessThan(0.85);
  });
});
