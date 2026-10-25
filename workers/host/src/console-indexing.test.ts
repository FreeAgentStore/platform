import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import worker, { type Env } from './index';

const shell = fs.readFileSync(
  new URL('../../../store/console/index.html', import.meta.url),
  'utf8',
);
function environment(): Env {
  return {
    AGENTS: {
      get: async (key: string) =>
        key === 'console/index.html' ? { body: shell, httpEtag: '"console"' } : null,
    },
  } as unknown as Env;
}

describe('creator console indexing boundary', () => {
  for (const path of ['/console', '/console/', '/console/settings', '/console/keys/']) {
    for (const method of ['GET', 'HEAD']) {
      it(`excludes ${method} ${path}, including SPA fallbacks`, async () => {
        const response = await worker.fetch(
          new Request(`https://freeagentstore.online${path}`, { method }),
          environment(),
        );
        expect(response.status).toBe(200);
        expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
        expect(await response.text()).toContain('<meta name="robots" content="noindex, nofollow">');
      });
    }
  }

  it('keeps noindex on a conditional 304 response', async () => {
    const response = await worker.fetch(
      new Request('https://freeagentstore.online/console/settings', {
        method: 'HEAD',
        headers: { 'If-None-Match': '"console"' },
      }),
      environment(),
    );
    expect(response.status).toBe(304);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('does not turn similarly named public paths into the creator console', async () => {
    const response = await worker.fetch(
      new Request('https://freeagentstore.online/console-example', { method: 'HEAD' }),
      environment(),
    );
    expect(response.status).toBe(404);
  });
});
