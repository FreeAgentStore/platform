import { describe, it, expect } from 'vitest';
import { analyzeSentiment } from './heuristic';

describe('sentiment heuristic', () => {
  it('classifies positive text', () => {
    const r = analyzeSentiment('This product is amazing and wonderful!');
    expect(r.sentiment).toBe('positive');
    expect(r.score).toBeGreaterThan(0);
  });

  it('classifies negative text', () => {
    const r = analyzeSentiment('Terrible experience, awful customer service');
    expect(r.sentiment).toBe('negative');
    expect(r.score).toBeLessThan(0);
  });

  it('classifies neutral text', () => {
    const r = analyzeSentiment('The package arrived on Tuesday');
    expect(r.sentiment).toBe('neutral');
  });

  it('handles negation', () => {
    const r = analyzeSentiment('This is not good at all');
    expect(r.sentiment).toBe('negative');
  });

  it('handles intensifiers', () => {
    const strong = analyzeSentiment('This is extremely good');
    const normal = analyzeSentiment('This is good');
    expect(strong.confidence).toBeGreaterThan(normal.confidence);
  });

  it('returns confidence based on signal word count', () => {
    const rich = analyzeSentiment('Great amazing wonderful excellent superb');
    const sparse = analyzeSentiment('It was okay');
    expect(rich.confidence).toBeGreaterThan(sparse.confidence);
  });

  it('handles mixed sentiment', () => {
    const r = analyzeSentiment('The food was great but the service was terrible');
    expect(r.confidence).toBeGreaterThan(0);
    // Could go either way, but should have low absolute score
    expect(Math.abs(r.score)).toBeLessThan(0.5);
  });

  it('handles empty input', () => {
    const r = analyzeSentiment('');
    expect(r.sentiment).toBe('neutral');
    expect(r.score).toBe(0);
  });
});
