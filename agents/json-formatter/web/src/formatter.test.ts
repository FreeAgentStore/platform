import { describe, expect, it } from 'vitest';
import {
  formatJson, minifyJson, validateJson, queryJson,
  diffJson, jsonToTypes, highlightJson,
} from './formatter';

describe('formatJson', () => {
  it('formats compact JSON', () => {
    const { result } = formatJson('{"a":1,"b":2}');
    expect(result).toContain('\n');
    expect(result).toContain('  "a": 1');
  });
  it('returns error for invalid JSON', () => {
    const { error } = formatJson('{invalid}');
    expect(error).toBeDefined();
  });
  it('supports custom indent', () => {
    const { result } = formatJson('{"a":1}', 4);
    expect(result).toContain('    "a": 1');
  });
});

describe('minifyJson', () => {
  it('removes whitespace', () => {
    const { result } = minifyJson('{\n  "a": 1,\n  "b": 2\n}');
    expect(result).toBe('{"a":1,"b":2}');
  });
  it('returns error for invalid JSON', () => {
    const { error } = minifyJson('not json');
    expect(error).toBeDefined();
  });
});

describe('validateJson', () => {
  it('validates correct JSON', () => {
    expect(validateJson('{"a": 1}').valid).toBe(true);
  });
  it('rejects invalid JSON', () => {
    const result = validateJson('{bad}');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });
  it('validates arrays', () => {
    expect(validateJson('[1, 2, 3]').valid).toBe(true);
  });
  it('validates primitives', () => {
    expect(validateJson('"hello"').valid).toBe(true);
    expect(validateJson('42').valid).toBe(true);
    expect(validateJson('null').valid).toBe(true);
    expect(validateJson('true').valid).toBe(true);
  });
});

describe('queryJson', () => {
  const data = { user: { name: 'Alice', scores: [10, 20, 30], address: { city: 'NYC' } } };

  it('queries top-level key', () => {
    expect(queryJson(data, 'user')).toEqual(data.user);
  });
  it('queries nested key', () => {
    expect(queryJson(data, 'user.name')).toBe('Alice');
  });
  it('queries deeply nested', () => {
    expect(queryJson(data, 'user.address.city')).toBe('NYC');
  });
  it('queries array index', () => {
    expect(queryJson(data, 'user.scores[1]')).toBe(20);
  });
  it('returns undefined for missing key', () => {
    expect(queryJson(data, 'user.missing')).toBeUndefined();
  });
  it('returns data for empty path', () => {
    expect(queryJson(data, '')).toEqual(data);
  });
  it('handles null gracefully', () => {
    expect(queryJson(null, 'a.b')).toBeUndefined();
  });
});

describe('diffJson', () => {
  it('identical JSON produces all equal lines', () => {
    const json = '{"a": 1}';
    const result = diffJson(json, json);
    expect(result.every(l => l.type === 'equal')).toBe(true);
  });
  it('detects added lines', () => {
    const a = '{"a": 1}';
    const b = '{"a": 1, "b": 2}';
    const result = diffJson(a, b);
    expect(result.some(l => l.type === 'added')).toBe(true);
  });
  it('detects removed lines', () => {
    const a = '{"a": 1, "b": 2}';
    const b = '{"a": 1}';
    const result = diffJson(a, b);
    expect(result.some(l => l.type === 'removed')).toBe(true);
  });
});

describe('jsonToTypes', () => {
  it('generates interface for object', () => {
    const types = jsonToTypes({ name: 'Alice', age: 30 });
    expect(types).toContain('interface');
    expect(types).toContain('name: string');
    expect(types).toContain('age: number');
  });
  it('handles arrays', () => {
    const types = jsonToTypes({ items: [1, 2, 3] });
    expect(types).toContain('number[]');
  });
  it('handles nested objects', () => {
    const types = jsonToTypes({ user: { name: 'Bob' } });
    expect(types).toContain('name: string');
  });
});

describe('highlightJson', () => {
  it('tokenizes simple JSON', () => {
    const tokens = highlightJson('{"a": 1}');
    const types = tokens.map(t => t.type);
    expect(types).toContain('brace');
    expect(types).toContain('key');
    expect(types).toContain('number');
  });
  it('identifies strings vs keys', () => {
    const tokens = highlightJson('{"key": "value"}');
    const keys = tokens.filter(t => t.type === 'key');
    const strings = tokens.filter(t => t.type === 'string');
    expect(keys).toHaveLength(1);
    expect(keys[0].text).toBe('"key"');
    expect(strings).toHaveLength(1);
    expect(strings[0].text).toBe('"value"');
  });
  it('identifies booleans and null', () => {
    const tokens = highlightJson('{"a": true, "b": false, "c": null}');
    const bools = tokens.filter(t => t.type === 'boolean');
    const nulls = tokens.filter(t => t.type === 'null');
    expect(bools).toHaveLength(2);
    expect(nulls).toHaveLength(1);
  });
  it('handles escaped strings', () => {
    const tokens = highlightJson('{"a": "hello\\"world"}');
    const strings = tokens.filter(t => t.type === 'string');
    expect(strings[0].text).toContain('\\"');
  });
  it('handles arrays', () => {
    const tokens = highlightJson('[1, 2, 3]');
    const brackets = tokens.filter(t => t.type === 'bracket');
    expect(brackets).toHaveLength(2);
  });
});
