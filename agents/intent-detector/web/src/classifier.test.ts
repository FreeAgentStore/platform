import { describe, it, expect } from 'vitest';
import { detectIntent } from './classifier';

describe('detectIntent', () => {
  it('detects question intent', () => {
    const result = detectIntent('What time is it?');
    expect(result.intent).toBe('question');
  });

  it('detects command intent', () => {
    const result = detectIntent('Please send the report');
    expect(result.intent).toBe('command');
  });

  it('detects statement intent', () => {
    const result = detectIntent('The weather is nice today.');
    expect(result.intent).toBe('statement');
  });

  it('detects greeting intent', () => {
    const result = detectIntent('Hey there!');
    expect(result.intent).toBe('greeting');
  });

  it('detects farewell intent', () => {
    const result = detectIntent('Goodbye, see you later');
    expect(result.intent).toBe('farewell');
  });

  it('question mark boosts question score', () => {
    const withQ = detectIntent('This is something?');
    const withoutQ = detectIntent('This is something');
    expect(withQ.scores.question).toBeGreaterThan(withoutQ.scores.question);
  });

  it('imperative verb at start boosts command score', () => {
    const result = detectIntent('Send the report now');
    expect(result.scores.command).toBeGreaterThan(0);
    expect(result.signals).toContain('struct:imperative-start');
  });

  it('returns all 6 intent scores', () => {
    const result = detectIntent('Hello world');
    expect(result.scores).toHaveProperty('question');
    expect(result.scores).toHaveProperty('command');
    expect(result.scores).toHaveProperty('statement');
    expect(result.scores).toHaveProperty('greeting');
    expect(result.scores).toHaveProperty('farewell');
    expect(result.scores).toHaveProperty('exclamation');
  });

  it('returns statement for empty input', () => {
    const result = detectIntent('');
    expect(result.intent).toBe('statement');
    expect(result.confidence).toBe(0);
  });

  it('detects exclamation with exclamation marks', () => {
    const result = detectIntent('Wow, that is amazing!!!');
    expect(result.intent).toBe('exclamation');
  });
});
