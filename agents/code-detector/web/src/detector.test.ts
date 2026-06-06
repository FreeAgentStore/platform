import { describe, it, expect } from 'vitest';
import { detectLanguage } from './detector';

describe('detectLanguage (code)', () => {
  it('detects Python', () => {
    const result = detectLanguage('def hello():\n  print("hi")');
    expect(result.languageId).toBe('python');
  });

  it('detects JavaScript', () => {
    const result = detectLanguage('const x = 42; console.log(x);');
    expect(result.languageId).toBe('javascript');
  });

  it('detects TypeScript', () => {
    const result = detectLanguage('const x: number = 42;\ninterface Foo { bar: string; }');
    expect(result.languageId).toBe('typescript');
  });

  it('detects SQL', () => {
    const result = detectLanguage('SELECT * FROM users WHERE id = 1');
    expect(result.languageId).toBe('sql');
  });

  it('detects HTML', () => {
    const result = detectLanguage('<div class="hello">Hi</div>');
    expect(result.languageId).toBe('html');
  });

  it('has confidence > 0 for clear code snippets', () => {
    const result = detectLanguage('def hello():\n  print("hi")');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('returns language name in result', () => {
    const result = detectLanguage('def hello():\n  print("hi")');
    expect(result.language).toBe('Python');
  });

  it('returns Unknown for empty input', () => {
    const result = detectLanguage('');
    expect(result.languageId).toBe('unknown');
  });

  it('detects Rust', () => {
    const result = detectLanguage('fn main() {\n  let mut x = 5;\n  println!("x = {}", x);\n}');
    expect(result.languageId).toBe('rust');
  });

  it('returns top scores array', () => {
    const result = detectLanguage('const x = 42; console.log(x);');
    expect(result.scores.length).toBeGreaterThan(0);
    expect(result.scores[0]).toHaveProperty('language');
    expect(result.scores[0]).toHaveProperty('id');
    expect(result.scores[0]).toHaveProperty('score');
  });
});
