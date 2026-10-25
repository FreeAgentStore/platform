#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const storeDir = path.dirname(fileURLToPath(import.meta.url));
const origin = 'https://freeagentstore.online';

// Only public information pages. Never discover pages by walking console/app folders.
export const publicPaths = [
  '/', '/about/', '/get-started/', '/contribute/', '/docs/',
  '/docs/build-agent.html', '/docs/build-model.html',
  '/docs/build-heuristic.html', '/docs/frameworks.html',
];

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)]
    .map((match) => [match[1].toLowerCase(), match[2]]));
}

export function buildSitemap(directory, registry) {
  const routes = new Set(publicPaths);
  for (const agent of registry.agents) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(agent.id)) {
      throw new Error(`Unsafe public agent id: ${agent.id}`);
    }
    routes.add(`/agents/${agent.id}/`);
    const developer = (agent.developer ?? 'Unknown').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!developer) throw new Error(`Missing public developer slug for ${agent.id}`);
    routes.add(`/developers/${developer}/`);
  }

  const urls = [...routes].sort().map((route) => {
    const file = path.join(directory, route.endsWith('/') ? `${route}index.html` : route);
    const html = fs.readFileSync(file, 'utf8');
    const canonical = [...html.matchAll(/<link\b[^>]*>/gi)]
      .map((match) => attributes(match[0]))
      .filter((attrs) => attrs.rel?.toLowerCase() === 'canonical');
    const url = origin + route;
    if (canonical.length !== 1 || canonical[0].href !== url) {
      throw new Error(`Public sitemap page must declare exactly one self-canonical: ${route}`);
    }
    const excluded = [...html.matchAll(/<meta\b[^>]*>/gi)]
      .map((match) => attributes(match[0]))
      .some((attrs) => /^(robots|googlebot|bingbot)$/i.test(attrs.name ?? '') &&
        /\b(noindex|none)\b/i.test(attrs.content ?? ''));
    if (excluded) throw new Error(`Index-excluded page must not enter the public sitemap: ${route}`);
    return url;
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((url) => `  <url><loc>${url}</loc></url>`).join('\n') + '\n</urlset>\n';
  return { urls, xml };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const registry = JSON.parse(fs.readFileSync(path.join(storeDir, 'registry.json'), 'utf8'));
  const { urls, xml } = buildSitemap(storeDir, registry);
  fs.writeFileSync(path.join(storeDir, 'sitemap.xml'), xml);
  console.log(`Generated canonical public sitemap: ${urls.length} URLs`);
}
