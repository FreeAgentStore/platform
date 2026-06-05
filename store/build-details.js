#!/usr/bin/env node
/**
 * Generates static detail pages for each agent in registry.json.
 * Output: store/dist/agents/{id}/index.html
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const registry = JSON.parse(fs.readFileSync(path.join(__dirname, 'registry.json'), 'utf-8'));
const outDir = path.join(__dirname, 'dist');

function generateDetailPage(agent) {
  const isHeuristic = agent.type === 'heuristic';
  const backends = (agent.backends ?? []).join(', ').toUpperCase() || 'None';
  const repoPath = `FreeAgentStore/platform/tree/main/agents/${agent.id}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${agent.name} — FreeAgentStore</title>
  <meta name="description" content="${agent.description} Free, private, runs in your browser.">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${agent.name} — FreeAgentStore">
  <meta property="og:description" content="${agent.description}">
  <meta property="og:url" content="https://freeagentstore.online/agents/${agent.id}/">
  <link rel="canonical" href="https://freeagentstore.online/agents/${agent.id}/">
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: agent.name,
    description: agent.description,
    applicationCategory: agent.category,
    operatingSystem: 'Web',
    url: agent.agentUrl,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    isPartOf: { '@id': 'https://freeagentstore.online/#website' },
  })}</script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,700&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
    :root{--font-body:'Manrope',system-ui,sans-serif;--font-display:'Fraunces',Georgia,serif;--paper:#0a0a0a;--panel:#171717;--ink:#fafafa;--muted:#a3a3a3;--muted-soft:#737373;--accent:#7c3aed;--accent-hover:#6d28d9;--line:#262626;--line-strong:#404040;--shadow:0 1px 3px rgba(0,0,0,0.3);--radius:0.75rem}
    body{font-family:var(--font-body);background:var(--paper);color:var(--ink);-webkit-font-smoothing:antialiased;min-height:100vh}
    .container{max-width:1100px;margin:0 auto;padding:0 1.5rem}
    a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}

    header{border-bottom:1px solid var(--line)}
    header .container{display:flex;align-items:center;gap:1.25rem;padding-top:0.75rem;padding-bottom:0.75rem}
    .brand{display:flex;align-items:center;gap:0.6rem;text-decoration:none;color:var(--ink)}
    .brand-mark{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,var(--accent),#a855f7);display:flex;align-items:center;justify-content:center;font-size:1.1rem}
    .brand-name{font-family:var(--font-display);font-size:1.15rem;font-weight:700}
    .brand-tag{font-size:0.72rem;color:var(--muted);font-weight:500}
    nav{display:flex;gap:1.25rem;font-size:0.88rem;font-weight:600;margin-left:auto}
    nav a{color:var(--muted);text-decoration:none}nav a:hover{color:var(--ink)}
    nav a.pro{color:#3b82f6}

    .back{display:inline-flex;align-items:center;gap:0.3rem;font-size:0.88rem;color:var(--muted);margin:1.25rem 0 1rem;text-decoration:none}
    .back:hover{color:var(--ink)}

    .detail-split{display:grid;grid-template-columns:1fr;gap:2rem}
    @media(min-width:768px){.detail-split{grid-template-columns:1fr 360px}}

    .hero-icon{width:64px;height:64px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:2rem;flex-shrink:0}
    .hero{display:flex;gap:1rem;align-items:start;margin-bottom:1.5rem}
    .hero h1{font-family:var(--font-display);font-size:1.75rem;font-weight:700;line-height:1.2}
    .hero .cat{display:inline-block;font-size:0.78rem;padding:0.15rem 0.6rem;border-radius:999px;background:rgba(124,58,237,0.15);color:#a78bfa;margin-top:0.25rem;font-weight:500}
    .hero .heuristic-cat{background:rgba(217,119,6,0.15);color:#fbbf24}
    .hero .dev{font-size:0.82rem;color:var(--muted);margin-top:0.3rem}

    .desc{color:var(--muted);line-height:1.7;margin-bottom:1.25rem;font-size:0.95rem}

    .badges{display:flex;flex-wrap:wrap;gap:0.5rem;margin-bottom:1.25rem}
    .badge-pass{display:inline-flex;align-items:center;gap:0.35rem;font-size:0.82rem;color:#4ade80}
    .badge-pass .dot{width:8px;height:8px;border-radius:50%;background:#4ade80;flex-shrink:0}

    .meta-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:0.75rem;margin-bottom:1.5rem}
    @media(max-width:500px){.meta-grid{grid-template-columns:repeat(2,1fr)}}
    .meta-item .label{font-size:0.72rem;color:var(--muted-soft);text-transform:uppercase;letter-spacing:0.05em;font-weight:600;margin-bottom:0.15rem}
    .meta-item .value{font-size:0.88rem}

    .actions{display:flex;flex-wrap:wrap;gap:0.5rem;margin-bottom:2rem}
    .btn-primary{display:inline-flex;align-items:center;gap:0.4rem;padding:0.6rem 1.25rem;border-radius:10px;background:var(--accent);color:#fff;font-weight:600;font-size:0.9rem;text-decoration:none}
    .btn-primary:hover{background:var(--accent-hover);text-decoration:none}
    .btn-secondary{display:inline-flex;align-items:center;gap:0.4rem;padding:0.6rem 1.25rem;border-radius:10px;border:1px solid var(--line);color:var(--muted);font-weight:600;font-size:0.9rem;text-decoration:none}
    .btn-secondary:hover{border-color:var(--line-strong);color:var(--ink);text-decoration:none}

    .phone-frame{background:var(--panel);border:1px solid var(--line);border-radius:20px;overflow:hidden;aspect-ratio:9/16;max-height:600px}
    .phone-frame iframe{width:100%;height:100%;border:none}
    .preview-note{font-size:0.75rem;color:var(--muted-soft);text-align:center;margin-top:0.5rem}

    .section{margin-bottom:2rem}
    .section h2{font-family:var(--font-display);font-size:1.15rem;font-weight:700;margin-bottom:0.5rem}
    .section p{color:var(--muted);font-size:0.9rem;line-height:1.6}

    footer{border-top:1px solid var(--line);padding:1.5rem 0;margin-top:2rem;text-align:center;font-size:0.8rem;color:var(--muted-soft)}
    footer a{color:var(--muted)}
  </style>
</head>
<body>
  <header>
    <div class="container">
      <a href="https://freeagentstore.online" class="brand">
        <span class="brand-mark">🤖</span>
        <span style="display:flex;flex-direction:column">
          <span class="brand-name">AgentStore</span>
          <span class="brand-tag">Free AI Tools</span>
        </span>
      </a>
      <nav>
        <a href="https://freeagentstore.online">Agents</a>
        <a href="https://freeagentstore.online/skills.md">Docs</a>
        <a href="https://console.freeagentstore.online">Console</a>
        <a href="https://github.com/FreeAgentStore">GitHub</a>
        <a href="https://proagentstore.online" class="pro">Pro</a>
      </nav>
    </div>
  </header>

  <main class="container">
    <a href="https://freeagentstore.online" class="back">&larr; All agents</a>

    <div class="detail-split">
      <div>
        <!-- Hero -->
        <div class="hero">
          <div class="hero-icon" style="background:${agent.iconBg}">${agent.icon}</div>
          <div>
            <h1>${agent.name}</h1>
            <span class="cat${isHeuristic ? ' heuristic-cat' : ''}">${agent.category}${isHeuristic ? ' / heuristic' : ''}</span>
            <div class="dev">by ${agent.developer}</div>
          </div>
        </div>

        <!-- Description -->
        <p class="desc">${agent.description} Runs entirely in your browser — your data never leaves your device.</p>

        <!-- Badges -->
        <div class="badges">
          <span class="badge-pass"><span class="dot"></span> Free forever</span>
          ${agent.offlineCapable ? '<span class="badge-pass"><span class="dot"></span> Works offline</span>' : ''}
          <span class="badge-pass"><span class="dot"></span> 100% private</span>
          <span class="badge-pass"><span class="dot"></span> Open source (MIT)</span>
        </div>

        <!-- Meta grid -->
        <div class="meta-grid">
          <div class="meta-item">
            <div class="label">Price</div>
            <div class="value">Free forever</div>
          </div>
          <div class="meta-item">
            <div class="label">Model</div>
            <div class="value">${agent.model ?? 'None'}</div>
          </div>
          <div class="meta-item">
            <div class="label">Download</div>
            <div class="value">${agent.modelSize ?? '0MB'}</div>
          </div>
          <div class="meta-item">
            <div class="label">Backends</div>
            <div class="value">${backends}</div>
          </div>
          <div class="meta-item">
            <div class="label">Offline</div>
            <div class="value">${agent.offlineCapable ? 'Yes' : 'No'}</div>
          </div>
          <div class="meta-item">
            <div class="label">Desktop only</div>
            <div class="value">${agent.desktopOnly ? 'Yes' : 'No'}</div>
          </div>
        </div>

        <!-- Actions -->
        <div class="actions">
          <a href="${agent.agentUrl}" class="btn-primary" target="_blank" rel="noopener">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg>
            Open Agent
          </a>
          <a href="https://github.com/${repoPath}" class="btn-secondary" target="_blank" rel="noopener">View Source</a>
          <a href="https://console.freeagentstore.online" class="btn-secondary">Console</a>
        </div>

        <!-- About -->
        <div class="section">
          <h2>About</h2>
          <p>${agent.description}</p>
          <p style="margin-top:0.5rem">
            ${isHeuristic
              ? 'This is a <strong>heuristic agent</strong> — pure JavaScript code evolved by an LLM from examples. No AI model needed at runtime. Instant results, zero download.'
              : `This agent uses the <strong>${agent.model}</strong> model (${agent.modelSize}). The model downloads once and is cached in your browser — subsequent uses are instant.`
            }
          </p>
          ${!isHeuristic ? `<p style="margin-top:0.5rem">Inference runs in a Web Worker via ${backends.includes('WEBGPU') ? 'WebGPU (GPU-accelerated) with WASM fallback' : 'WASM'}. Your main thread stays responsive.</p>` : ''}
        </div>

        <!-- Privacy -->
        <div class="section">
          <h2>Privacy</h2>
          <p>${agent.name} processes everything locally in your browser. No data is sent to any server. No analytics, no tracking, no cookies. ${isHeuristic ? 'No AI model is downloaded.' : 'The AI model is downloaded from HuggingFace CDN and cached locally.'}</p>
        </div>

        <!-- Open Source -->
        <div class="section">
          <h2>Open Source</h2>
          <p>Fully open source under the MIT license. Inspect the code, report bugs, or contribute improvements.</p>
          <p style="margin-top:0.5rem"><a href="https://github.com/${repoPath}">View source on GitHub &rarr;</a></p>
        </div>

        <!-- Pro upgrade path -->
        ${!isHeuristic ? `
        <div class="section">
          <h2>Need more power?</h2>
          <p><a href="https://proagentstore.online">ProAgentStore</a> offers server-side compute: run larger models, batch processing, scheduled jobs, and API access. $9/mo for everything.</p>
        </div>` : ''}
      </div>

      <!-- Phone frame preview -->
      <aside>
        <div class="phone-frame">
          <iframe src="${agent.agentUrl}" title="${agent.name} live preview" loading="lazy" sandbox="allow-scripts allow-same-origin allow-popups" referrerpolicy="no-referrer"></iframe>
        </div>
        <p class="preview-note">Live preview. <a href="${agent.agentUrl}" target="_blank">Open in new tab</a> for full experience.</p>
      </aside>
    </div>
  </main>

  <footer>
    <div class="container">
      <a href="https://freeagentstore.online">FreeAgentStore</a> &middot;
      <a href="https://freeagentstore.online/skills.md">Docs</a> &middot;
      <a href="https://github.com/FreeAgentStore">GitHub</a> &middot;
      <a href="https://proagentstore.online" style="color:#3b82f6">Pro</a>
    </div>
  </footer>
</body>
</html>`;
}

// Generate
for (const agent of registry.agents) {
  const dir = path.join(outDir, 'agents', agent.id);
  fs.mkdirSync(dir, { recursive: true });
  const html = generateDetailPage(agent);
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  console.log(`Generated: /agents/${agent.id}/`);
}

console.log(`Done. ${registry.agents.length} detail pages.`);
