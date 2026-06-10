/**
 * Bot detection — classifies requests as human or bot.
 *
 * Returns null if human, or a reason string if bot.
 */

// User-Agent substrings that are definitely bots
const BOT_UA_PATTERNS = [
  'bot', 'crawl', 'spider', 'slurp', 'scraper', 'fetch', 'curl/',
  'wget/', 'python-', 'httpx/', 'axios/', 'node-fetch', 'go-http',
  'java/', 'ruby/', 'perl/', 'php/', 'libwww', 'lwp-',
  'headlesschrome', 'phantomjs', 'selenium', 'puppeteer', 'playwright',
  'chrome-lighthouse', 'pagespeed', 'gtmetrix',
  'tlm-audit', 'scanner', 'probe', 'monitor', 'uptime',
  'ahrefsbot', 'semrushbot', 'mj12bot', 'dotbot', 'rogerbot',
  'baiduspider', 'yandexbot', 'duckduckbot', 'ia_archiver',
  'facebookexternalhit', 'twitterbot', 'linkedinbot', 'whatsapp',
  'discordbot', 'telegrambot', 'slackbot',
  'gptbot', 'chatgpt', 'claudebot', 'anthropic-ai', 'cohere-ai',
  'bytespider', 'applebot', 'amazonbot', 'ccbot',
  'dataforseo', 'zoominfobot', 'petalbot',
  'mediapartners', 'adsbot', 'feedfetcher',
  'nmap', 'masscan', 'zgrab', 'nuclei',
];

// Paths that are only hit by bots/scanners
const BOT_PATHS = [
  '/.git/', '/.env', '/.git/config', '/.git/HEAD',
  '/wp-admin', '/wp-login', '/wp-content', '/wp-includes', '/wordpress',
  '/phpmyadmin', '/admin.php', '/xmlrpc.php', '/wp-json',
  '/.well-known/security.txt',
  '/config.json', '/package.json', '/composer.json',
  '/server-status', '/server-info',
  '/.aws/', '/.docker/', '/docker-compose',
  '/actuator', '/api/v1/pods',
  '/cgi-bin/', '/shell', '/cmd',
  '/backup', '/.bak', '/.old', '/.zip',
  '/debug/', '/.debug',
];

// File extensions that are never real page views
const NOISE_EXTENSIONS = [
  '.php', '.asp', '.aspx', '.jsp', '.cgi',
  '.sql', '.bak', '.old', '.zip', '.tar', '.gz',
  '.exe', '.dll', '.bat', '.sh',
];

// Known human browser UA markers
const HUMAN_BROWSERS: { pattern: string; name: string }[] = [
  { pattern: 'edg/', name: 'Edge' },
  { pattern: 'opr/', name: 'Opera' },
  { pattern: 'opera', name: 'Opera' },
  { pattern: 'firefox/', name: 'Firefox' },
  { pattern: 'chrome/', name: 'Chrome' },
  { pattern: 'safari/', name: 'Safari' },
];

export interface Classification {
  isHuman: boolean;
  botReason: string | null;
  browser: string | null;
  device: 'mobile' | 'desktop' | 'tablet' | null;
}

export function classifyRequest(request: Request, pathname: string): Classification {
  const ua = (request.headers.get('User-Agent') ?? '').toLowerCase();
  const uaRaw = request.headers.get('User-Agent') ?? '';

  // 1. No User-Agent at all = bot
  if (!ua) {
    return { isHuman: false, botReason: 'no-user-agent', browser: null, device: null };
  }

  // 2. Check Cloudflare bot score (available on Business+ plans, but check anyway)
  const botScore = request.headers.get('Cf-Bot-Score');
  if (botScore !== null) {
    const score = parseInt(botScore, 10);
    if (!isNaN(score) && score < 30) {
      return { isHuman: false, botReason: `cf-bot-score:${score}`, browser: null, device: null };
    }
  }

  // 3. Check UA against bot patterns
  for (const pattern of BOT_UA_PATTERNS) {
    if (ua.includes(pattern)) {
      return { isHuman: false, botReason: `ua:${pattern}`, browser: null, device: null };
    }
  }

  // 4. Check path patterns
  const pathLower = pathname.toLowerCase();
  for (const botPath of BOT_PATHS) {
    if (pathLower.startsWith(botPath) || pathLower.includes(botPath)) {
      return { isHuman: false, botReason: `path:${botPath}`, browser: null, device: null };
    }
  }

  // 5. Noise file extensions
  for (const ext of NOISE_EXTENSIONS) {
    if (pathLower.endsWith(ext)) {
      return { isHuman: false, botReason: `ext:${ext}`, browser: null, device: null };
    }
  }

  // 6. Skip non-page noise paths
  if (
    pathLower === '/robots.txt' ||
    pathLower === '/sitemap.xml' ||
    pathLower === '/favicon.ico' ||
    pathLower === '/favicon.svg' ||
    pathLower.startsWith('/cdn-cgi/') ||
    pathLower === '/manifest.json' ||
    pathLower === '/llms.txt'
  ) {
    return { isHuman: false, botReason: `noise:${pathLower}`, browser: null, device: null };
  }

  // 7. Must look like a real browser
  const hasAcceptHtml = (request.headers.get('Accept') ?? '').includes('text/html');
  if (!hasAcceptHtml) {
    // Could be an API call or asset fetch — not a page view
    return { isHuman: false, botReason: 'no-accept-html', browser: null, device: null };
  }

  // 8. Detect browser + device
  let browser: string | null = null;
  for (const b of HUMAN_BROWSERS) {
    if (ua.includes(b.pattern)) {
      browser = b.name;
      break;
    }
  }
  if (!browser) {
    // Has Accept: text/html but no recognizable browser — suspicious
    return { isHuman: false, botReason: 'unknown-browser', browser: null, device: null };
  }

  let device: 'mobile' | 'desktop' | 'tablet' = 'desktop';
  if (ua.includes('mobile') || ua.includes('android')) {
    device = 'mobile';
  } else if (ua.includes('ipad') || ua.includes('tablet')) {
    device = 'tablet';
  }

  return { isHuman: true, botReason: null, browser, device };
}
