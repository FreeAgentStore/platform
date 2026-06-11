import { test, expect } from '@playwright/test';

const AGENTS = [
  'research-agent',
  'competitive-intel',
  'data-pipeline',
  'doc-writer',
  'code-refactor',
  'test-generator',
  'site-migrator',
  'email-processor',
];

test.describe('Autonomous agents — smoke tests', () => {
  for (const agent of AGENTS) {
    test(`${agent}: loads without errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });

      await page.goto(`/a/${agent}/`);

      // Should render the agent UI (not a 404 or blank page)
      await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });

      // Should have the Start button
      await expect(page.locator('button', { hasText: 'Start' })).toBeVisible();

      // Should show model selector
      await expect(page.locator('select').first()).toBeVisible();

      // Should show MCP button
      await expect(page.locator('button', { hasText: 'MCP' })).toBeVisible();

      // Should show goal input
      await expect(page.locator('textarea')).toBeVisible();

      // No JS errors
      const realErrors = errors.filter(
        (e) => !e.includes('favicon') && !e.includes('manifest') && !e.includes('Ollama')
          && !e.includes('ERR_CONNECTION_REFUSED') && !e.includes('localhost'),
      );
      expect(realErrors).toEqual([]);
    });
  }

  test('research-agent: model selector persists choice', async ({ page }) => {
    await page.goto('/a/research-agent/');
    await expect(page.locator('select').first()).toBeVisible({ timeout: 10_000 });

    // Change provider to Anthropic
    const providerSelect = page.locator('select').first();
    await providerSelect.selectOption('anthropic');

    // Verify model dropdown updated
    const modelSelect = page.locator('select').nth(1);
    const modelValue = await modelSelect.inputValue();
    expect(modelValue).toContain('claude');

    // Reload and verify it persisted
    await page.reload();
    await expect(page.locator('select').first()).toBeVisible({ timeout: 10_000 });
    const savedProvider = await page.locator('select').first().inputValue();
    expect(savedProvider).toBe('anthropic');
  });

  test('research-agent: MCP panel opens and closes', async ({ page }) => {
    await page.goto('/a/research-agent/');
    const mcpBtn = page.locator('button').filter({ hasText: 'MCP' });
    await expect(mcpBtn).toBeVisible({ timeout: 10_000 });

    await mcpBtn.click();
    await expect(page.getByText('MCP Servers', { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('Name')).toBeVisible();

    await mcpBtn.click();
    await expect(page.getByText('MCP Servers', { exact: true })).not.toBeVisible();
  });

  test('store page: loads and has agent cards', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 });
    // Page should have content (not empty)
    const body = await page.textContent('body');
    expect(body?.length).toBeGreaterThan(100);
  });
});

test.describe('Platform API — smoke tests', () => {
  test('/v1/search returns results', async ({ request }) => {
    const res = await request.get('/v1/search?q=javascript+frameworks');
    // May be rate limited from repeated test runs
    if (res.status() === 429) return;
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(data.count).toBeGreaterThan(0);
    expect(data.results).toBeInstanceOf(Array);
    expect(data.results[0]).toHaveProperty('title');
    expect(data.results[0]).toHaveProperty('url');
  });

  test('/v1/search returns 400 without query', async ({ request }) => {
    const res = await request.get('/v1/search');
    expect(res.status()).toBe(400);
  });

  test('/v1/fetch returns page content', async ({ request }) => {
    const res = await request.get('/v1/fetch?url=https://example.com');
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(data.title).toBeTruthy();
    expect(data.content).toBeTruthy();
    expect(data.url).toBe('https://example.com');
  });

  test('/v1/fetch blocks localhost (SSRF)', async ({ request }) => {
    const res = await request.get('/v1/fetch?url=https://127.0.0.1/secret');
    expect(res.status()).toBe(403);
  });

  test('/v1/fetch returns 400 without url', async ({ request }) => {
    const res = await request.get('/v1/fetch');
    expect(res.status()).toBe(400);
  });

  test('/v1/health returns healthy', async ({ request }) => {
    const res = await request.get('/v1/health');
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(data.status).toBe('healthy');
  });

  test('/v1/dashboard requires auth', async ({ request }) => {
    const res = await request.get('/v1/dashboard');
    // Should return 401 without auth
    expect(res.status()).toBe(401);
  });

  test('MCP server responds', async ({ request }) => {
    const res = await request.get('https://mcp.freeagentstore.online/');
    expect(res.ok()).toBe(true);
    const text = await res.text();
    expect(text).toContain('FreeAgentStore MCP Server');
    expect(text).toContain('create_agent');
  });

  test('/v1/mcp-proxy blocks non-https', async ({ request }) => {
    const res = await request.post('/v1/mcp-proxy?server=http://example.com', {
      data: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
    });
    // Server returns 400 (invalid) or 403 (blocked) for http URLs
    expect([400, 403]).toContain(res.status());
  });

  test('/v1/mcp-proxy blocks disallowed methods', async ({ request }) => {
    const res = await request.post('/v1/mcp-proxy?server=https://example.com', {
      data: { jsonrpc: '2.0', id: 1, method: 'dangerous/method', params: {} },
    });
    expect(res.status()).toBe(403);
  });
});
