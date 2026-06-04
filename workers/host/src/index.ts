/**
 * FreeAgentStore Host Worker
 * Serves agent apps from R2 via wildcard DNS.
 * Vendored from FAS host worker pattern.
 *
 * Flow: Host header → D1 lookup → R2 serve
 */

export interface Env {
  DB: D1Database;
  AGENTS: R2Bucket;
}

interface Route {
  slug: string;
  zone: string;
  r2_prefix: string;
  store: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const host = request.headers.get('Host')?.toLowerCase().replace(/:\d+$/, '') ?? '';

    // Only GET/HEAD
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Apex → store site (served separately)
    if (host === 'freeagentstore.online' || host === 'www.freeagentstore.online') {
      return new Response('Store site not yet deployed', { status: 503 });
    }

    // Reserved subdomains
    if (host.startsWith('api.') || host.startsWith('admin.') ||
        host.startsWith('publish.') || host.startsWith('agent.') ||
        host.startsWith('create.') || host.startsWith('console.')) {
      return new Response('Not Found', { status: 404 });
    }

    // Resolve route from D1
    const route = await resolveRoute(env.DB, host);
    if (!route) {
      return new Response('Agent not found', { status: 404 });
    }

    // Build R2 key
    const pathname = url.pathname;
    const r2Key = r2KeyFor(route, pathname);

    // Check ETag for 304
    const ifNoneMatch = request.headers.get('If-None-Match');

    // Fetch from R2
    const object = await env.AGENTS.get(r2Key);

    if (!object) {
      // SPA fallback: missing path with no extension → serve index.html
      const ext = pathname.split('/').pop()?.includes('.') ?? false;
      if (!ext && pathname !== '/') {
        const fallback = await env.AGENTS.get(`${route.r2_prefix}/index.html`);
        if (fallback) {
          return respond(fallback, 'text/html', true);
        }
      }
      return new Response('Not Found', { status: 404 });
    }

    // 304 Not Modified
    if (ifNoneMatch && object.httpEtag && etagsMatch(ifNoneMatch, object.httpEtag)) {
      return new Response(null, { status: 304, headers: securityHeaders(pathname) });
    }

    const mime = contentType(r2Key);
    return respond(object, mime, false);
  },
};

function respond(object: R2ObjectBody, mime: string, isFallback: boolean): Response {
  const pathname = isFallback ? '/index.html' : '';
  const headers = securityHeaders(pathname);
  headers.set('Content-Type', mime);
  headers.set('ETag', object.httpEtag);

  // Cache: 60s for HTML, 1yr immutable for hashed assets
  if (mime.startsWith('text/html')) {
    headers.set('Cache-Control', 'public, max-age=60, must-revalidate');
  } else {
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }

  return new Response(object.body, { headers });
}

async function resolveRoute(db: D1Database, host: string): Promise<Route | null> {
  const parts = host.split('.');
  if (parts.length < 3) return null;
  const slug = parts[0];
  const zone = parts.slice(1).join('.');

  const result = await db
    .prepare('SELECT slug, zone, r2_prefix, store FROM routes WHERE slug = ? AND zone = ?')
    .bind(slug, zone)
    .first<Route>();

  return result ?? null;
}

function r2KeyFor(route: Route, pathname: string): string {
  let key = route.r2_prefix + pathname;
  // Directory → index.html
  if (key.endsWith('/')) key += 'index.html';
  // No extension at end → try /index.html
  if (!key.split('/').pop()?.includes('.')) key += '/index.html';
  return key;
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

function securityHeaders(pathname?: string): Headers {
  const h = new Headers();
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
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
      "frame-ancestors 'self' https://freeagentstore.online https://*.freeagentstore.online",
      "base-uri 'self'",
      "object-src 'none'",
    ].join('; '),
  );
  return h;
}
