import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { buildSitemap, publicPaths } from './build-sitemap.js';

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fags-sitemap-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const put = (route, extra = '') => {
    const file = path.join(directory, route.endsWith('/') ? `${route}index.html` : route);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `<link rel="canonical" href="https://freeagentstore.online${route}">${extra}`);
  };
  for (const route of [...publicPaths, '/agents/sample/', '/developers/creator/']) put(route);
  return { directory, put, registry: { agents: [{ id: 'sample', developer: 'Creator' }] } };
}

test('only approved canonical information/catalogue pages enter discovery', (t) => {
  const { directory, put, registry } = fixture(t);
  for (const route of ['/console/', '/console/settings/', '/create/', '/mirror/', '/a/sample/', '/preview/']) put(route);
  registry.agents.push({ id: 'sample', developer: 'Creator' });
  const { urls, xml } = buildSitemap(directory, registry);
  assert.equal(urls.length, new Set(urls).size);
  assert.ok(urls.includes('https://freeagentstore.online/'));
  assert.ok(urls.includes('https://freeagentstore.online/agents/sample/'));
  assert.ok(urls.includes('https://freeagentstore.online/docs/build-agent.html'));
  assert.ok(!/\/(console|create|mirror|a|preview)\//.test(xml));
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset xmlns=/);
});

test('stops a missing or incorrect canonical from reaching upload', (t) => {
  const { directory, put, registry } = fixture(t);
  put('/about/', '<link rel="canonical" href="https://freeagentstore.online/">');
  assert.throws(() => buildSitemap(directory, registry), /exactly one self-canonical: \/about\//);
});

test('stops a crawler-specific noindex page from entering discovery', (t) => {
  const { directory, put, registry } = fixture(t);
  put('/agents/sample/', '<meta name="Googlebot" content="NONE">');
  assert.throws(() => buildSitemap(directory, registry), /Index-excluded page/);
});

test('rejects route traversal in catalogue input', (t) => {
  const { directory, registry } = fixture(t);
  registry.agents[0].id = '../console';
  assert.throws(() => buildSitemap(directory, registry), /Unsafe public agent id/);
});
