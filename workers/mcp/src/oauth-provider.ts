/**
 * OAuth 2.1 provider for FAGS MCP servers — vendorable, self-contained.
 * Vendor this + session.ts into each MCP worker.
 * Needs: OAUTH_KV binding, SESSION_SIGNING_KEY, FAGS_AUTH_START var.
 *
 * Browser-bound flow (no session token ever rides in a URL):
 *   1. GET  /oauth/authorize — validate, store the auth request in KV under a
 *      single-use nonce, set a short-lived HttpOnly `__mcp_nonce` cookie, and
 *      redirect to the FAGS GitHub login.
 *   2. FAGS authenticates and redirects back to /oauth/callback with a one-time
 *      session code (`?session_code=`).
 *   3. GET  /oauth/callback — read the nonce from the cookie (never the URL),
 *      match it to the stored auth request, verify the session code, then
 *      exchange it for a single-use OAuth authorization code. Clears the cookie.
 *   4. POST /oauth/token — verify PKCE (S256) and mint an opaque access token.
 */

import { verifySession } from './session.js';

const NONCE_COOKIE = '__mcp_nonce';
/** Auth-request / nonce lifetime and cookie Max-Age (seconds). */
const NONCE_TTL = 600;

export interface OAuthConfig {
  /** Base URL of this MCP server (e.g. "https://mcp.freeagentstore.online") */
  issuer: string;
  /** FAGS auth start URL (e.g. "https://freeagentstore.online/v1/auth/github") */
  fagsAuthStart: string;
  /** Workers KV namespace for OAuth state */
  kv: KVNamespace;
  /** HMAC signing key (shared with FAGS backend) for session verification */
  sessionSigningKey: string;
}

const OAUTH_PATHS = new Set([
  '/oauth/register',
  '/oauth/authorize',
  '/oauth/callback',
  '/oauth/token',
]);

/** Try to handle an OAuth-related request. Returns null if not an OAuth path. */
export async function handleOAuthRoute(
  request: Request,
  config: OAuthConfig,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS preflight for OAuth endpoints
  if (request.method === 'OPTIONS') {
    if (path.startsWith('/.well-known/') || OAUTH_PATHS.has(path)) {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }
  }

  if (
    path === '/.well-known/oauth-protected-resource' ||
    path === '/.well-known/oauth-protected-resource/mcp'
  ) {
    return json({
      resource: `${config.issuer}/mcp`,
      authorization_servers: [config.issuer],
    });
  }
  if (path === '/.well-known/oauth-authorization-server') {
    return json({
      issuer: config.issuer,
      authorization_endpoint: `${config.issuer}/oauth/authorize`,
      token_endpoint: `${config.issuer}/oauth/token`,
      registration_endpoint: `${config.issuer}/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
    });
  }
  if (path === '/oauth/register' && request.method === 'POST') {
    return register(request, config);
  }
  if (path === '/oauth/authorize' && request.method === 'GET') {
    return authorize(request, config);
  }
  if (path === '/oauth/callback' && request.method === 'GET') {
    return oauthCallback(request, config);
  }
  if (path === '/oauth/token' && request.method === 'POST') {
    return tokenExchange(request, config);
  }
  return null;
}

/**
 * Resolve a Bearer token that might be an OAuth access token.
 * Returns the underlying FAGS session string, or null if not found in KV.
 */
export async function resolveOAuthToken(bearer: string, kv: KVNamespace): Promise<string | null> {
  return kv.get(`token:${bearer}`);
}

// ── Internals ──────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/** Build a 302 redirect that can also carry Set-Cookie (Response.redirect can't). */
function redirect(location: string, extraHeaders: Record<string, string> = {}): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: location, ...extraHeaders },
  });
}

/** Serialize the nonce cookie: HttpOnly + Secure + SameSite=Lax so it survives
 *  the top-level login redirect but is unreadable to scripts and other sites. */
function setNonceCookie(nonce: string): string {
  return `${NONCE_COOKIE}=${nonce}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${NONCE_TTL}`;
}

/** Expire the nonce cookie once the callback has consumed (or rejected) it. */
function clearNonceCookie(): string {
  return `${NONCE_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

/** Read a single cookie value from the request's Cookie header. */
function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

/** POST /oauth/register — dynamic client registration (required by mcp-remote) */
async function register(request: Request, config: OAuthConfig): Promise<Response> {
  // Rate limit: 20 registrations/hour/IP
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const hour = Math.floor(Date.now() / 3_600_000);
  const rlKey = `rl:reg:${ip}:${hour}`;
  const count = parseInt((await config.kv.get(rlKey)) ?? '0', 10);
  if (count >= 20) {
    return json({ error: 'rate_limit_exceeded' }, 429);
  }
  await config.kv.put(rlKey, String(count + 1), { expirationTtl: 3600 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'invalid_request' }, 400);
  }

  const redirectUris = body.redirect_uris;
  if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
    return json({ error: 'invalid_redirect_uri' }, 400);
  }

  const clientId = crypto.randomUUID();
  const client = {
    client_id: clientId,
    redirect_uris: redirectUris,
    client_name: body.client_name ?? null,
    grant_types: ['authorization_code'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  };
  await config.kv.put(`client:${clientId}`, JSON.stringify(client), {
    expirationTtl: 90 * 86_400, // 90 days
  });

  return json(client, 201);
}

/** GET /oauth/authorize — validate request, store auth state, set nonce cookie, redirect to FAGS login */
async function authorize(request: Request, config: OAuthConfig): Promise<Response> {
  const url = new URL(request.url);
  const responseType = url.searchParams.get('response_type');
  const clientId = url.searchParams.get('client_id');
  const redirectUri = url.searchParams.get('redirect_uri');
  const codeChallenge = url.searchParams.get('code_challenge');
  const codeChallengeMethod = url.searchParams.get('code_challenge_method');
  const state = url.searchParams.get('state');

  if (responseType !== 'code') {
    return new Response('unsupported_response_type', { status: 400 });
  }
  if (!clientId || !redirectUri || !codeChallenge) {
    return new Response('missing client_id, redirect_uri, or code_challenge', { status: 400 });
  }
  if (codeChallengeMethod && codeChallengeMethod !== 'S256') {
    return new Response('only S256 is supported', { status: 400 });
  }

  // Verify client registration
  const clientRaw = await config.kv.get(`client:${clientId}`);
  if (!clientRaw) {
    return new Response('invalid client_id', { status: 400 });
  }
  const client = JSON.parse(clientRaw) as { redirect_uris: string[] };
  if (!client.redirect_uris.includes(redirectUri)) {
    return new Response('redirect_uri not registered', { status: 400 });
  }

  // Store auth request (single-use nonce, short TTL). The nonce lives in a
  // browser-bound cookie — it is NOT placed in the callback URL.
  const nonce = crypto.randomUUID();
  await config.kv.put(
    `authreq:${nonce}`,
    JSON.stringify({ clientId, redirectUri, codeChallenge, state }),
    { expirationTtl: NONCE_TTL },
  );

  // Redirect to FAGS GitHub login. FAGS returns to /oauth/callback with a
  // one-time session code; the nonce comes back via the cookie, not the URL.
  const fagsUrl = new URL(config.fagsAuthStart);
  fagsUrl.searchParams.set('response_mode', 'query');
  fagsUrl.searchParams.set('app_id', 'mcp');
  fagsUrl.searchParams.set('return_to', new URL('/oauth/callback', config.issuer).toString());

  return redirect(fagsUrl.toString(), { 'Set-Cookie': setNonceCookie(nonce) });
}

/** GET /oauth/callback — nonce from cookie + one-time session code from FAGS, issues auth code */
async function oauthCallback(request: Request, config: OAuthConfig): Promise<Response> {
  const url = new URL(request.url);
  const nonce = readCookie(request, NONCE_COOKIE);
  const sessionCode = url.searchParams.get('session_code');

  if (!nonce || !sessionCode) {
    return new Response('missing nonce cookie or session code', { status: 400 });
  }

  // Retrieve and consume the auth request bound to this browser's nonce (single-use)
  const reqRaw = await config.kv.get(`authreq:${nonce}`);
  if (!reqRaw) {
    return new Response('invalid or expired nonce', {
      status: 400,
      headers: { 'Set-Cookie': clearNonceCookie() },
    });
  }
  await config.kv.delete(`authreq:${nonce}`);

  // Verify the FAGS session code is valid
  const payload = await verifySession(sessionCode, config.sessionSigningKey);
  if (!payload) {
    return new Response('invalid session', {
      status: 400,
      headers: { 'Set-Cookie': clearNonceCookie() },
    });
  }

  const authReq = JSON.parse(reqRaw) as {
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
    state: string | null;
  };

  // Generate single-use auth code (short TTL)
  const code = crypto.randomUUID();
  await config.kv.put(
    `code:${code}`,
    JSON.stringify({
      fagsSession: sessionCode,
      codeChallenge: authReq.codeChallenge,
      redirectUri: authReq.redirectUri,
      clientId: authReq.clientId,
    }),
    { expirationTtl: NONCE_TTL },
  );

  // Redirect to client's redirect_uri with auth code; clear the nonce cookie
  const redirectTo = new URL(authReq.redirectUri);
  redirectTo.searchParams.set('code', code);
  if (authReq.state) {
    redirectTo.searchParams.set('state', authReq.state);
  }
  return redirect(redirectTo.toString(), { 'Set-Cookie': clearNonceCookie() });
}

/** POST /oauth/token — exchange auth code for access token (PKCE S256 verified) */
async function tokenExchange(request: Request, config: OAuthConfig): Promise<Response> {
  let body: URLSearchParams;
  try {
    body = new URLSearchParams(await request.text());
  } catch {
    return json({ error: 'invalid_request' }, 400);
  }

  if (body.get('grant_type') !== 'authorization_code') {
    return json({ error: 'unsupported_grant_type' }, 400);
  }

  const code = body.get('code');
  const redirectUri = body.get('redirect_uri');
  const clientId = body.get('client_id');
  const codeVerifier = body.get('code_verifier');

  if (!code || !redirectUri || !clientId || !codeVerifier) {
    return json({ error: 'invalid_request' }, 400);
  }

  // Retrieve and consume auth code (single-use)
  const codeRaw = await config.kv.get(`code:${code}`);
  if (!codeRaw) {
    return json({ error: 'invalid_grant' }, 400);
  }
  await config.kv.delete(`code:${code}`);

  const codeData = JSON.parse(codeRaw) as {
    fagsSession: string;
    codeChallenge: string;
    redirectUri: string;
    clientId: string;
  };

  if (codeData.redirectUri !== redirectUri || codeData.clientId !== clientId) {
    return json({ error: 'invalid_grant' }, 400);
  }

  // Verify PKCE (S256): SHA-256(code_verifier) must equal code_challenge
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  const computed = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  if (computed !== codeData.codeChallenge) {
    return json({ error: 'invalid_grant', error_description: 'PKCE verification failed' }, 400);
  }

  // Issue opaque access token → maps to FAGS session in KV (24h TTL)
  const accessToken = crypto.randomUUID();
  await config.kv.put(`token:${accessToken}`, codeData.fagsSession, {
    expirationTtl: 86_400,
  });

  return json({
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 86_400,
  });
}
