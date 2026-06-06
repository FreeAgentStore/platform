import { describe, it, expect } from 'vitest';
import { parseAddress } from './parser';

describe('parseAddress', () => {
  it('parses a standard US address', () => {
    const result = parseAddress('123 Main St, San Francisco, CA 94102');
    expect(result).not.toBeNull();
    expect(result!.street).toContain('Main');
    expect(result!.city).toBe('San Francisco');
    expect(result!.state).toBe('CA');
    expect(result!.zip).toBe('94102');
    expect(result!.format).toBe('us');
  });

  it('parses a US address with apartment unit', () => {
    const result = parseAddress('123 Main St Apt 4B, San Francisco, CA 94102');
    expect(result).not.toBeNull();
    expect(result!.unit).toBe('4B');
    expect(result!.state).toBe('CA');
    expect(result!.zip).toBe('94102');
  });

  it('parses a UK address with postcode', () => {
    const result = parseAddress('10 Downing Street, London SW1A 2AA');
    expect(result).not.toBeNull();
    expect(result!.street).toContain('Downing');
    expect(result!.zip).toBe('SW1A 2AA');
    expect(result!.format).toBe('uk');
  });

  it('returns null for garbage input', () => {
    const result = parseAddress('asdfghjkl');
    expect(result).toBeNull();
  });

  it('returns null for very short input', () => {
    const result = parseAddress('ab');
    expect(result).toBeNull();
  });

  it('has confidence > 0 for valid addresses', () => {
    const result = parseAddress('123 Main St, San Francisco, CA 94102');
    expect(result).not.toBeNull();
    expect(result!.confidence).toBeGreaterThan(0);
  });

  it('sets country to United States for US addresses', () => {
    const result = parseAddress('456 Oak Ave, Los Angeles, CA 90001');
    expect(result).not.toBeNull();
    expect(result!.country).toBe('United States');
  });

  it('produces a formatted string', () => {
    const result = parseAddress('123 Main St, San Francisco, CA 94102');
    expect(result).not.toBeNull();
    expect(result!.formatted.length).toBeGreaterThan(0);
  });
});
