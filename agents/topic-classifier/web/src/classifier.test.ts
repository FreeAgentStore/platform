import { describe, it, expect } from 'vitest';
import { classifyTopic } from './classifier';

describe('classifyTopic', () => {
  it('classifies technology text correctly', () => {
    const result = classifyTopic(
      'The new AI framework uses machine learning and deep learning algorithms for natural language processing',
    );
    expect(result.topic).toBe('technology');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('classifies sports text correctly', () => {
    const result = classifyTopic(
      'The quarterback threw a touchdown pass in the fourth quarter to win the championship game',
    );
    expect(result.topic).toBe('sports');
  });

  it('classifies health text correctly', () => {
    const result = classifyTopic(
      'The clinical trial showed that the new vaccine reduced infection rates among patients with cardiovascular disease',
    );
    expect(result.topic).toBe('health');
  });

  it('classifies finance text correctly', () => {
    const result = classifyTopic(
      'The stock market rallied as the Federal Reserve announced interest rate cuts and bond yields dropped',
    );
    expect(result.topic).toBe('finance');
  });

  it('classifies education text correctly', () => {
    const result = classifyTopic(
      'The university announced new scholarship programs for graduate students and increased tuition financial aid',
    );
    expect(result.topic).toBe('education');
  });

  it('classifies science text correctly', () => {
    const result = classifyTopic(
      'NASA researchers discovered a new exoplanet using the James Webb telescope near a distant galaxy',
    );
    expect(result.topic).toBe('science');
  });

  it('returns all 10 topic scores', () => {
    const result = classifyTopic('Some generic text about various things');
    expect(Object.keys(result.scores)).toHaveLength(10);
  });

  it('detects secondary topic when relevant', () => {
    const result = classifyTopic(
      'The tech startup CEO announced record quarterly revenue growth after the IPO on the stock market',
    );
    expect(result.topic).toBeDefined();
    expect(result.secondary).not.toBeNull();
  });
});
