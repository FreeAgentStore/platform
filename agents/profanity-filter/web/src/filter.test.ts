import { describe, it, expect } from 'vitest';
import { checkProfanity, cleanText } from './filter';

describe('checkProfanity', () => {
  it('does not flag clean text', () => {
    const result = checkProfanity('Hello world');
    expect(result.flagged).toBe(false);
    expect(result.severity).toBe('none');
  });

  it('flags severe profanity', () => {
    const result = checkProfanity('What the fuck');
    expect(result.flagged).toBe(true);
    expect(result.severity).toBe('severe');
  });

  it('flags moderate profanity', () => {
    const result = checkProfanity('That is bullshit');
    expect(result.flagged).toBe(true);
    expect(result.severity).toBe('moderate');
  });

  it('flags mild profanity', () => {
    const result = checkProfanity('Oh damn it');
    expect(result.flagged).toBe(true);
    expect(result.severity).toBe('mild');
  });

  it('is context-aware for animal "donkey"', () => {
    const result = checkProfanity('The donkey kicked');
    expect(result.flagged).toBe(false);
  });

  it('detects direct profanity', () => {
    const result = checkProfanity('that is total shit');
    expect(result.flagged).toBe(true);
  });

  it('does not flag innocent words containing profane substrings', () => {
    const result = checkProfanity('The class assignment is about assessment');
    expect(result.flagged).toBe(false);
  });

  it('does not flag "hello" even though it contains "hell"', () => {
    const result = checkProfanity('hello everyone');
    expect(result.flagged).toBe(false);
  });

  it('returns score > 0 for flagged text', () => {
    const result = checkProfanity('What the fuck');
    expect(result.score).toBeGreaterThan(0);
  });
});

describe('cleanText', () => {
  it('replaces profanity with asterisks', () => {
    const result = cleanText('What the fuck is this');
    expect(result).not.toContain('fuck');
    expect(result).toContain('****');
  });

  it('preserves innocent words', () => {
    const result = cleanText('The class is in session');
    expect(result).toBe('The class is in session');
  });
});
