import { describe, it, expect, vi } from 'vitest';
import { handleApiRoute } from './api';
import type { Env } from './index';

function mockEnv(): Env {
  return {
    DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => null,
          all: async () => ({ results: [] }),
          run: async () => ({}),
        }),
      }),
    } as unknown as D1Database,
    AGENTS: {} as unknown as R2Bucket,
    KEY_ENCRYPTION_KEY: 'dGVzdC1rZXktMzItYnl0ZXMtbG9uZy0xMjM0',
    SESSION_SIGNING_KEY: 'test-signing-key',
  };
}

function makeRequest(method: string, path: string, headers?: Record<string, string>): Request {
  return new Request(`https://freeagentstore.online${path}`, {
    method,
    headers: headers ?? {},
  });
}

describe('handleApiRoute', () => {
  it('GET /v1/keys/providers returns providers list', async () => {
    const env = mockEnv();
    const req = makeRequest('GET', '/v1/keys/providers');
    const url = new URL(req.url);
    const res = await handleApiRoute(req, url, env);

    expect(res.status).toBe(200);
    const body = await res.json() as { providers: { id: string }[] };
    expect(body.providers).toBeInstanceOf(Array);
    expect(body.providers.length).toBe(6);
    const ids = body.providers.map((p: { id: string }) => p.id);
    expect(ids).toContain('openai');
    expect(ids).toContain('anthropic');
    expect(ids).toContain('google');
  });

  it('GET /v1/keys/status without auth returns 401', async () => {
    const env = mockEnv();
    const req = makeRequest('GET', '/v1/keys/status');
    const url = new URL(req.url);
    const res = await handleApiRoute(req, url, env);

    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Unauthorized');
  });

  it('PUT /v1/keys/invalid-provider without auth returns 401', async () => {
    const env = mockEnv();
    const req = makeRequest('PUT', '/v1/keys/invalid-provider');
    const url = new URL(req.url);
    const res = await handleApiRoute(req, url, env);

    expect(res.status).toBe(401);
  });

  it('OPTIONS returns 204 with CORS headers', async () => {
    const env = mockEnv();
    const req = makeRequest('OPTIONS', '/v1/keys/providers');
    const url = new URL(req.url);
    const res = await handleApiRoute(req, url, env);

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('PUT');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('DELETE');
  });

  it('unknown /v1/ route returns 404', async () => {
    const env = mockEnv();
    const req = makeRequest('GET', '/v1/nonexistent');
    const url = new URL(req.url);
    const res = await handleApiRoute(req, url, env);

    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Not found');
  });

  it('GET /v1/keys/providers includes CORS headers in response', async () => {
    const env = mockEnv();
    const req = makeRequest('GET', '/v1/keys/providers');
    const url = new URL(req.url);
    const res = await handleApiRoute(req, url, env);

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Content-Type')).toContain('application/json');
  });

  it('DELETE /v1/keys/openai without auth returns 401', async () => {
    const env = mockEnv();
    const req = makeRequest('DELETE', '/v1/keys/openai');
    const url = new URL(req.url);
    const res = await handleApiRoute(req, url, env);

    expect(res.status).toBe(401);
  });
});
