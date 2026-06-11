/**
 * Analytics dashboard — server-rendered HTML showing real human traffic.
 * Requires auth (any logged-in user).
 */

import type { Env } from './index';

export async function handleDashboard(url: URL, env: Env): Promise<Response> {
  const range = url.searchParams.get('range') ?? '7d';
  const showBots = url.searchParams.get('bots') === '1';

  const seconds: Record<string, number> = {
    '24h': 86400,
    '7d': 604800,
    '30d': 2592000,
  };
  const since = Math.floor(Date.now() / 1000) - (seconds[range] ?? seconds['7d']);

  // Run all queries in parallel
  const [
    summaryRow,
    botSummaryRow,
    hourlyRows,
    topPagesRows,
    browserRows,
    countryRows,
    deviceRows,
    topBotReasonsRows,
    recentBotsRows,
  ] = await Promise.all([
    // Human summary
    env.DB.prepare(
      `SELECT COUNT(*) as views, COUNT(DISTINCT ip_hash) as visitors
       FROM page_views WHERE is_human = 1 AND created_at >= ?`,
    )
      .bind(since)
      .first<{ views: number; visitors: number }>(),

    // Bot summary
    env.DB.prepare(
      `SELECT COUNT(*) as views FROM page_views WHERE is_human = 0 AND created_at >= ?`,
    )
      .bind(since)
      .first<{ views: number }>(),

    // Traffic over time (hourly for 24h, daily for 7d/30d)
    range === '24h'
      ? env.DB.prepare(
          `SELECT (created_at / 3600) * 3600 as bucket, COUNT(*) as views, COUNT(DISTINCT ip_hash) as visitors
           FROM page_views WHERE is_human = 1 AND created_at >= ?
           GROUP BY bucket ORDER BY bucket`,
        )
          .bind(since)
          .all<{ bucket: number; views: number; visitors: number }>()
      : env.DB.prepare(
          `SELECT (created_at / 86400) * 86400 as bucket, COUNT(*) as views, COUNT(DISTINCT ip_hash) as visitors
           FROM page_views WHERE is_human = 1 AND created_at >= ?
           GROUP BY bucket ORDER BY bucket`,
        )
          .bind(since)
          .all<{ bucket: number; views: number; visitors: number }>(),

    // Top pages (human only)
    env.DB.prepare(
      `SELECT path, COUNT(*) as views, COUNT(DISTINCT ip_hash) as visitors
       FROM page_views WHERE is_human = 1 AND created_at >= ?
       GROUP BY path ORDER BY views DESC LIMIT 20`,
    )
      .bind(since)
      .all<{ path: string; views: number; visitors: number }>(),

    // Browser breakdown
    env.DB.prepare(
      `SELECT browser, COUNT(*) as views
       FROM page_views WHERE is_human = 1 AND created_at >= ? AND browser IS NOT NULL
       GROUP BY browser ORDER BY views DESC`,
    )
      .bind(since)
      .all<{ browser: string; views: number }>(),

    // Country breakdown
    env.DB.prepare(
      `SELECT country, COUNT(*) as views, COUNT(DISTINCT ip_hash) as visitors
       FROM page_views WHERE is_human = 1 AND created_at >= ? AND country IS NOT NULL
       GROUP BY country ORDER BY views DESC LIMIT 15`,
    )
      .bind(since)
      .all<{ country: string; views: number; visitors: number }>(),

    // Device breakdown
    env.DB.prepare(
      `SELECT device, COUNT(*) as views
       FROM page_views WHERE is_human = 1 AND created_at >= ? AND device IS NOT NULL
       GROUP BY device ORDER BY views DESC`,
    )
      .bind(since)
      .all<{ device: string; views: number }>(),

    // Top bot reasons (for tuning)
    env.DB.prepare(
      `SELECT bot_reason, COUNT(*) as hits
       FROM page_views WHERE is_human = 0 AND created_at >= ? AND bot_reason IS NOT NULL
       GROUP BY bot_reason ORDER BY hits DESC LIMIT 15`,
    )
      .bind(since)
      .all<{ bot_reason: string; hits: number }>(),

    // Recent bot hits (for debugging)
    showBots
      ? env.DB.prepare(
          `SELECT path, bot_reason, created_at
           FROM page_views WHERE is_human = 0 AND created_at >= ?
           ORDER BY created_at DESC LIMIT 50`,
        )
          .bind(since)
          .all<{ path: string; bot_reason: string; created_at: number }>()
      : Promise.resolve({
          results: [] as { path: string; bot_reason: string; created_at: number }[],
        }),
  ]);

  const summary = summaryRow ?? { views: 0, visitors: 0 };
  const botViews = botSummaryRow?.views ?? 0;
  const totalViews = summary.views + botViews;
  const humanPct = totalViews > 0 ? Math.round((summary.views / totalViews) * 100) : 0;

  const html = renderDashboard({
    range,
    showBots,
    summary,
    botViews,
    humanPct,
    hourly: hourlyRows.results ?? [],
    topPages: topPagesRows.results ?? [],
    browsers: browserRows.results ?? [],
    countries: countryRows.results ?? [],
    devices: deviceRows.results ?? [],
    topBotReasons: topBotReasonsRows.results ?? [],
    recentBots: (recentBotsRows.results ?? []) as {
      path: string;
      bot_reason: string;
      created_at: number;
    }[],
  });

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}

function renderDashboard(data: {
  range: string;
  showBots: boolean;
  summary: { views: number; visitors: number };
  botViews: number;
  humanPct: number;
  hourly: { bucket: number; views: number; visitors: number }[];
  topPages: { path: string; views: number; visitors: number }[];
  browsers: { browser: string; views: number }[];
  countries: { country: string; views: number; visitors: number }[];
  devices: { device: string; views: number }[];
  topBotReasons: { bot_reason: string; hits: number }[];
  recentBots: { path: string; bot_reason: string; created_at: number }[];
}): string {
  const rangeLabel: Record<string, string> = {
    '24h': 'Last 24 hours',
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
  };

  // Build sparkline SVG from hourly data
  const sparkline = buildSparkline(data.hourly);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Analytics — FreeAgentStore</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,700&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
    :root{
      --font-body:'Manrope',system-ui,sans-serif;
      --font-display:'Fraunces',Georgia,serif;
      --paper:#0a0a0a;--panel:#171717;--panel-alt:#1f1f1f;
      --ink:#fafafa;--ink-strong:#ffffff;
      --muted:#a3a3a3;--muted-soft:#737373;
      --accent:#7c3aed;--accent-hover:#6d28d9;--accent-soft:rgba(124,58,237,0.15);
      --green:#22c55e;--red:#ef4444;--yellow:#eab308;
      --line:#262626;--line-strong:#404040;
      --radius:0.75rem;
    }
    body{font-family:var(--font-body);background:var(--paper);color:var(--ink);-webkit-font-smoothing:antialiased;min-height:100vh}
    .container{max-width:1100px;margin:0 auto;padding:2rem 1.5rem}

    header{border-bottom:1px solid var(--line);margin-bottom:2rem;padding-bottom:1rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem}
    header h1{font-family:var(--font-display);font-size:1.5rem;font-weight:700}
    header h1 span{color:var(--accent)}

    .range-picker{display:flex;gap:0.5rem}
    .range-picker a{padding:0.35rem 0.85rem;border-radius:999px;font-size:0.82rem;font-weight:600;border:1px solid var(--line);color:var(--muted);text-decoration:none;transition:all 0.15s}
    .range-picker a:hover{color:var(--ink);border-color:var(--line-strong)}
    .range-picker a.active{background:var(--accent);border-color:var(--accent);color:white}

    .kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin-bottom:2rem}
    .kpi{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:1.25rem}
    .kpi-label{font-size:0.78rem;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem}
    .kpi-value{font-size:2rem;font-weight:700;line-height:1.1}
    .kpi-sub{font-size:0.78rem;color:var(--muted-soft);margin-top:0.25rem}
    .kpi-value.green{color:var(--green)}
    .kpi-value.red{color:var(--red)}

    .chart-box{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:1.25rem;margin-bottom:2rem}
    .chart-box h2{font-size:0.92rem;font-weight:700;margin-bottom:1rem}
    .chart-box svg{width:100%;height:auto}

    .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:2rem}
    @media(max-width:768px){.grid-2{grid-template-columns:1fr}}

    .card{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:1.25rem}
    .card h2{font-size:0.92rem;font-weight:700;margin-bottom:1rem}

    table{width:100%;border-collapse:collapse;font-size:0.85rem}
    th{text-align:left;color:var(--muted);font-weight:600;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;padding:0.5rem 0;border-bottom:1px solid var(--line)}
    td{padding:0.4rem 0;border-bottom:1px solid var(--line);color:var(--ink)}
    td.num{text-align:right;font-variant-numeric:tabular-nums}
    th.num{text-align:right}
    tr:last-child td{border-bottom:none}
    .path{max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--accent)}

    .bar-row{display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem}
    .bar-label{min-width:70px;font-size:0.82rem;font-weight:600}
    .bar-track{flex:1;height:24px;background:var(--panel-alt);border-radius:4px;overflow:hidden}
    .bar-fill{height:100%;border-radius:4px;background:var(--accent);transition:width 0.3s}
    .bar-value{min-width:50px;text-align:right;font-size:0.82rem;font-variant-numeric:tabular-nums;color:var(--muted)}

    .pct-ring{display:inline-block;position:relative;width:80px;height:80px}
    .pct-ring svg{transform:rotate(-90deg)}
    .pct-ring .label{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:1.1rem;font-weight:700}

    .toggle{font-size:0.82rem;color:var(--muted);text-decoration:underline;cursor:pointer}

    footer{border-top:1px solid var(--line);margin-top:2rem;padding-top:1rem;font-size:0.78rem;color:var(--muted-soft);text-align:center}
    footer a{color:var(--accent)}
  </style>
</head>
<body>
<div class="container">
  <header>
    <h1>Analytics <span>/ Human Traffic</span></h1>
    <div class="range-picker">
      <a href="/v1/dashboard?range=24h${data.showBots ? '&bots=1' : ''}" class="${data.range === '24h' ? 'active' : ''}">24h</a>
      <a href="/v1/dashboard?range=7d${data.showBots ? '&bots=1' : ''}" class="${data.range === '7d' ? 'active' : ''}">7 days</a>
      <a href="/v1/dashboard?range=30d${data.showBots ? '&bots=1' : ''}" class="${data.range === '30d' ? 'active' : ''}">30 days</a>
    </div>
  </header>

  <!-- KPIs -->
  <div class="kpi-grid">
    <div class="kpi">
      <div class="kpi-label">Human Page Views</div>
      <div class="kpi-value green">${fmtNum(data.summary.views)}</div>
      <div class="kpi-sub">${rangeLabel[data.range] ?? data.range}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Unique Visitors</div>
      <div class="kpi-value">${fmtNum(data.summary.visitors)}</div>
      <div class="kpi-sub">By IP hash (no PII)</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Bot Requests</div>
      <div class="kpi-value red">${fmtNum(data.botViews)}</div>
      <div class="kpi-sub">Filtered out</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Human %</div>
      <div class="kpi-value" style="color:${data.humanPct > 50 ? 'var(--green)' : 'var(--yellow)'}">${data.humanPct}%</div>
      <div class="kpi-sub">${fmtNum(data.summary.views + data.botViews)} total requests</div>
    </div>
  </div>

  <!-- Traffic chart -->
  <div class="chart-box">
    <h2>Traffic Over Time (${data.range === '24h' ? 'hourly' : 'daily'})</h2>
    ${sparkline}
  </div>

  <!-- Top pages + Browsers -->
  <div class="grid-2">
    <div class="card">
      <h2>Top Pages</h2>
      <table>
        <thead><tr><th>Path</th><th class="num">Views</th><th class="num">Visitors</th></tr></thead>
        <tbody>
${data.topPages.map((p) => `          <tr><td class="path" title="${esc(p.path)}">${esc(p.path)}</td><td class="num">${fmtNum(p.views)}</td><td class="num">${fmtNum(p.visitors)}</td></tr>`).join('\n')}
${data.topPages.length === 0 ? '          <tr><td colspan="3" style="color:var(--muted)">No data yet</td></tr>' : ''}
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2>Browsers</h2>
${renderBars(data.browsers.map((b) => ({ label: b.browser, value: b.views })))}
      <h2 style="margin-top:1.5rem">Devices</h2>
${renderBars(data.devices.map((d) => ({ label: d.device, value: d.views })))}
    </div>
  </div>

  <!-- Countries + Bot reasons -->
  <div class="grid-2">
    <div class="card">
      <h2>Countries</h2>
      <table>
        <thead><tr><th>Country</th><th class="num">Views</th><th class="num">Visitors</th></tr></thead>
        <tbody>
${data.countries.map((c) => `          <tr><td>${esc(c.country)}</td><td class="num">${fmtNum(c.views)}</td><td class="num">${fmtNum(c.visitors)}</td></tr>`).join('\n')}
${data.countries.length === 0 ? '          <tr><td colspan="3" style="color:var(--muted)">No data yet</td></tr>' : ''}
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2>Bot Rejection Reasons</h2>
      <table>
        <thead><tr><th>Reason</th><th class="num">Hits</th></tr></thead>
        <tbody>
${data.topBotReasons.map((r) => `          <tr><td style="font-size:0.8rem">${esc(r.bot_reason)}</td><td class="num">${fmtNum(r.hits)}</td></tr>`).join('\n')}
${data.topBotReasons.length === 0 ? '          <tr><td colspan="2" style="color:var(--muted)">No data yet</td></tr>' : ''}
        </tbody>
      </table>
      <div style="margin-top:1rem">
        <a class="toggle" href="/v1/dashboard?range=${data.range}&bots=${data.showBots ? '0' : '1'}">${data.showBots ? 'Hide' : 'Show'} recent bot hits</a>
      </div>
${
  data.showBots && data.recentBots.length > 0
    ? `
      <table style="margin-top:1rem">
        <thead><tr><th>Path</th><th>Reason</th><th class="num">When</th></tr></thead>
        <tbody>
${data.recentBots.map((b) => `          <tr><td class="path" style="max-width:180px" title="${esc(b.path)}">${esc(b.path)}</td><td style="font-size:0.78rem">${esc(b.bot_reason)}</td><td class="num" style="font-size:0.78rem">${timeAgo(b.created_at)}</td></tr>`).join('\n')}
        </tbody>
      </table>`
    : ''
}
    </div>
  </div>

  <footer>
    <a href="/">Back to store</a> &middot; Bot filtering powered by User-Agent + path + CF headers
  </footer>
</div>
</body>
</html>`;
}

function fmtNum(n: number): string {
  return n.toLocaleString('en-US');
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function timeAgo(epoch: number): string {
  const diff = Math.floor(Date.now() / 1000) - epoch;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function renderBars(items: { label: string; value: number }[]): string {
  if (items.length === 0)
    return '<div style="color:var(--muted);font-size:0.85rem">No data yet</div>';
  const max = Math.max(...items.map((i) => i.value), 1);
  return items
    .map(
      (item) =>
        `      <div class="bar-row">
        <div class="bar-label">${esc(item.label)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round((item.value / max) * 100)}%"></div></div>
        <div class="bar-value">${fmtNum(item.value)}</div>
      </div>`,
    )
    .join('\n');
}

function buildSparkline(data: { bucket: number; views: number; visitors: number }[]): string {
  if (data.length === 0) {
    return '<div style="color:var(--muted);font-size:0.85rem;padding:2rem 0;text-align:center">No data yet. Traffic will appear here once the worker starts logging.</div>';
  }

  const W = 800;
  const H = 180;
  const pad = 30;
  const maxViews = Math.max(...data.map((d) => d.views), 1);

  const points = data.map((d, i) => {
    const x = pad + (i / Math.max(data.length - 1, 1)) * (W - pad * 2);
    const y = H - pad - (d.views / maxViews) * (H - pad * 2);
    return { x, y, views: d.views, visitors: d.visitors, ts: d.bucket };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${H - pad} L${points[0].x.toFixed(1)},${H - pad} Z`;

  // Y-axis labels
  const yLabels = [0, Math.round(maxViews / 2), maxViews]
    .map((v) => {
      const y = H - pad - (v / maxViews) * (H - pad * 2);
      return `<text x="${pad - 5}" y="${y + 4}" fill="#737373" font-size="11" text-anchor="end">${v}</text>`;
    })
    .join('');

  // X-axis labels (first, middle, last)
  const xIndices = [0, Math.floor(points.length / 2), points.length - 1].filter(
    (v, i, a) => a.indexOf(v) === i,
  );
  const xLabels = xIndices
    .map((i) => {
      const p = points[i];
      const d = new Date(p.ts * 1000);
      const label =
        data.length <= 24 ? `${d.getUTCHours()}:00` : `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
      return `<text x="${p.x}" y="${H - 8}" fill="#737373" font-size="11" text-anchor="middle">${label}</text>`;
    })
    .join('');

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="font-family:var(--font-body)">
    <defs>
      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#7c3aed" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="#7c3aed" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${yLabels}
    ${xLabels}
    <line x1="${pad}" y1="${H - pad}" x2="${W - pad}" y2="${H - pad}" stroke="#262626" stroke-width="1"/>
    <path d="${areaPath}" fill="url(#areaGrad)"/>
    <path d="${linePath}" fill="none" stroke="#7c3aed" stroke-width="2.5" stroke-linejoin="round"/>
${points.map((p) => `    <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="#7c3aed"><title>${p.views} views, ${p.visitors} visitors</title></circle>`).join('\n')}
  </svg>`;
}
