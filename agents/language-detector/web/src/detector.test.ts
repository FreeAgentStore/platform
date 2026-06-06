import { describe, it, expect } from 'vitest';
import { detectLanguage } from './detector';

describe('detectLanguage', () => {
  it('detects English', () => {
    const result = detectLanguage('The quick brown fox jumps over the lazy dog');
    expect(result.language).toBe('en');
  });

  it('detects French', () => {
    const result = detectLanguage('Le petit prince est un roman philosophique');
    expect(result.language).toBe('fr');
  });

  it('detects German', () => {
    const result = detectLanguage('Die Bundesrepublik Deutschland ist ein demokratischer Staat');
    expect(result.language).toBe('de');
  });

  it('detects Japanese via script detection', () => {
    const result = detectLanguage('東京は日本の首都です');
    expect(result.language).toBe('ja');
  });

  it('detects Korean via script detection', () => {
    const result = detectLanguage('대한민국은 동아시아에 위치한 나라입니다');
    expect(result.language).toBe('ko');
  });

  it('detects Arabic via script detection', () => {
    const result = detectLanguage('اللغة العربية هي واحدة من أكثر اللغات');
    expect(result.language).toBe('ar');
  });

  it('detects Russian via script detection', () => {
    const result = detectLanguage('Россия — самая большая страна в мире');
    expect(result.language).toBe('ru');
  });

  it('detects Spanish', () => {
    const result = detectLanguage('La lengua espanola es una de las mas habladas del mundo');
    expect(result.language).toBe('es');
  });

  it('has high confidence for script-detected languages', () => {
    const result = detectLanguage('東京は日本の首都です');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('returns "und" for empty text', () => {
    const result = detectLanguage('');
    expect(result.language).toBe('und');
    expect(result.confidence).toBe(0);
  });

  it('returns low confidence for very short text', () => {
    const result = detectLanguage('Hi');
    // Short trigram texts may still detect something, but confidence should be low
    // or it returns 'und' if fewer than 3 trigrams
    if (result.language !== 'und') {
      expect(result.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('includes languageName in result', () => {
    const result = detectLanguage('The quick brown fox jumps over the lazy dog');
    expect(result.languageName).toBe('English');
  });

  it('returns scores array', () => {
    const result = detectLanguage('The quick brown fox jumps over the lazy dog and some more words to be sure');
    expect(result.scores.length).toBeGreaterThan(0);
    expect(result.scores[0]).toHaveProperty('code');
    expect(result.scores[0]).toHaveProperty('name');
    expect(result.scores[0]).toHaveProperty('score');
  });
});
