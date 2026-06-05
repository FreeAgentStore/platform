import { describe, it, expect } from 'vitest';
import { convert, getCategories } from './converter';

describe('convert', () => {
  it('converts km to miles', () => {
    const r = convert(10, 'km', 'mi');
    expect('result' in r && r.result).toBeCloseTo(6.21371, 3);
  });

  it('converts fahrenheit to celsius', () => {
    const r = convert(212, 'f', 'c');
    expect('result' in r && r.result).toBeCloseTo(100, 1);
  });

  it('converts celsius to kelvin', () => {
    const r = convert(0, 'c', 'k');
    expect('result' in r && r.result).toBeCloseTo(273.15, 2);
  });

  it('converts pounds to kg', () => {
    const r = convert(100, 'lb', 'kg');
    expect('result' in r && r.result).toBeCloseTo(45.359, 2);
  });

  it('converts gallons to liters', () => {
    const r = convert(1, 'gal', 'l');
    expect('result' in r && r.result).toBeCloseTo(3.785, 2);
  });

  it('converts GB to MB', () => {
    const r = convert(1, 'gb', 'mb');
    expect('result' in r && r.result).toBe(1024);
  });

  it('converts hours to minutes', () => {
    const r = convert(2.5, 'hr', 'min');
    expect('result' in r && r.result).toBe(150);
  });

  it('converts mph to km/h', () => {
    const r = convert(60, 'mph', 'kmh');
    expect('result' in r && r.result).toBeCloseTo(96.56, 1);
  });

  it('returns error for unknown unit', () => {
    const r = convert(1, 'foo', 'bar');
    expect('error' in r).toBe(true);
  });

  it('returns error for cross-category conversion', () => {
    const r = convert(1, 'km', 'kg');
    expect('error' in r && r.error).toContain('Cannot convert');
  });

  it('formats result string', () => {
    const r = convert(1, 'km', 'm');
    expect('formatted' in r && r.formatted).toContain('1000');
  });
});

describe('getCategories', () => {
  it('returns all 7 categories', () => {
    const cats = getCategories();
    expect(cats.length).toBe(7);
    expect(cats.map(c => c.category).sort()).toEqual(['data', 'length', 'speed', 'temperature', 'time', 'volume', 'weight']);
  });

  it('each category has units', () => {
    for (const cat of getCategories()) {
      expect(cat.units.length).toBeGreaterThan(0);
    }
  });
});
