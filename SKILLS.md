# FreeAgentStore — Platform Guide

> Canonical copy. Also served at `https://freeagentstore.online/skills.md`.
> Read this BEFORE writing or changing anything on the platform.

## What is FreeAgentStore?

A curated store of AI-powered tools that run entirely in the browser. Models run on the user's GPU/CPU via WebGPU/WASM. Zero server inference cost. Full privacy — data never leaves the device.

**Two agent types:**
- **Model-based** — download an AI model (~150-250MB), cached forever, runs in Web Worker
- **Heuristic** — pure JS functions evolved by LLM from examples. No model, instant results.

## Quick reference

| | |
|---|---|
| **Store** | https://freeagentstore.online |
| **MCP** | `npx mcp-remote https://mcp.freeagentstore.online/mcp` |
| **GitHub** | https://github.com/FreeAgentStore/platform |
| **SDK** | `@freeagentstore/sdk` |
| **CLI** | `@freeagentstore/cli` (`fags` binary) |
| **Pro tier** | https://proagentstore.online (server-side compute) |

## CRITICAL RULES

1. **Every agent must run in the browser.** No server-side inference on the free tier.
2. **AI inference must run in a Web Worker.** Never block the main thread.
3. **Models must cache in Cache Storage.** Download once, use forever.
4. **No cloud AI API calls.** No OpenAI, Anthropic, Google AI, Replicate on the free tier.
5. **No tracking.** No Google Analytics, Mixpanel, Segment, or any third-party analytics.
6. **MIT license required** for all free-tier agents.
7. **Push to main = auto-deploy.** No manual deploy commands.
8. **Never ask for API tokens.** All infra secrets are in Doppler.
9. **agent.json manifest required** in every agent repo root.
10. **Bundle must be < 1MB** (excluding AI models which are loaded separately).

## Per-agent CLAUDE.md convention

Every agent should have a minimal CLAUDE.md:

```markdown
# <agent-name>

<one-line description>

- URL: `<name>.freeagentstore.online`
- Dev: `cd web && pnpm install && pnpm dev`
- Build: `cd web && pnpm build`
- Deploy: `git push origin main` (auto-deploys to R2)

Free, MIT-licensed, no tracking. Read
https://freeagentstore.online/skills.md
before changing anything.
```

## SDK reference

```typescript
// Core
import { initAgent } from '@freeagentstore/sdk';
const agent = initAgent({ agentId: 'my-agent' });
agent.auth    // GitHub OAuth
agent.kv      // Per-user KV storage
agent.rooms   // Real-time WebSocket rooms
agent.models  // Model download + cache
agent.ollama  // Local LLM detection
agent.results // IndexedDB persistence
agent.cache   // Shared model cache

// React hooks
import { useModel, useWorkerInference, useOllama, useResultStore, useModelCache }
  from '@freeagentstore/sdk/hooks';

// Heuristic agents
import { evaluateHeuristic, buildEvolvePrompt, extractCode }
  from '@freeagentstore/sdk';
```

## Agent manifest (agent.json)

Every agent must have an `agent.json` in the repo root:

```json
{
  "name": "Agent Name",
  "description": "What it does",
  "version": "1.0.0",
  "task": "speech-to-text",
  "category": "audio",
  "models": [{ "repo": "onnx-community/whisper-small", "size": "244MB", "backend": ["webgpu", "wasm"], "task": "automatic-speech-recognition" }],
  "estimatedDownload": "244MB",
  "input": ["audio/wav"],
  "output": ["text/plain"],
  "requiresWebGPU": false,
  "requiresOllama": false,
  "offlineCapable": true,
  "desktopOnly": false
}
```

For heuristic agents, `models` is an empty array and `estimatedDownload` is `"0MB"`.

## Compliance checks (9)

| Check | Rule |
|---|---|
| `license-mit` | MIT LICENSE file required |
| `agent-manifest` | Valid agent.json with required fields |
| `bundle-size` | App bundle < 1MB (excluding models) |
| `no-cloud-inference` | No cloud AI API URLs in source |
| `no-tracking` | No analytics/tracker scripts |
| `web-worker-inference` | AI runs in Web Worker |
| `model-cache-required` | Cache Storage for models |
| `privacy-no-exfil` | No user data to external services |
| `dark-mode` | Supports prefers-color-scheme |

## Deployment

```
Push to main → GitHub Actions → build → upload to R2 → live at {agent}.freeagentstore.online
```

The host worker at `*.freeagentstore.online` reads the Host header, looks up the slug in D1, and serves from R2.

## Tech stack

- React 19 + Vite 6 + Tailwind 4 + TypeScript
- Transformers.js / ONNX Runtime Web / kokoro-js (browser inference)
- WebGPU → WASM fallback
- Cloudflare Workers + D1 + R2

## Brand

- Fonts: Fraunces (serif, headings) + Manrope (sans, body)
- Accent: `#7c3aed` (violet)
- Dark mode: default, `prefers-color-scheme` supported
- Design system: same as FreeAppStore/FreeGameStore family

## Heuristic agents

Heuristic agents are pure JS code evolved by an LLM — no model at runtime:

1. Define examples (input → expected output)
2. LLM generates code from examples
3. Evaluate code against examples → score
4. Feed failures back to LLM → improved code
5. Repeat until score converges
6. Ship the pure JS — instant, zero cost

```typescript
import { evaluateHeuristic, buildEvolvePrompt, extractCode } from '@freeagentstore/sdk';

const spec = {
  description: 'Classify sentiment',
  inputType: 'string', outputType: '"positive"|"negative"|"neutral"',
  examples: [
    { input: 'Great product!', expectedOutput: 'positive' },
    { input: 'Terrible service', expectedOutput: 'negative' },
  ],
  history: [],
};

const prompt = buildEvolvePrompt(spec);
const code = extractCode(await llm.generate(prompt));
const result = evaluateHeuristic(code, spec.examples);
// { score: 0.85, passed: 85, total: 100, failures: [...] }
```

## Pro tier (ProAgentStore)

When browser isn't enough: https://proagentstore.online

| Free (FAGS) | Pro (PAGS) |
|---|---|
| User's GPU/CPU | Workers AI (any model) |
| IndexedDB/Cache Storage | D1 database + R2 storage |
| Offline-capable | Cron scheduling |
| No API access | API gateway |
| MIT license | Proprietary OK |
| $0 | $9/mo subscription |
