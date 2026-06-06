import { describe, it, expect } from 'vitest';
import { createProject, exportProject, importProject, STARTER_TEMPLATES } from './store';

describe('createProject', () => {
  it('creates with spec and empty defaults', () => {
    const p = createProject({ name: 'test', description: 'desc', inputType: 'string', outputType: 'number' });
    expect(p.id).toBeTruthy();
    expect(p.spec.name).toBe('test');
    expect(p.examples).toEqual([]);
    expect(p.currentCode).toBe('');
    expect(p.history).toEqual([]);
    expect(p.createdAt).toBeGreaterThan(0);
  });

  it('generates unique IDs', () => {
    const a = createProject({ name: 'a', description: '', inputType: '', outputType: '' });
    const b = createProject({ name: 'b', description: '', inputType: '', outputType: '' });
    expect(a.id).not.toBe(b.id);
  });
});

describe('exportProject / importProject', () => {
  it('round-trips a project', () => {
    const p = createProject({ name: 'test', description: 'desc', inputType: 'string', outputType: 'number' });
    p.examples = [{ id: '1', input: '"hello"', expectedOutput: '5', weight: 1 }];
    p.currentCode = 'return input.length;';

    const json = exportProject(p);
    const imported = importProject(json);

    expect(imported.id).toBe(p.id);
    expect(imported.spec.name).toBe('test');
    expect(imported.examples).toHaveLength(1);
    expect(imported.currentCode).toBe('return input.length;');
  });

  it('rejects invalid JSON', () => {
    expect(() => importProject('not json')).toThrow();
  });

  it('rejects missing spec.name', () => {
    expect(() => importProject('{"spec": {}}')).toThrow('missing spec.name');
  });
});

describe('STARTER_TEMPLATES', () => {
  it('has at least 4 templates', () => {
    expect(STARTER_TEMPLATES.length).toBeGreaterThanOrEqual(4);
  });

  it('all templates have valid structure', () => {
    for (const t of STARTER_TEMPLATES) {
      expect(t.name).toBeTruthy();
      expect(t.spec.name).toBeTruthy();
      expect(t.spec.description).toBeTruthy();
      expect(t.spec.inputType).toBeTruthy();
      expect(t.spec.outputType).toBeTruthy();
      expect(t.examples.length).toBeGreaterThan(0);
    }
  });

  it('all examples have valid JSON in input/output', () => {
    for (const t of STARTER_TEMPLATES) {
      for (const ex of t.examples) {
        expect(() => JSON.parse(ex.input)).not.toThrow();
        expect(() => JSON.parse(ex.expectedOutput)).not.toThrow();
      }
    }
  });
});
