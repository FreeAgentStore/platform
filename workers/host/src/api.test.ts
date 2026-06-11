import { describe, expect, it, vi } from 'vitest';
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
    MIRROR_ROOMS: {} as unknown as DurableObjectNamespace,
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
  it('GET /v1/keys redirects to console', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/keys'),
      new URL('https://freeagentstore.online/v1/keys'),
      mockEnv(),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/console/#keys');
  });

  // ── Expired token ──
  it('expired token returns 401', async () => {
    const signingKey = 'test-signing-key-for-hmac';
    const payload = {
      uid: 'user-123',
      login: 'test-user',
      avatar: '',
      exp: Math.floor(Date.now() / 1000) - 3600, // expired 1 hour ago
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
    const token = `${payloadB64}.${sigHex}`;

    const res = await handleApiRoute(
      makeRequest('GET', '/v1/auth/me', { headers: { Authorization: `Bearer ${token}` } }),
      new URL('https://freeagentstore.online/v1/auth/me'),
      mockEnv({ SESSION_SIGNING_KEY: signingKey }),
    );
    expect(res.status).toBe(401);
  });

  // ── Invalid token ──
  it('tampered token returns 401', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/auth/me', {
        headers: { Authorization: 'Bearer dGVzdA==.0000000000' },
      }),
      new URL('https://freeagentstore.online/v1/auth/me'),
      mockEnv(),
    );
    expect(res.status).toBe(401);
  });

  it('malformed token (no dot) returns 401', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/auth/me', {
        headers: { Authorization: 'Bearer nodottoken' },
      }),
      new URL('https://freeagentstore.online/v1/auth/me'),
      mockEnv(),
    );
    expect(res.status).toBe(401);
  });

  // ── Cookie auth ──
  it('auth via cookie works', async () => {
    const signingKey = 'test-signing-key-for-hmac';
    const token = await createTestToken('user-456', signingKey);
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/auth/me', { headers: { Cookie: `fags_session=${token}` } }),
      new URL('https://freeagentstore.online/v1/auth/me'),
      mockEnv({ SESSION_SIGNING_KEY: signingKey }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { uid: string };
    expect(body.uid).toBe('user-456');
  });

  // ── PUT /v1/keys/:provider validation ──
  it('PUT /v1/keys/unknown-provider returns 400', async () => {
    const signingKey = 'test-signing-key-for-hmac';
    const token = await createTestToken('user-123', signingKey);
    const res = await handleApiRoute(
      makeRequest('PUT', '/v1/keys/nonexistent', {
        body: JSON.stringify({ key: 'test-key' }),
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      }),
      new URL('https://freeagentstore.online/v1/keys/nonexistent'),
      mockEnv({ SESSION_SIGNING_KEY: signingKey }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Unknown provider');
  });

  it('PUT /v1/keys/openai with wrong prefix returns 400', async () => {
    const signingKey = 'test-signing-key-for-hmac';
    const token = await createTestToken('user-123', signingKey);
    const res = await handleApiRoute(
      makeRequest('PUT', '/v1/keys/openai', {
        body: JSON.stringify({ key: 'wrong-prefix-key' }),
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      }),
      new URL('https://freeagentstore.online/v1/keys/openai'),
      mockEnv({ SESSION_SIGNING_KEY: signingKey }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('sk-');
  });

  it('PUT /v1/keys/openai with empty key returns 400', async () => {
    const signingKey = 'test-signing-key-for-hmac';
    const token = await createTestToken('user-123', signingKey);
    const res = await handleApiRoute(
      makeRequest('PUT', '/v1/keys/openai', {
        body: JSON.stringify({ key: '' }),
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      }),
      new URL('https://freeagentstore.online/v1/keys/openai'),
      mockEnv({ SESSION_SIGNING_KEY: signingKey }),
    );
    expect(res.status).toBe(400);
  });

  it('PUT /v1/keys/openai with no body returns 400', async () => {
    const signingKey = 'test-signing-key-for-hmac';
    const token = await createTestToken('user-123', signingKey);
    const res = await handleApiRoute(
      makeRequest('PUT', '/v1/keys/openai', {
        body: 'not json',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      }),
      new URL('https://freeagentstore.online/v1/keys/openai'),
      mockEnv({ SESSION_SIGNING_KEY: signingKey }),
    );
    expect(res.status).toBe(400);
  });

  // ── QR endpoint ──
  it('GET /v1/qr without data param returns 400', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/qr'),
      new URL('https://freeagentstore.online/v1/qr'),
      mockEnv(),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('data');
  });

  it('GET /v1/qr with data returns SVG', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/qr'),
      new URL('https://freeagentstore.online/v1/qr?data=https://example.com'),
      mockEnv(),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/svg+xml');
    const svg = await res.text();
    expect(svg).toContain('<svg');
  });

  // ── Mirror.js ──
  it('GET /v1/mirror.js returns JavaScript', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/mirror.js'),
      new URL('https://freeagentstore.online/v1/mirror.js'),
      mockEnv(),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/javascript');
    const js = await res.text();
    expect(js).toContain('FagsMirrorElement');
  });

  // ── Mirror room info ──
  it('GET /v1/mirror/:roomId returns room info', async () => {
    const mockRoomFetch = async () =>
      new Response(JSON.stringify({ peers: 0, devices: [] }), {
        headers: { 'Content-Type': 'application/json' },
      });
    const mirrorRooms = {
      idFromName: () => ({ toString: () => 'test-id' }),
      get: () => ({ fetch: mockRoomFetch }),
    } as unknown as DurableObjectNamespace;

    const res = await handleApiRoute(
      makeRequest('GET', '/v1/mirror/abcdef12'),
      new URL('https://freeagentstore.online/v1/mirror/abcdef12'),
      mockEnv({ MIRROR_ROOMS: mirrorRooms }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { peers: number };
    expect(body.peers).toBe(0);
  });

  // ── OAuth state cookie ──
  it('GET /v1/auth/github sets state cookie', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/auth/github'),
      new URL('https://freeagentstore.online/v1/auth/github'),
      mockEnv({ GITHUB_CLIENT_ID: 'test-id' } as unknown as Env),
    );
    expect(res.status).toBe(302);
    // Set-Cookie contains the state cookie — verify via raw header
    const setCookie = res.headers.get('Set-Cookie') ?? '';
    expect(setCookie).toContain('fags_oauth_state=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
  });

  // ── OAuth return_to param ──
  it('GET /v1/auth/github with return_to sets cookie', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/auth/github'),
      new URL('https://freeagentstore.online/v1/auth/github?return_to=/console/'),
      mockEnv({ GITHUB_CLIENT_ID: 'test-id' } as unknown as Env),
    );
    const setCookie = res.headers.get('Set-Cookie') ?? '';
    expect(setCookie).toContain('fags_return_to=');
    expect(setCookie).toContain('%2Fconsole%2F');
  });

  // ── Providers list content ──
  it('providers include all 6 with required fields', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/keys/providers'),
      new URL('https://freeagentstore.online/v1/keys/providers'),
      mockEnv(),
    );
    const body = (await res.json()) as {
      providers: { id: string; name: string; host: string; docsUrl: string }[];
    };
    expect(body.providers).toHaveLength(6);
    for (const p of body.providers) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.host).toBeTruthy();
      expect(p.docsUrl).toMatch(/^https:\/\//);
    }
    const ids = body.providers.map((p) => p.id);
    expect(ids).toContain('openrouter');
    expect(ids).toContain('together');
  });

  // ── Health check ──
  it('GET /v1/health returns healthy status', async () => {
    const env = mockEnv({
      DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => ({ '1': 1 }),
            all: async () => ({ results: [] }),
            run: async () => ({ meta: { changes: 0 } }),
          }),
          first: async () => ({ '1': 1 }),
        }),
      } as unknown as D1Database,
    });
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/health'),
      new URL('https://freeagentstore.online/v1/health'),
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; db: string; timestamp: string };
    expect(body.status).toBe('healthy');
    expect(body.db).toBe('ok');
    expect(body.timestamp).toBeTruthy();
  });

  it('GET /v1/health returns degraded when DB fails', async () => {
    const env = mockEnv({
      DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => {
              throw new Error('DB down');
            },
            all: async () => ({ results: [] }),
            run: async () => ({ meta: { changes: 0 } }),
          }),
          first: async () => {
            throw new Error('DB down');
          },
        }),
      } as unknown as D1Database,
    });
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/health'),
      new URL('https://freeagentstore.online/v1/health'),
      env,
    );
    expect(res.status).toBe(503);
    const body = (await res.json()) as { status: string; db: string };
    expect(body.status).toBe('degraded');
    expect(body.db).toBe('error');
  });

  // ── Error response includes requestId ──
  it('500 errors include requestId', async () => {
    const env = mockEnv({
      DB: {
        prepare: () => {
          throw new Error('Simulated DB crash');
        },
      } as unknown as D1Database,
    });
    const signingKey = 'test-signing-key-for-hmac';
    const token = await createTestToken('user-123', signingKey);
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/keys/status', { headers: { Authorization: `Bearer ${token}` } }),
      new URL('https://freeagentstore.online/v1/keys/status'),
      env,
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string; requestId: string };
    expect(body.requestId).toBeTruthy();
    expect(body.requestId).toHaveLength(8);
    // Should NOT leak internal error details
    expect(body.error).toBe('Internal error');
  });

  // ── Proxy auth ──
  it('proxy without auth returns 401 (not 500)', async () => {
    const res = await handleApiRoute(
      makeRequest('POST', '/v1/proxy/api.openai.com/v1/chat/completions', {
        body: JSON.stringify({ model: 'gpt-4o-mini', messages: [] }),
        headers: { 'Content-Type': 'application/json' },
      }),
      new URL('https://freeagentstore.online/v1/proxy/api.openai.com/v1/chat/completions'),
      mockEnv(),
    );
    expect(res.status).toBe(401);
  });

  it('proxy with unknown host returns 400', async () => {
    const signingKey = 'test-signing-key-for-hmac';
    const token = await createTestToken('user-123', signingKey);
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/proxy/unknown.api.com/v1/test', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      new URL('https://freeagentstore.online/v1/proxy/unknown.api.com/v1/test'),
      mockEnv({ SESSION_SIGNING_KEY: signingKey }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Unknown proxy host');
  });

  // ── Stats endpoint ──
  it('GET /v1/stats/:agentId returns usage counts', async () => {
    const env = mockEnv({
      DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => ({ calls: 42, last_used: 1700000000 }),
            all: async () => ({ results: [] }),
            run: async () => ({ meta: { changes: 0 } }),
          }),
        }),
      } as unknown as D1Database,
    });
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/stats/sentiment'),
      new URL('https://freeagentstore.online/v1/stats/sentiment'),
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { calls: number; lastUsed: string | null };
    expect(body.calls).toBe(42);
    expect(body.lastUsed).toBeTruthy();
    expect(res.headers.get('Cache-Control')).toContain('max-age=300');
  });

  it('GET /v1/stats/:agentId returns zero for unused agent', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/stats/nonexistent'),
      new URL('https://freeagentstore.online/v1/stats/nonexistent'),
      mockEnv(),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { calls: number; lastUsed: string | null };
    expect(body.calls).toBe(0);
    expect(body.lastUsed).toBeNull();
  });
});

// ── /v1/search ────────────────────────────────────────────────────────────────

describe('/v1/search', () => {
  it('returns 400 if no ?q= parameter', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/search'),
      new URL('https://freeagentstore.online/v1/search'),
      mockEnv(),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('?q=');
  });

  it('returns results array on success', async () => {
    const fakeDdgHtml = `
      <div class="result">
        <a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage">Example Page</a>
        <a class="result__snippet">This is a snippet about the example page.</a>
      </div>
      <div class="result">
        <a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fother.com">Other Site</a>
        <a class="result__snippet">Another snippet here.</a>
      </div>
    `;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(fakeDdgHtml, { status: 200, headers: { 'Content-Type': 'text/html' } }),
    );

    const res = await handleApiRoute(
      makeRequest('GET', '/v1/search'),
      new URL('https://freeagentstore.online/v1/search?q=example'),
      mockEnv(),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { query: string; results: { title: string; url: string; snippet: string }[]; count: number };
    expect(body.query).toBe('example');
    expect(body.results).toBeInstanceOf(Array);
    expect(body.results.length).toBe(2);
    expect(body.results[0].title).toBe('Example Page');
    expect(body.results[0].url).toBe('https://example.com/page');
    expect(body.results[0].snippet).toContain('snippet about the example');
    expect(body.results[1].url).toBe('https://other.com');

    fetchSpy.mockRestore();
  });

  it('returns CORS headers', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('<html></html>', { status: 200, headers: { 'Content-Type': 'text/html' } }),
    );

    const res = await handleApiRoute(
      makeRequest('GET', '/v1/search'),
      new URL('https://freeagentstore.online/v1/search?q=test'),
      mockEnv(),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');

    vi.restoreAllMocks();
  });
});

// ── /v1/fetch ─────────────────────────────────────────────────────────────────

describe('/v1/fetch', () => {
  it('returns 400 if no ?url= parameter', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/fetch'),
      new URL('https://freeagentstore.online/v1/fetch'),
      mockEnv(),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('?url=');
  });

  it('returns 400 for invalid URL', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/fetch'),
      new URL('https://freeagentstore.online/v1/fetch?url=not-a-url'),
      mockEnv(),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Invalid URL');
  });

  it('returns 403 for blocked host localhost', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/fetch'),
      new URL('https://freeagentstore.online/v1/fetch?url=https%3A%2F%2Flocalhost%2Fsecret'),
      mockEnv(),
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Blocked');
  });

  it('returns 403 for blocked host 127.0.0.1', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/fetch'),
      new URL('https://freeagentstore.online/v1/fetch?url=https%3A%2F%2F127.0.0.1%2Fpath'),
      mockEnv(),
    );
    expect(res.status).toBe(403);
  });

  it('returns 403 for blocked host 10.x.x.x', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/fetch'),
      new URL('https://freeagentstore.online/v1/fetch?url=https%3A%2F%2F10.0.0.1%2Fpath'),
      mockEnv(),
    );
    expect(res.status).toBe(403);
  });

  it('returns 403 for blocked host 169.254.169.254', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/fetch'),
      new URL('https://freeagentstore.online/v1/fetch?url=https%3A%2F%2F169.254.169.254%2Flatest%2Fmeta-data'),
      mockEnv(),
    );
    expect(res.status).toBe(403);
  });

  it('returns clean text content with title extracted', async () => {
    const fakeHtml = `
      <html>
        <head><title>Test Page Title</title></head>
        <body>
          <script>console.log("removed")</script>
          <style>.removed{}</style>
          <h1>Hello World</h1>
          <p>Some <b>important</b> content here.</p>
        </body>
      </html>
    `;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(fakeHtml, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
    );

    const res = await handleApiRoute(
      makeRequest('GET', '/v1/fetch'),
      new URL('https://freeagentstore.online/v1/fetch?url=https%3A%2F%2Fexample.com'),
      mockEnv(),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { url: string; title: string; content: string; length: number; truncated: boolean };
    expect(body.url).toBe('https://example.com');
    expect(body.title).toBe('Test Page Title');
    expect(body.content).toContain('Hello World');
    expect(body.content).toContain('important');
    expect(body.content).toContain('content here');

    fetchSpy.mockRestore();
  });

  it('strips HTML tags from response', async () => {
    const fakeHtml = '<html><head><title>T</title></head><body><p>Clean <b>text</b></p></body></html>';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(fakeHtml, { status: 200, headers: { 'Content-Type': 'text/html' } }),
    );

    const res = await handleApiRoute(
      makeRequest('GET', '/v1/fetch'),
      new URL('https://freeagentstore.online/v1/fetch?url=https%3A%2F%2Fexample.com'),
      mockEnv(),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { content: string };
    expect(body.content).not.toContain('<b>');
    expect(body.content).not.toContain('<p>');
    expect(body.content).not.toContain('</html>');
    expect(body.content).toContain('Clean');
    expect(body.content).toContain('text');

    fetchSpy.mockRestore();
  });

  it('returns CORS headers', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('<html><body>ok</body></html>', { status: 200, headers: { 'Content-Type': 'text/html' } }),
    );

    const res = await handleApiRoute(
      makeRequest('GET', '/v1/fetch'),
      new URL('https://freeagentstore.online/v1/fetch?url=https%3A%2F%2Fexample.com'),
      mockEnv(),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');

    fetchSpy.mockRestore();
  });
});

// ── /v1/mcp-proxy ─────────────────────────────────────────────────────────────

describe('/v1/mcp-proxy', () => {
  it('returns 400 if no ?server= parameter', async () => {
    const res = await handleApiRoute(
      makeRequest('POST', '/v1/mcp-proxy', {
        body: JSON.stringify({ jsonrpc: '2.0', method: 'initialize', id: 1 }),
        headers: { 'Content-Type': 'application/json' },
      }),
      new URL('https://freeagentstore.online/v1/mcp-proxy'),
      mockEnv(),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('?server=');
  });

  it('returns 403 for blocked methods (not in allowlist)', async () => {
    const res = await handleApiRoute(
      makeRequest('POST', '/v1/mcp-proxy', {
        body: JSON.stringify({ jsonrpc: '2.0', method: 'resources/list', id: 1 }),
        headers: { 'Content-Type': 'application/json' },
      }),
      new URL('https://freeagentstore.online/v1/mcp-proxy?server=https%3A%2F%2Fmcp.example.com%2Fmcp'),
      mockEnv(),
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Method not allowed');
  });

  it('returns 403 for blocked hosts (SSRF protection)', async () => {
    const res = await handleApiRoute(
      makeRequest('POST', '/v1/mcp-proxy', {
        body: JSON.stringify({ jsonrpc: '2.0', method: 'initialize', id: 1 }),
        headers: { 'Content-Type': 'application/json' },
      }),
      new URL('https://freeagentstore.online/v1/mcp-proxy?server=https%3A%2F%2Flocalhost%2Fmcp'),
      mockEnv(),
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Blocked');
  });

  it('returns 400 for non-https URLs', async () => {
    const res = await handleApiRoute(
      makeRequest('POST', '/v1/mcp-proxy', {
        body: JSON.stringify({ jsonrpc: '2.0', method: 'initialize', id: 1 }),
        headers: { 'Content-Type': 'application/json' },
      }),
      new URL('https://freeagentstore.online/v1/mcp-proxy?server=http%3A%2F%2Fmcp.example.com%2Fmcp'),
      mockEnv(),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('https');
  });

  it('forwards allowed methods (initialize, tools/list, tools/call)', async () => {
    const methods = ['initialize', 'tools/list', 'tools/call'];
    for (const method of methods) {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ jsonrpc: '2.0', result: {}, id: 1 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const res = await handleApiRoute(
        makeRequest('POST', '/v1/mcp-proxy', {
          body: JSON.stringify({ jsonrpc: '2.0', method, id: 1 }),
          headers: { 'Content-Type': 'application/json' },
        }),
        new URL('https://freeagentstore.online/v1/mcp-proxy?server=https%3A%2F%2Fmcp.example.com%2Fmcp'),
        mockEnv(),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { jsonrpc: string; result: unknown };
      expect(body.jsonrpc).toBe('2.0');

      fetchSpy.mockRestore();
    }
  });

  it('returns 429 when rate limited', async () => {
    // Exhaust the rate limit (60 requests/minute/IP)
    // We mock the rate counter by sending many requests from the same IP
    // Since the MCP rate limiter is in-memory, we need to hit the endpoint many times.
    // Instead, we'll directly test by making 61 rapid requests.
    // But that's slow, so we'll use a trick: mock CF-Connecting-IP to a unique IP
    // and send enough requests to exceed the limit.
    const uniqueIp = `rate-test-${Date.now()}`;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ jsonrpc: '2.0', result: {}, id: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    let lastStatus = 200;
    for (let i = 0; i < 62; i++) {
      const res = await handleApiRoute(
        makeRequest('POST', '/v1/mcp-proxy', {
          body: JSON.stringify({ jsonrpc: '2.0', method: 'initialize', id: 1 }),
          headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': uniqueIp },
        }),
        new URL('https://freeagentstore.online/v1/mcp-proxy?server=https%3A%2F%2Fmcp.example.com%2Fmcp'),
        mockEnv(),
      );
      lastStatus = res.status;
      if (lastStatus === 429) break;
    }
    expect(lastStatus).toBe(429);

    fetchSpy.mockRestore();
  });
});
