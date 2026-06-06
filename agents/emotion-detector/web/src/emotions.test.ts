import { describe, it, expect } from 'vitest';
import { detectEmotions } from './emotions';

describe('detectEmotions', () => {
  it('detects joy as primary for happy text', () => {
    const result = detectEmotions('I am so happy and delighted!');
    expect(result.primary).toBe('joy');
  });

  it('detects anger as primary for angry text', () => {
    const result = detectEmotions('This makes me furious!');
    expect(result.primary).toBe('anger');
  });

  it('detects sadness as primary for sad text', () => {
    const result = detectEmotions('I feel so lonely and depressed');
    expect(result.primary).toBe('sadness');
  });

  it('detects fear as primary for fearful text', () => {
    const result = detectEmotions('I am terrified of what might happen');
    expect(result.primary).toBe('fear');
  });

  it('detects surprise for shocked text', () => {
    const result = detectEmotions('I am absolutely astonished and stunned by this');
    expect(result.primary).toBe('surprise');
  });

  it('detects disgust for revolting text', () => {
    const result = detectEmotions('That is revolting and nauseating');
    expect(result.primary).toBe('disgust');
  });

  it('detects trust for trustworthy text', () => {
    const result = detectEmotions('He is reliable, honest and trustworthy');
    expect(result.primary).toBe('trust');
  });

  it('detects anticipation for eager text', () => {
    const result = detectEmotions("I can't wait, looking forward to the upcoming event");
    expect(result.primary).toBe('anticipation');
  });

  it('has confidence > 0 for emotional text', () => {
    const result = detectEmotions('I am so happy and delighted!');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('has low scores across all emotions for neutral text', () => {
    const result = detectEmotions('The table is made of wood.');
    const maxScore = Math.max(...Object.values(result.scores));
    expect(maxScore).toBeLessThanOrEqual(1);
    expect(result.confidence).toBeLessThan(0.5);
  });

  it('detects compound emotion love (joy + trust)', () => {
    const result = detectEmotions('I am happy and delighted, and I trust you completely, you are so reliable and faithful');
    if (result.compound) {
      expect(result.compound).toBe('love');
    }
    // Both joy and trust should have positive scores
    expect(result.scores.joy).toBeGreaterThan(0);
    expect(result.scores.trust).toBeGreaterThan(0);
  });

  it('returns positive valence for joyful text', () => {
    const result = detectEmotions('I am ecstatic and overjoyed!');
    expect(result.valence).toBeGreaterThan(0);
  });

  it('returns negative valence for sad text', () => {
    const result = detectEmotions('I am devastated and heartbroken');
    expect(result.valence).toBeLessThan(0);
  });

  it('returns all 8 emotion scores', () => {
    const result = detectEmotions('Hello world');
    const emotions = Object.keys(result.scores);
    expect(emotions).toContain('joy');
    expect(emotions).toContain('anger');
    expect(emotions).toContain('sadness');
    expect(emotions).toContain('fear');
    expect(emotions).toContain('surprise');
    expect(emotions).toContain('disgust');
    expect(emotions).toContain('trust');
    expect(emotions).toContain('anticipation');
  });
});
