/**
 * FreeAgentStore Host Worker
 *
 * Path-based hosting — all agents served from the apex domain:
 *   freeagentstore.online/a/{slug}/  → agent app
 *   freeagentstore.online/console/   → creator console
 *   freeagentstore.online/agents/{slug}/ → detail page
 *   freeagentstore.online/            → store site
 *
 * No third-level subdomains for apps. This avoids cookie/PWA/SW isolation
 * issues. MCP stays on mcp.freeagentstore.online (separate worker).
 *
 * R2 layout:
 *   agents/{slug}/*  — agent app files
 *   console/*        — console SPA
 *   store/*          — store site + detail pages
 */

import { handleApiRoute } from './api';
import { injectMirror } from './mirror-inject';
import { classifyRequest } from './bot-detect';
import { handleDashboard } from './dashboard';

export { MirrorRoom } from './mirror-do';

export interface Env {
  DB: D1Database;
  AGENTS: R2Bucket;
  MIRROR_ROOMS: DurableObjectNamespace;
  KEY_ENCRYPTION_KEY: string;
  SESSION_SIGNING_KEY: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
}

/** Fire-and-forget: log a page view to D1. Only logs humans; samples bots at 10%. */
function logPageView(request: Request, env: Env, pathname: string): void {
  if (request.method !== 'GET') return;

  const classification = classifyRequest(request, pathname);

  // Skip most bot traffic — sample 1 in 10 for dashboard stats
  if (!classification.isHuman && Math.random() > 0.1) return;

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const country = request.headers.get('CF-IPCountry') ?? null;
  const referer = request.headers.get('Referer') ?? null;

  crypto.subtle
    .digest('SHA-256', new TextEncoder().encode(ip + ':fags-salt'))
    .then((hash) => {
      const ipHash = Array.from(new Uint8Array(hash).slice(0, 8))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      return env.DB.prepare(
        `INSERT INTO page_views (path, is_human, country, browser, device, referer, ip_hash, bot_reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch())`,
      )
        .bind(
          pathname,
          classification.isHuman ? 1 : 0,
          country,
          classification.browser,
          classification.device,
          referer ? referer.slice(0, 500) : null,
          ipHash,
          classification.botReason,
        )
        .run();
    })
    .catch(() => {});
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const host = request.headers.get('Host')?.toLowerCase().replace(/:\d+$/, '') ?? '';

    // Dashboard — server-rendered analytics page
    if (url.pathname === '/v1/dashboard') {
      return handleDashboard(url, env);
    }

    // API routes (key vault + proxy) — handle before R2 serving
    if (url.pathname.startsWith('/v1/')) {
      return handleApiRoute(request, url, env);
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // MCP subdomain — handled by separate worker (wrangler route)
    // Reserved subdomains — 404
    if (
      host.startsWith('api.') ||
      host.startsWith('admin.') ||
      host.startsWith('publish.') ||
      host.startsWith('agent.') ||
      host.startsWith('create.')
    ) {
      return new Response('Not Found', { status: 404 });
    }

    // Redirect old subdomain URLs to path-based: tts.freeagentstore.online → /a/tts/
    if (
      host !== 'freeagentstore.online' &&
      host !== 'www.freeagentstore.online' &&
      !host.startsWith('mcp.') &&
      host.endsWith('.freeagentstore.online')
    ) {
      const slug = host.split('.')[0];
      return Response.redirect(`https://freeagentstore.online/a/${slug}${url.pathname}`, 301);
    }

    // Everything below is on the apex: freeagentstore.online
    const pathname = url.pathname;

    // ── Analytics: log page views (skip static assets) ───────
    const ext = pathname.split('.').pop()?.toLowerCase();
    const isAsset = ext && ['js','mjs','css','png','jpg','jpeg','webp','gif','svg','ico','woff','woff2','wasm','map','onnx'].includes(ext);
    if (!isAsset && !pathname.startsWith('/pkg/')) {
      logPageView(request, env, pathname);
    }

    // ── /pkg/{agent}/ → serve ESM packages with CORS ─────────
    if (pathname.startsWith('/pkg/')) {
      let pkgKey = pathname.slice(1); // remove leading /
      if (pkgKey.endsWith('/')) pkgKey += 'index.js';
      if (!pkgKey.split('/').pop()?.includes('.')) pkgKey += '/index.js';

      const object = await env.AGENTS.get(pkgKey);
      if (!object) return new Response('Package not found', { status: 404 });

      const headers = new Headers();
      headers.set('Content-Type', contentType(pkgKey));
      headers.set('ETag', object.httpEtag);
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, HEAD');
      headers.set('X-Content-Type-Options', 'nosniff');
      return new Response(object.body, { headers });
    }

    // ── /a/{slug}/ → serve agent from R2 ──────────────────────
    const agentMatch = pathname.match(/^\/a\/([a-z0-9-]+)(\/.*)?$/);
    if (agentMatch) {
      const slug = agentMatch[1];
      const subpath = agentMatch[2] || '/';

      // Verify route exists in D1
      const route = await env.DB.prepare('SELECT r2_prefix FROM routes WHERE slug = ? AND zone = ?')
        .bind(slug, 'freeagentstore.online')
        .first<{ r2_prefix: string }>();

      if (!route) return new Response('Agent not found', { status: 404 });

      let r2Key = route.r2_prefix + subpath;
      if (r2Key.endsWith('/')) r2Key += 'index.html';
      if (!r2Key.split('/').pop()?.includes('.')) r2Key += '/index.html';

      const object = await env.AGENTS.get(r2Key);
      if (object) {
        const mime = contentType(r2Key);
        if (mime === 'text/html; charset=utf-8') {
          return respondWithMirror(request, object, slug);
        }
        return respond(request, object, mime);
      }

      // SPA fallback
      const hasExt = subpath.split('/').pop()?.includes('.') ?? false;
      if (!hasExt) {
        const fallback = await env.AGENTS.get(`${route.r2_prefix}/index.html`);
        if (fallback) return respondWithMirror(request, fallback, slug);
      }
      return new Response('Not Found', { status: 404 });
    }

    // ── /console/ → serve console SPA from R2 ─────────────────
    if (pathname.startsWith('/console')) {
      const subpath = pathname.replace(/^\/console/, '') || '/';
      let consoleKey = `console${subpath}`;
      if (consoleKey.endsWith('/')) consoleKey += 'index.html';
      if (!consoleKey.split('/').pop()?.includes('.')) consoleKey += '/index.html';

      const object = await env.AGENTS.get(consoleKey);
      if (object) return respond(request, object, contentType(consoleKey));
      // SPA fallback
      const fallback = await env.AGENTS.get('console/index.html');
      if (fallback) return respond(request, fallback, 'text/html; charset=utf-8');
      return new Response('Console not deployed', { status: 503 });
    }

    // ── Everything else → store site from R2 ──────────────────
    let storeKey = `store${pathname}`;
    if (storeKey.endsWith('/')) storeKey += 'index.html';
    if (!storeKey.split('/').pop()?.includes('.')) storeKey += '/index.html';

    const object = await env.AGENTS.get(storeKey);
    if (object) return respond(request, object, contentType(storeKey));

    // 404 page — serve custom 404.html with 404 status
    const notFound = await env.AGENTS.get('store/404.html');
    if (notFound) {
      const headers = securityHeaders();
      headers.set('Content-Type', 'text/html; charset=utf-8');
      headers.set('Cache-Control', 'no-cache');
      return new Response(notFound.body, { status: 404, headers });
    }
    return new Response('Not Found', { status: 404 });
  },
};

async function respondWithMirror(
  request: Request,
  object: R2ObjectBody,
  slug: string,
): Promise<Response> {
  // 304 Not Modified — no body to inject into
  const ifNoneMatch = request.headers.get('If-None-Match');
  if (ifNoneMatch && object.httpEtag && etagsMatch(ifNoneMatch, object.httpEtag)) {
    return new Response(null, { status: 304, headers: agentSecurityHeaders() });
  }

  const html = await object.text();
  const injected = injectMirror(html, slug);

  const headers = agentSecurityHeaders();
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=60, must-revalidate');

  return new Response(injected, { headers });
}

function respond(request: Request, object: R2ObjectBody, mime: string): Response {
  // 304 Not Modified
  const ifNoneMatch = request.headers.get('If-None-Match');
  if (ifNoneMatch && object.httpEtag && etagsMatch(ifNoneMatch, object.httpEtag)) {
    return new Response(null, { status: 304, headers: securityHeaders() });
  }

  const headers = securityHeaders();
  headers.set('Content-Type', mime);
  headers.set('ETag', object.httpEtag);
  headers.set(
    'Cache-Control',
    mime.startsWith('text/html')
      ? 'public, max-age=60, must-revalidate'
      : 'public, max-age=31536000, immutable',
  );

  return new Response(object.body, { headers });
}

function etagsMatch(header: string, etag: string): boolean {
  if (header === '*') return true;
  return header.split(',').some((t) => t.trim() === etag);
}

function contentType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const types: Record<string, string> = {
    html: 'text/html; charset=utf-8',
    js: 'application/javascript; charset=utf-8',
    mjs: 'application/javascript; charset=utf-8',
    css: 'text/css; charset=utf-8',
    json: 'application/json; charset=utf-8',
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    ico: 'image/x-icon',
    woff: 'font/woff',
    woff2: 'font/woff2',
    wasm: 'application/wasm',
    txt: 'text/plain; charset=utf-8',
    xml: 'application/xml',
    webmanifest: 'application/manifest+json',
    map: 'application/json',
    onnx: 'application/octet-stream',
  };
  return types[ext ?? ''] ?? 'application/octet-stream';
}

/** Tight CSP for platform pages (store, console, mirror, detail pages). */
function securityHeaders(): Headers {
  return buildSecurityHeaders(false);
}

/** Relaxed CSP for agent apps (they need unsafe-eval for dynamic code). */
function agentSecurityHeaders(): Headers {
  return buildSecurityHeaders(true);
}

function buildSecurityHeaders(isAgent: boolean): Headers {
  const h = new Headers();
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  h.set('X-Frame-Options', 'SAMEORIGIN');
  h.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');

  if (isAgent) {
    // Agents may use eval (heuristic code), inline scripts, and Ollama
    h.set(
      'Content-Security-Policy',
      [
        "default-src 'self' https: data: blob:",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
        "style-src 'self' 'unsafe-inline' https:",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data: https:",
        "connect-src 'self' https: wss: http://localhost:11434",
        "frame-src 'self' https:",
        "base-uri 'self'",
        "object-src 'none'",
      ].join('; '),
    );
  } else {
    // Platform pages — no eval, no localhost
    h.set(
      'Content-Security-Policy',
      [
        "default-src 'self' https: data: blob:",
        "script-src 'self' 'unsafe-inline' https:",
        "style-src 'self' 'unsafe-inline' https:",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data: https:",
        "connect-src 'self' https: wss:",
        "frame-src 'self' https:",
        "base-uri 'self'",
        "object-src 'none'",
      ].join('; '),
    );
  }
  return h;
}
