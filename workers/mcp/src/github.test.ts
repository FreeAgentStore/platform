import { afterEach, describe, expect, it, vi } from 'vitest';
import { listRepoFiles, readRepoFile, textToB64 } from './github.js';

function mockFetch(handler: (url: string) => { status: number; body: unknown }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const { status, body } = handler(url);
      return new Response(JSON.stringify(body), { status });
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const ERROR_STATUSES = [401, 403, 429, 500];

describe('listRepoFiles', () => {
  it.each(ERROR_STATUSES)('throws when the ref call fails with %i', async (status) => {
    mockFetch(() => ({ status, body: { message: 'boom' } }));
    await expect(listRepoFiles('org', 'repo', 't')).rejects.toThrow(String(status));
  });

  it.each(ERROR_STATUSES)('throws when the tree call fails with %i', async (status) => {
    mockFetch((url) =>
      url.includes('/git/ref/')
        ? { status: 200, body: { object: { sha: 'abc' } } }
        : { status, body: { message: 'boom' } },
    );
    await expect(listRepoFiles('org', 'repo', 't')).rejects.toThrow(String(status));
  });

  it('returns blob paths on success', async () => {
    mockFetch((url) =>
      url.includes('/git/ref/')
        ? { status: 200, body: { object: { sha: 'abc' } } }
        : {
            status: 200,
            body: {
              tree: [
                { type: 'blob', path: 'a.ts' },
                { type: 'tree', path: 'src' },
                { type: 'blob', path: 'src/b.ts' },
              ],
            },
          },
    );
    await expect(listRepoFiles('org', 'repo', 't')).resolves.toEqual(['a.ts', 'src/b.ts']);
  });
});

describe('readRepoFile', () => {
  it.each(ERROR_STATUSES)('throws on %i', async (status) => {
    mockFetch(() => ({ status, body: { message: 'boom' } }));
    await expect(readRepoFile('org', 'repo', 't', 'a.ts')).rejects.toThrow(String(status));
  });

  it('returns null on 404', async () => {
    mockFetch(() => ({ status: 404, body: { message: 'Not Found' } }));
    await expect(readRepoFile('org', 'repo', 't', 'a.ts')).resolves.toBeNull();
  });

  it('returns decoded content on success', async () => {
    mockFetch(() => ({ status: 200, body: { content: textToB64('hello') } }));
    await expect(readRepoFile('org', 'repo', 't', 'a.ts')).resolves.toBe('hello');
  });
});
