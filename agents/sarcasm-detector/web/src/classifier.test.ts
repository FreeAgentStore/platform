import { describe, it, expect } from 'vitest';
import { detectSarcasm } from './classifier';

describe('detectSarcasm', () => {
  it('detects "oh great another meeting" pattern', () => {
    const result = detectSarcasm('Oh great, another meeting that could have been an email. What a wonderful waste of time');
    expect(result.isSarcastic).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.3);
  });

  it('classifies genuine gratitude as not sarcastic', () => {
    const result = detectSarcasm('Thank you for your help, I really appreciate your time and effort');
    expect(result.isSarcastic).toBe(false);
  });

  it('detects "yeah right" as sarcastic', () => {
    const result = detectSarcasm("Yeah right, that's totally going to work");
    expect(result.isSarcastic).toBe(true);
    expect(result.patterns.length).toBeGreaterThan(0);
  });

  it('detects known sarcastic phrases', () => {
    const result = detectSarcasm('What a surprise, the software crashed again');
    expect(result.isSarcastic).toBe(true);
    expect(result.signals.length).toBeGreaterThan(0);
  });

  it('detects positive-negative contradiction', () => {
    const result = detectSarcasm("I love how the app crashes every time I try to save");
    expect(result.isSarcastic).toBe(true);
  });

  it('detects exaggeration and irony markers', () => {
    const result = detectSarcasm('Oh suuure, because that makes total sense. What a surprise. Who would have thought');
    expect(result.isSarcastic).toBe(true);
  });

  it('returns empty input as not sarcastic', () => {
    const result = detectSarcasm('');
    expect(result.isSarcastic).toBe(false);
    expect(result.score).toBe(0);
  });

  it('returns score between 0 and 1', () => {
    const result = detectSarcasm('The weather is nice today');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });
});
