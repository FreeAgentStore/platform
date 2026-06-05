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

        <!-- Use this agent -->
        <div class="section">
          <h2>Use this agent</h2>
          <p style="margin-bottom:0.75rem">Add to any app via npm or import directly from URL — no install needed.</p>
          <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:1rem;font-family:monospace;font-size:0.82rem;overflow-x:auto">
            <div style="color:var(--muted-soft);margin-bottom:0.5rem"># npm / pnpm</div>
            <div>pnpm add ${agent.npmPkg ?? '@freeagentstore/' + agent.id}</div>
            <div style="color:var(--muted-soft);margin-top:0.75rem"># or import directly (zero install)</div>
            <div style="color:#a78bfa">import { ... } from '${agent.esmUrl ?? 'https://freeagentstore.online/pkg/' + agent.id + '/index.js'}'</div>
          </div>
        </div>

        <!-- Apps using this agent -->
        <div class="section">
          <h2>Apps using this agent</h2>
          ${(agent.usedByApps?.length > 0) ? agent.usedByApps.map(app => `
          <a href="${app.url}" style="display:flex;align-items:center;gap:0.75rem;padding:0.75rem;border-radius:10px;background:var(--panel);border:1px solid var(--line);text-decoration:none;color:var(--ink);margin-bottom:0.5rem;transition:border-color 0.15s" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--line)'">
            <div style="flex:1">
              <div style="font-weight:600;font-size:0.9rem">${app.name}</div>
              <div style="font-size:0.78rem;color:var(--muted)">${app.description}</div>
            </div>
            <span style="font-size:0.72rem;color:var(--muted-soft);flex-shrink:0">${app.store} &rarr;</span>
          </a>`).join('') : `
          <p style="color:var(--muted)">No apps yet. <a href="https://freeappstore.online">Build one on FreeAppStore</a> and import <code style="background:var(--panel);padding:0.1rem 0.4rem;border-radius:4px;font-size:0.82rem">${agent.npmPkg ?? '@freeagentstore/' + agent.id}</code>.</p>`}
        </div>

        <!-- About -->
        <div class="section">
          <h2>How it works</h2>
          ${isHeuristic
            ? '<p>This is a <strong>heuristic agent</strong> — pure JavaScript code evolved by an LLM from examples. No AI model at runtime. Instant results, zero download, works offline.</p>'
            : agent.type === 'built-in-ai'
            ? '<p>Uses <strong>Chrome Built-in AI</strong> (Gemini Nano) — a 4GB model pre-installed in your browser by Google. Zero download, instant inference, fully on-device. Falls back to Ollama if available. Requires Chrome 138+ or Edge with Aion.</p>'
            : `<p>Uses the <strong>${agent.model}</strong> model (${agent.modelSize}). Downloads once, cached in Cache Storage forever. Inference runs in a Web Worker via ${backends.includes('WEBGPU') ? 'WebGPU with WASM fallback' : 'WASM'}.</p>`
          }
          <p style="margin-top:0.5rem">100% private — no data leaves your browser. Open source (MIT). <a href="https://github.com/${repoPath}">View source</a>.</p>
        </div>

        ${!isHeuristic ? `
        <div class="section">
          <h2>Need server-side?</h2>
          <p><a href="https://proagentstore.online">ProAgentStore</a> — larger models, batch processing, cron, API access. $9/mo.</p>
        </div>` : ''}
      </div>

      <!-- Sandbox -->
      <aside>
        <div style="background:var(--panel);border:1px solid var(--line);border-radius:16px;overflow:hidden">
          <div style="padding:0.75rem 1rem;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:0.5rem">
            <span style="font-size:0.85rem;font-weight:600">Sandbox</span>
            <span style="font-size:0.72rem;color:var(--muted)">Try it live</span>
          </div>
          <div id="sandbox" style="padding:1rem">
            ${generateSandbox(agent)}
          </div>
          <div style="padding:0.5rem 1rem;border-top:1px solid var(--line);font-size:0.72rem;color:var(--muted-soft);text-align:center">
            <a href="${agent.agentUrl}" style="color:var(--muted)">Open full app &rarr;</a>
          </div>
        </div>
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

function generateSandbox(agent) {
  if (!agent.sandbox?.methods?.length) {
    return `<p style="color:var(--muted);font-size:0.85rem">Sandbox coming soon. <a href="${agent.agentUrl}">Try the full app</a>.</p>`;
  }

  const methods = agent.sandbox.methods;
  let html = '';

  for (const method of methods) {
    const paramInputs = (method.params ?? []).map((p, i) => {
      if (p.type === 'text' || p.type === 'number') {
        return `<div style="margin-bottom:0.5rem">
          <label style="font-size:0.72rem;color:var(--muted-soft);display:block;margin-bottom:0.2rem">${p.name}</label>
          <input type="${p.type === 'number' ? 'number' : 'text'}" id="param-${method.name}-${i}" value="${p.default ?? ''}" placeholder="${p.placeholder ?? ''}"
            style="width:100%;padding:0.5rem;border-radius:8px;border:1px solid var(--line);background:var(--paper);color:var(--ink);font-family:monospace;font-size:0.85rem" />
        </div>`;
      }
      if (p.type === 'select') {
        const opts = (p.options ?? []).map(o => `<option value="${o}"${o === p.default ? ' selected' : ''}>${o}</option>`).join('');
        return `<div style="margin-bottom:0.5rem">
          <label style="font-size:0.72rem;color:var(--muted-soft);display:block;margin-bottom:0.2rem">${p.name}</label>
          <select id="param-${method.name}-${i}" style="width:100%;padding:0.5rem;border-radius:8px;border:1px solid var(--line);background:var(--paper);color:var(--ink);font-size:0.85rem">${opts}</select>
        </div>`;
      }
      if (p.type === 'file') {
        return `<div style="margin-bottom:0.5rem">
          <label style="font-size:0.72rem;color:var(--muted-soft);display:block;margin-bottom:0.2rem">${p.name}</label>
          <input type="file" id="param-${method.name}-${i}" accept="${p.accept ?? '*/*'}"
            style="width:100%;padding:0.5rem;border-radius:8px;border:1px solid var(--line);background:var(--paper);color:var(--ink);font-size:0.85rem" />
        </div>`;
      }
      return '';
    }).join('');

    const paramGatherer = (method.params ?? []).map((p, i) => {
      if (p.type === 'number') return `Number(document.getElementById('param-${method.name}-${i}').value)`;
      if (p.type === 'file') return `null /* file handling TODO */`;
      return `document.getElementById('param-${method.name}-${i}').value`;
    }).join(', ');

    if (method.note) {
      html += `<p style="font-size:0.75rem;color:var(--muted-soft);margin-bottom:0.5rem">${method.note}</p>`;
    }

    html += `${paramInputs}
    <button onclick="runSandbox_${method.name}()" style="width:100%;padding:0.6rem;border-radius:10px;border:none;background:var(--accent);color:white;font-weight:600;font-size:0.88rem;cursor:pointer;margin-bottom:0.75rem">${method.label}</button>
    <div id="result-${method.name}" style="background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:0.75rem;font-family:monospace;font-size:0.82rem;min-height:2.5rem;white-space:pre-wrap;word-break:break-all;color:var(--muted)">Click "${method.label}" to try</div>

    ${method.builtInAI ? `<script>
      window.runSandbox_${method.name} = async function() {
        const out = document.getElementById('result-${method.name}');
        out.style.color = 'var(--ink)';
        out.textContent = 'Running...';
        try {
          const g = globalThis;
          const LM = g.LanguageModel || (g.ai && g.ai.languageModel);
          if (!LM || !LM.create) {
            // Fallback: try Ollama
            try {
              const r = await fetch('http://localhost:11434/api/generate', {
                method: 'POST', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({model:'llama3.2', prompt: '${(method.systemPrompt ?? '').replace(/'/g, "\\'")}\\n\\n' + ${paramGatherer}, stream:false})
              });
              if (r.ok) { out.textContent = (await r.json()).response; return; }
            } catch(e) {}
            out.style.color = '#fbbf24';
            out.textContent = 'Built-in AI not available in this browser.\\nEnable: chrome://flags → Prompt API for Gemini Nano\\nOr install Ollama locally.';
            return;
          }
          const session = await LM.create({systemPrompt: '${(method.systemPrompt ?? '').replace(/'/g, "\\'")}'});
          const result = await session.prompt(${paramGatherer});
          session.destroy && session.destroy();
          out.textContent = result;
        } catch(e) {
          out.style.color = '#f87171';
          out.textContent = 'Error: ' + e.message;
        }
      };
    <\/script>` : `<script type="module">
      import * as mod from '${agent.esmUrl ?? 'https://freeagentstore.online/pkg/' + agent.id + '/index.js'}';
      window.runSandbox_${method.name} = async function() {
        const out = document.getElementById('result-${method.name}');
        out.style.color = 'var(--ink)';
        out.textContent = 'Running...';
        try {
          const result = mod.${method.name}(${paramGatherer});
          out.textContent = JSON.stringify(result, null, 2);
        } catch(e) {
          out.style.color = '#f87171';
          out.textContent = 'Error: ' + e.message;
        }
      };
    <\/script>`}`;
  }

  return html;
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
