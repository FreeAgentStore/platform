import { describe, it, expect } from 'vitest';
import { evaluate, buildPrompt, extractCode, type Example, type AgentSpec } from './evolve';

describe('evaluate', () => {
  const examples: Example[] = [
    { id: '1', input: '"hello"', expectedOutput: '"HELLO"', weight: 1 },
    { id: '2', input: '"world"', expectedOutput: '"WORLD"', weight: 1 },
  ];

  it('scores correct code as 100%', () => {
    const code = 'return input.toUpperCase();';
    const r = evaluate(code, examples);
    expect(r.score).toBe(1);
    expect(r.passed).toBe(2);
    expect(r.total).toBe(2);
    expect(r.results.every(x => x.passed)).toBe(true);
  });

  it('scores incorrect code as 0%', () => {
    const code = 'return input;';
    const r = evaluate(code, examples);
    expect(r.score).toBe(0);
    expect(r.passed).toBe(0);
    expect(r.results.every(x => !x.passed)).toBe(true);
  });

  it('scores partial correctness', () => {
    // Returns uppercase only for "hello"
    const code = 'return input === "hello" ? "HELLO" : input;';
    const r = evaluate(code, examples);
    expect(r.score).toBe(0.5);
    expect(r.passed).toBe(1);
  });

  it('handles compile errors gracefully', () => {
    const code = 'return {{{invalid code';
    const r = evaluate(code, examples);
    expect(r.score).toBe(0);
    expect(r.passed).toBe(0);
    expect(r.results[0].error).toContain('Compile error');
  });

  it('handles runtime errors gracefully', () => {
    const code = 'return input.nonexistent.method();';
    const r = evaluate(code, examples);
    expect(r.score).toBe(0);
    expect(r.results[0].error).toBeDefined();
  });

  it('respects weights', () => {
    const weighted: Example[] = [
      { id: '1', input: '"a"', expectedOutput: '"A"', weight: 3 },
      { id: '2', input: '"b"', expectedOutput: '"B"', weight: 1 },
    ];
    // Only gets first one right
    const code = 'return input === "a" ? "A" : input;';
    const r = evaluate(code, weighted);
    expect(r.score).toBe(0.75); // 3/(3+1)
  });

  it('handles zero weight without division by zero', () => {
    const r = evaluate('return input;', []);
    expect(r.score).toBe(0);
    expect(r.total).toBe(0);
  });

  it('uses custom scoring function', () => {
    const exs: Example[] = [
      { id: '1', input: '5', expectedOutput: '10', weight: 1 },
    ];
    // Custom scorer: close enough = pass (within 20%)
    const scoreFn = `
      const diff = Math.abs(actual - expected);
      return diff <= expected * 0.2 ? 1 : 0;
    `;
    // Returns 9 instead of 10, but within 20%
    const r = evaluate('return input * 1.8;', exs, scoreFn);
    expect(r.score).toBe(1);
  });

  it('records timing per example', () => {
    const r = evaluate('return input.toUpperCase();', examples);
    for (const result of r.results) {
      expect(result.timeMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('handles JSON parse errors in input', () => {
    const bad: Example[] = [
      { id: '1', input: 'not valid json', expectedOutput: '"ok"', weight: 1 },
    ];
    const r = evaluate('return "ok";', bad);
    expect(r.passed).toBe(0);
    expect(r.results[0].error).toBeDefined();
  });
});

describe('buildPrompt', () => {
  const spec: AgentSpec = {
    name: 'test',
    description: 'Uppercase a string',
    inputType: 'string',
    outputType: 'string',
  };

  const examples: Example[] = [
    { id: '1', input: '"hello"', expectedOutput: '"HELLO"', weight: 1 },
  ];

  it('includes task description', () => {
    const p = buildPrompt(spec, examples);
    expect(p).toContain('Uppercase a string');
  });

  it('includes examples', () => {
    const p = buildPrompt(spec, examples);
    expect(p).toContain('"hello"');
    expect(p).toContain('"HELLO"');
  });

  it('includes current code when provided', () => {
    const p = buildPrompt(spec, examples, 'return input.toUpperCase();');
    expect(p).toContain('return input.toUpperCase();');
    expect(p).toContain('Current Code');
  });

  it('includes failures from eval result', () => {
    const p = buildPrompt(spec, examples, 'return input;', {
      score: 0, passed: 0, total: 1,
      results: [{ id: '1', passed: false, actual: '"hello"', timeMs: 0 }],
    });
    expect(p).toContain('Failures');
    expect(p).toContain('Score: 0.0%');
  });

  it('caps examples at 20 in prompt', () => {
    const manyExamples = Array.from({ length: 30 }, (_, i) => ({
      id: String(i), input: `"${i}"`, expectedOutput: `"${i}"`, weight: 1,
    }));
    const p = buildPrompt(spec, manyExamples);
    expect(p).toContain('and 10 more');
  });

  it('includes determinism rules', () => {
    const p = buildPrompt(spec, examples);
    expect(p).toContain('DETERMINISTIC');
    expect(p).toContain('No external libs');
  });
});

describe('extractCode', () => {
  it('extracts from javascript fence', () => {
    const raw = 'Here is the code:\n```javascript\nreturn input.toUpperCase();\n```\nDone.';
    expect(extractCode(raw)).toBe('return input.toUpperCase();');
  });

  it('extracts from js fence', () => {
    const raw = '```js\nreturn 42;\n```';
    expect(extractCode(raw)).toBe('return 42;');
  });

  it('extracts from typescript fence', () => {
    const raw = '```typescript\nconst x: number = 1;\nreturn x;\n```';
    expect(extractCode(raw)).toBe('const x: number = 1;\nreturn x;');
  });

  it('extracts from bare fence', () => {
    const raw = '```\nreturn input;\n```';
    expect(extractCode(raw)).toBe('return input;');
  });

  it('returns raw text if no fence', () => {
    const raw = 'return input.toUpperCase();';
    expect(extractCode(raw)).toBe('return input.toUpperCase();');
  });

  it('trims whitespace', () => {
    const raw = '  \n  return 1;  \n  ';
    expect(extractCode(raw)).toBe('return 1;');
  });
});
