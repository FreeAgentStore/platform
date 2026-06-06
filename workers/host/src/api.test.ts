import { describe, expect, it } from 'vitest';
import { handleApiRoute } from './api';
import type { Env } from './index';

function mockEnv(overrides?: Partial<Env>): Env {
  return {
    DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => null,
          all: async () => ({ results: [] }),
          run: async () => ({ meta: { changes: 1 } }),
        }),
      }),
    } as unknown as D1Database,
    AGENTS: {} as unknown as R2Bucket,
    KEY_ENCRYPTION_KEY: 'dGVzdGtleTMyYnl0ZXMxMjM0NTY3ODkw', // valid base64, 24 bytes decoded — will fail length check
    SESSION_SIGNING_KEY: 'test-signing-key-for-hmac',
    ...overrides,
  };
}

function makeRequest(
  method: string,
  path: string,
  opts?: { headers?: Record<string, string>; body?: string },
): Request {
  return new Request(`https://freeagentstore.online${path}`, {
    method,
    headers: opts?.headers ?? {},
    body: opts?.body,
  });
}

// Helper: create a valid session token for testing
async function createTestToken(uid: string, signingKey: string): Promise<string> {
  const payload = {
    uid,
    login: 'test-user',
    avatar: '',
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const payloadB64 = btoa(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(signingKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64)),
  );
  const sigHex = Array.from(sig)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${payloadB64}.${sigHex}`;
}

describe('handleApiRoute', () => {
  // ── Providers ──
  it('GET /v1/keys/providers returns 6 providers', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/keys/providers'),
      new URL('https://freeagentstore.online/v1/keys/providers'),
      mockEnv(),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { providers: { id: string }[] };
    expect(body.providers.length).toBe(6);
    expect(body.providers.map((p) => p.id)).toContain('openai');
    expect(body.providers.map((p) => p.id)).toContain('anthropic');
    expect(body.providers.map((p) => p.id)).toContain('google');
    expect(body.providers.map((p) => p.id)).toContain('groq');
  });

  // ── Auth required routes ──
  it('GET /v1/keys/status without auth returns 401', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/keys/status'),
      new URL('https://freeagentstore.online/v1/keys/status'),
      mockEnv(),
    );
    expect(res.status).toBe(401);
  });

  it('PUT /v1/keys/openai without auth returns 401', async () => {
    const res = await handleApiRoute(
      makeRequest('PUT', '/v1/keys/openai', {
        body: JSON.stringify({ key: 'sk-test' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      new URL('https://freeagentstore.online/v1/keys/openai'),
      mockEnv(),
    );
    expect(res.status).toBe(401);
  });

  it('DELETE /v1/keys/openai without auth returns 401', async () => {
    const res = await handleApiRoute(
      makeRequest('DELETE', '/v1/keys/openai'),
      new URL('https://freeagentstore.online/v1/keys/openai'),
      mockEnv(),
    );
    expect(res.status).toBe(401);
  });

  // ── Auth with valid token ──
  it('GET /v1/keys/status with valid token returns keys array', async () => {
    const signingKey = 'test-signing-key-for-hmac';
    const token = await createTestToken('user-123', signingKey);
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/keys/status', { headers: { Authorization: `Bearer ${token}` } }),
      new URL('https://freeagentstore.online/v1/keys/status'),
      mockEnv({ SESSION_SIGNING_KEY: signingKey }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { keys: unknown[] };
    expect(body.keys).toBeInstanceOf(Array);
  });

  it('GET /v1/auth/me with valid token returns user info', async () => {
    const signingKey = 'test-signing-key-for-hmac';
    const token = await createTestToken('user-123', signingKey);
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/auth/me', { headers: { Authorization: `Bearer ${token}` } }),
      new URL('https://freeagentstore.online/v1/auth/me'),
      mockEnv({ SESSION_SIGNING_KEY: signingKey }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { uid: string; login: string };
    expect(body.uid).toBe('user-123');
    expect(body.login).toBe('test-user');
  });

  it('GET /v1/auth/me without auth returns 401', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/auth/me'),
      new URL('https://freeagentstore.online/v1/auth/me'),
      mockEnv(),
    );
    expect(res.status).toBe(401);
  });

  // ── CORS ──
  it('OPTIONS returns 204 with CORS headers', async () => {
    const res = await handleApiRoute(
      makeRequest('OPTIONS', '/v1/keys/providers'),
      new URL('https://freeagentstore.online/v1/keys/providers'),
      mockEnv(),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('PUT');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('DELETE');
  });

  it('all JSON responses include CORS headers', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/keys/providers'),
      new URL('https://freeagentstore.online/v1/keys/providers'),
      mockEnv(),
    );
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  // ── Routing ──
  it('unknown /v1/ route returns 404', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/nonexistent'),
      new URL('https://freeagentstore.online/v1/nonexistent'),
      mockEnv(),
    );
    expect(res.status).toBe(404);
  });

  // ── OAuth ──
  it('GET /v1/auth/github redirects to GitHub OAuth', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/auth/github'),
      new URL('https://freeagentstore.online/v1/auth/github'),
      mockEnv({ GITHUB_CLIENT_ID: 'test-client-id' } as unknown as Env),
    );
    expect(res.status).toBe(302);
    const location = res.headers.get('Location') ?? '';
    expect(location).toContain('github.com/login/oauth/authorize');
    expect(location).toContain('client_id=test-client-id');
  });

  it('GET /v1/auth/github without client ID returns 503', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/auth/github'),
      new URL('https://freeagentstore.online/v1/auth/github'),
      mockEnv({ GITHUB_CLIENT_ID: undefined } as unknown as Env),
    );
    expect(res.status).toBe(503);
  });

  // ── Logout ──
  it('POST /v1/auth/logout clears session cookie', async () => {
    const res = await handleApiRoute(
      makeRequest('POST', '/v1/auth/logout'),
      new URL('https://freeagentstore.online/v1/auth/logout'),
      mockEnv(),
    );
    expect(res.status).toBe(200);
    const cookie = res.headers.get('Set-Cookie') ?? '';
    expect(cookie).toContain('fags_session=');
    expect(cookie).toContain('Max-Age=0');
  });

  // ── Usage ──
  it('GET /v1/usage without auth returns 401', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/usage'),
      new URL('https://freeagentstore.online/v1/usage'),
      mockEnv(),
    );
    expect(res.status).toBe(401);
  });

  // ── Key management page ──
  it('GET /v1/keys returns HTML page', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/keys'),
      new URL('https://freeagentstore.online/v1/keys'),
      mockEnv(),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/html');
  });
});
