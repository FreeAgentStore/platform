import { describe, it, expect } from 'vitest';
import { classifyFeedback } from './classifier';

describe('classifyFeedback', () => {
  it('classifies bug report text', () => {
    const result = classifyFeedback(
      "The app crashes every time I try to save. I'm getting an error message: TypeError at line 42. Steps to reproduce: open settings, click save.",
    );
    expect(result.type).toBe('bug');
    expect(result.actionable).toBe(true);
  });

  it('classifies feature request text', () => {
    const result = classifyFeedback(
      'It would be great if you could add dark mode support. I would love to see this feature in the next release.',
    );
    expect(result.type).toBe('feature');
    expect(result.actionable).toBe(true);
  });

  it('classifies complaint text', () => {
    const result = classifyFeedback(
      'This is terrible. Worst experience ever. Complete waste of money. I want a refund and will never use this again.',
    );
    expect(result.type).toBe('complaint');
    expect(result.actionable).toBe(false);
  });

  it('classifies praise text', () => {
    const result = classifyFeedback(
      'Amazing app! Love this tool. Works perfectly and saved me hours. Highly recommend to everyone. Five stars!',
    );
    expect(result.type).toBe('praise');
  });

  it('classifies question text', () => {
    const result = classifyFeedback('How do I reset my password? Where can I find the settings page?');
    expect(result.type).toBe('question');
    expect(result.actionable).toBe(false);
  });

  it('classifies suggestion text', () => {
    const result = classifyFeedback(
      "Have you considered simplifying the onboarding flow? I'd suggest a different approach that might streamline the process.",
    );
    expect(result.type).toBe('suggestion');
    expect(result.actionable).toBe(true);
  });

  it('returns all 6 feedback type scores', () => {
    const result = classifyFeedback('Some general feedback about the product');
    expect(Object.keys(result.scores)).toHaveLength(6);
    expect(result.scores).toHaveProperty('bug');
    expect(result.scores).toHaveProperty('feature');
    expect(result.scores).toHaveProperty('complaint');
    expect(result.scores).toHaveProperty('praise');
    expect(result.scores).toHaveProperty('question');
    expect(result.scores).toHaveProperty('suggestion');
  });

  it('detects structural bug signals like error codes', () => {
    const result = classifyFeedback(
      'Getting ERR_CONNECTION_REFUSED when trying to connect. The TypeError stack trace shows the issue in module.ts:15:3.',
    );
    expect(result.type).toBe('bug');
    expect(result.signals.length).toBeGreaterThan(0);
  });
});
