import { describe, expect, it } from 'vitest';
import { classifyRequest } from './bot-detect';

function makeRequest(
  pathname: string,
  headers: Record<string, string> = {},
): Request {
  return new Request(`https://freeagentstore.online${pathname}`, {
    headers,
  });
}

// Default headers for a "normal" browser page view
const BROWSER_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

describe('classifyRequest', () => {
  // ── Human browser detection ──

  it('Chrome user agent -> isHuman: true, browser: Chrome', () => {
    const result = classifyRequest(
      makeRequest('/', {
        ...BROWSER_HEADERS,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      }),
      '/',
    );
    expect(result.isHuman).toBe(true);
    expect(result.browser).toBe('Chrome');
  });

  it('Safari user agent -> isHuman: true, browser: Safari', () => {
    const result = classifyRequest(
      makeRequest('/', {
        ...BROWSER_HEADERS,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
      }),
      '/',
    );
    expect(result.isHuman).toBe(true);
    expect(result.browser).toBe('Safari');
  });

  it('Firefox user agent -> isHuman: true, browser: Firefox', () => {
    const result = classifyRequest(
      makeRequest('/', {
        ...BROWSER_HEADERS,
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0',
      }),
      '/',
    );
    expect(result.isHuman).toBe(true);
    expect(result.browser).toBe('Firefox');
  });

  it('Edge user agent -> isHuman: true, browser: Edge', () => {
    const result = classifyRequest(
      makeRequest('/', {
        ...BROWSER_HEADERS,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
      }),
      '/',
    );
    expect(result.isHuman).toBe(true);
    expect(result.browser).toBe('Edge');
  });

  // ── Bot detection ──

  it('curl user agent -> isHuman: false, botReason contains ua:curl/', () => {
    const result = classifyRequest(
      makeRequest('/', {
        ...BROWSER_HEADERS,
        'User-Agent': 'curl/8.7.1',
      }),
      '/',
    );
    expect(result.isHuman).toBe(false);
    expect(result.botReason).toContain('ua:curl/');
  });

  it('empty user agent -> isHuman: false, botReason: no-user-agent', () => {
    const result = classifyRequest(
      makeRequest('/', { Accept: 'text/html' }),
      '/',
    );
    expect(result.isHuman).toBe(false);
    expect(result.botReason).toBe('no-user-agent');
  });

  it('Googlebot -> isHuman: false', () => {
    const result = classifyRequest(
      makeRequest('/', {
        ...BROWSER_HEADERS,
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      }),
      '/',
    );
    expect(result.isHuman).toBe(false);
    expect(result.botReason).toContain('ua:');
  });

  it('Bingbot -> isHuman: false', () => {
    const result = classifyRequest(
      makeRequest('/', {
        ...BROWSER_HEADERS,
        'User-Agent': 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
      }),
      '/',
    );
    expect(result.isHuman).toBe(false);
    expect(result.botReason).toContain('ua:');
  });

  it('TLM-Audit-Scanner -> isHuman: false', () => {
    const result = classifyRequest(
      makeRequest('/', {
        ...BROWSER_HEADERS,
        'User-Agent': 'TLM-Audit-Scanner/1.0',
      }),
      '/',
    );
    expect(result.isHuman).toBe(false);
    expect(result.botReason).toContain('ua:');
  });

  // ── Scanner paths ──

  it('/.git/config -> isHuman: false', () => {
    const result = classifyRequest(
      makeRequest('/.git/config', {
        ...BROWSER_HEADERS,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
      }),
      '/.git/config',
    );
    expect(result.isHuman).toBe(false);
    expect(result.botReason).toContain('path:');
  });

  it('/wp-admin -> isHuman: false', () => {
    const result = classifyRequest(
      makeRequest('/wp-admin', {
        ...BROWSER_HEADERS,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
      }),
      '/wp-admin',
    );
    expect(result.isHuman).toBe(false);
    expect(result.botReason).toContain('path:');
  });

  // ── Noise paths ──

  it('/robots.txt -> isHuman: false', () => {
    const result = classifyRequest(
      makeRequest('/robots.txt', {
        ...BROWSER_HEADERS,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
      }),
      '/robots.txt',
    );
    expect(result.isHuman).toBe(false);
    expect(result.botReason).toContain('noise:');
  });

  it('/favicon.ico -> isHuman: false', () => {
    const result = classifyRequest(
      makeRequest('/favicon.ico', {
        ...BROWSER_HEADERS,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
      }),
      '/favicon.ico',
    );
    expect(result.isHuman).toBe(false);
    expect(result.botReason).toContain('noise:');
  });

  // ── Missing Accept: text/html ──

  it('missing Accept: text/html -> isHuman: false, botReason: no-accept-html', () => {
    const result = classifyRequest(
      makeRequest('/', {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
        Accept: 'application/json',
      }),
      '/',
    );
    expect(result.isHuman).toBe(false);
    expect(result.botReason).toBe('no-accept-html');
  });

  // ── Device detection ──

  it('mobile user agent -> device: mobile', () => {
    const result = classifyRequest(
      makeRequest('/', {
        ...BROWSER_HEADERS,
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
      }),
      '/',
    );
    expect(result.isHuman).toBe(true);
    expect(result.device).toBe('mobile');
  });

  it('iPad user agent -> device: tablet', () => {
    const result = classifyRequest(
      makeRequest('/', {
        ...BROWSER_HEADERS,
        'User-Agent': 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
      }),
      '/',
    );
    expect(result.isHuman).toBe(true);
    expect(result.device).toBe('tablet');
  });

  it('desktop Chrome -> device: desktop', () => {
    const result = classifyRequest(
      makeRequest('/', {
        ...BROWSER_HEADERS,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      }),
      '/',
    );
    expect(result.isHuman).toBe(true);
    expect(result.device).toBe('desktop');
  });
});
