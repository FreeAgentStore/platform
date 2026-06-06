import { describe, it, expect } from 'vitest';
import { detectClickbait } from './classifier';

describe('detectClickbait', () => {
  it('detects clickbait with curiosity gap', () => {
    const result = detectClickbait("You Won't BELIEVE What This Man Found In His Backyard!!");
    expect(result.isClickbait).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.3);
  });

  it('classifies genuine news headline as not clickbait', () => {
    const result = detectClickbait('Apple Reports Q3 Revenue of $81.8 Billion');
    expect(result.isClickbait).toBe(false);
    expect(result.category).toBe('genuine');
  });

  it('detects emotional manipulation phrases', () => {
    const result = detectClickbait('This Video Will Make You Cry!! Will Blow Your Mind — Faith In Humanity Restored!! You Need To See This!!');
    expect(result.isClickbait).toBe(true);
    expect(result.signals.length).toBeGreaterThan(0);
  });

  it('detects urgency and FOMO patterns', () => {
    const result = detectClickbait("Watch Before It Gets Taken Down!! They're Trying To Remove This");
    expect(result.isClickbait).toBe(true);
    expect(result.score).toBeGreaterThan(0.3);
  });

  it('detects listicle clickbait patterns', () => {
    const result = detectClickbait('10 Shocking Secrets Your Doctor Will Never Tell You — Number 5 Will Blow Your Mind!!');
    expect(result.isClickbait).toBe(true);
    expect(result.signals.length).toBeGreaterThan(0);
  });

  it('reduces score for factual anti-clickbait signals', () => {
    const genuine = detectClickbait(
      'According to a study published in the Journal of Medicine, researchers at Harvard University found that approximately 45% of patients showed improvement.',
    );
    expect(genuine.isClickbait).toBe(false);
  });

  it('detects vagueness phrases', () => {
    const result = detectClickbait('Doctors Hate This One Simple Trick To Lose Weight');
    expect(result.isClickbait).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.3);
  });

  it('returns score between 0 and 1', () => {
    const result = detectClickbait('Some random text about everyday life');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });
});
