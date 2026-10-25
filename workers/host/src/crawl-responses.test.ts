import { describe, expect, it } from 'vitest';
import worker, { type Env } from './index';

function environment(): Env {
  return {
    AGENTS: {
      get: async () => ({ body: '<xml/>', httpEtag: '"revision"' }),
    },
  } as unknown as Env;
}

describe('deployed crawl-file response policy', () => {
  for (const path of ['/sitemap.xml', '/robots.txt']) {
    it(`revalidates ${path} instead of caching it immutable for a year`, async () => {
      const response = await worker.fetch(
        new Request(`https://freeagentstore.online${path}`, { method: 'HEAD' }),
        environment(),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=60, must-revalidate');
    });

    it(`preserves revalidation policy on ${path} 304 responses`, async () => {
      const response = await worker.fetch(
        new Request(`https://freeagentstore.online${path}`, {
          method: 'HEAD',
          headers: { 'If-None-Match': '"revision"' },
        }),
        environment(),
      );
      expect(response.status).toBe(304);
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=60, must-revalidate');
      expect(response.headers.get('ETag')).toBe('"revision"');
    });
  }

  it('keeps immutable caching for versioned assets', async () => {
    const response = await worker.fetch(
      new Request('https://freeagentstore.online/assets/app-abc123.js', { method: 'HEAD' }),
      environment(),
    );
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
  });
});
