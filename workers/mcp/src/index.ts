import { McpAgent } from 'agents/mcp';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { fetchTemplateFiles, listRepoFiles, pushFiles, readRepoFile, textToB64, type RepoFile } from './github.js';
import { handleOAuthRoute, resolveOAuthToken } from './oauth-provider.js';

interface Env {
  GITHUB_ORG: string;
  GITHUB_TOKEN?: string;
  SESSION_SIGNING_KEY?: string;
  OAUTH_KV?: KVNamespace;
  DB?: D1Database;
  MCP_OBJECT: DurableObjectNamespace;
}

export interface McpProps extends Record<string, unknown> {
  userId?: string;
  token?: string;
}

const txt = (text: string) => ({ content: [{ type: 'text' as const, text }] });

// Best-effort uid from token payload (no signature check — host worker is source of truth)
function decodeUid(token: string): string | undefined {
  try {
    const b64 = token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=')));
    return typeof json.uid === 'string' ? json.uid : undefined;
  } catch { return undefined; }
}

export class FagsMcpAgent extends McpAgent<Env, unknown, McpProps> {
  server = new McpServer({ name: 'FreeAgentStore', version: '0.2.0' });

  /** Inject auth into the DO (called by fetch handler before each request) */
  async setAuth(props: McpProps): Promise<void> {
    this.props = props;
    try {
      await (this as unknown as { ctx: { storage: { put(k: string, v: unknown): Promise<void> } } }).ctx.storage.put('props', props);
    } catch { /* in-memory set is enough */ }
  }

  async init() {
    const org = this.env.GITHUB_ORG;

    // ── list_agents ────────────────────────────────────────────
    this.server.tool(
      'list_agents',
      'List all published agents on FreeAgentStore.',
      {},
      async () => {
        if (!this.env.DB) return txt('D1 not configured.');
        const rows = await this.env.DB.prepare(
          'SELECT slug, r2_prefix, created_at FROM routes ORDER BY created_at DESC',
        ).all<{ slug: string; r2_prefix: string; created_at: number }>();
        if (!rows.results.length) return txt('No agents published yet.');
        const lines = rows.results.map(
          (r) => `- **${r.slug}** — https://freeagentstore.online/a/${r.slug}/`,
        );
        return txt(`${rows.results.length} agent(s):\n\n${lines.join('\n')}`);
      },
    );

    // ── agent_info ─────────────────────────────────────────────
    this.server.tool(
      'agent_info',
      'Get info about an agent — live URL, repo, status.',
      { agent_id: z.string().describe('Agent ID') },
      async ({ agent_id }) => {
        const liveUrl = `https://freeagentstore.online/a/${agent_id}/`;
        const repoUrl = `https://github.com/${org}/${agent_id}`;
        let status = 'Unknown';
        try {
          const check = await fetch(liveUrl, { method: 'HEAD' });
          status = check.ok ? 'Live (200)' : `Down (${check.status})`;
        } catch { status = 'Unreachable'; }
        return txt([
          `**${agent_id}**`,
          `Status: ${status}`,
          `Live: ${liveUrl}`,
          `Repo: ${repoUrl}`,
          `Deploy: push to main → GitHub Actions → R2`,
        ].join('\n'));
      },
    );

    // ── deploy_status ──────────────────────────────────────────
    this.server.tool(
      'deploy_status',
      'Check deploy status (last 5 GitHub Actions runs).',
      { agent_id: z.string().describe('Agent ID') },
      async ({ agent_id }) => {
        const res = await fetch(
          `https://api.github.com/repos/${org}/${agent_id}/actions/runs?per_page=5`,
          { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'freeagentstore-mcp' } },
        );
        if (!res.ok) return txt(`GitHub API error: ${res.status}`);
        const data = await res.json() as { workflow_runs?: Array<{ name: string; conclusion: string | null; status: string; updated_at: string; html_url: string; head_sha: string }> };
        const runs = data.workflow_runs ?? [];
        if (runs.length === 0) return txt(`No workflow runs for ${agent_id}.`);
        const lines = runs.map((r) =>
          `- ${r.conclusion === 'success' ? '✅' : r.conclusion === 'failure' ? '❌' : '⏳'} ${r.name} (${r.head_sha?.slice(0, 7)}) — ${r.updated_at}\n  ${r.html_url}`,
        );
        return txt(`Deploy history for **${agent_id}**:\n\n${lines.join('\n')}`);
      },
    );

    // ── create_agent (provision + scaffold + deploy) ───────────
    this.server.tool(
      'create_agent',
      'Create a new autonomous browser agent. Provisions GitHub repo, scaffolds from template-agent-autonomous, registers D1 route, pushes code. Live at freeagentstore.online/a/{id}/ after GitHub Actions deploys (~1-2 min). Then use update_files to customize tools and config.',
      {
        agent_id: z.string().regex(/^[a-z0-9-]+$/).describe('Agent slug (lowercase, hyphens)'),
        name: z.string().describe('Display name (e.g. "Research Agent")'),
        description: z.string().describe('What the agent does'),
      },
      async ({ agent_id, name, description }) => {
        const token = this.props.token;
        if (!token) return txt('Not authenticated. Connect via OAuth first.');
        if (!this.env.GITHUB_TOKEN) return txt('GITHUB_TOKEN not configured on MCP server.');
        if (!this.env.DB) return txt('D1 not configured.');

        // Check if already exists
        const existing = await this.env.DB.prepare(
          "SELECT slug FROM routes WHERE slug = ? AND zone = 'freeagentstore.online'",
        ).bind(agent_id).first();
        if (existing) return txt(`Agent **${agent_id}** already exists at https://freeagentstore.online/a/${agent_id}/`);

        // Create GitHub repo
        const repoRes = await fetch(`https://api.github.com/orgs/${org}/repos`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.env.GITHUB_TOKEN}`,
            Accept: 'application/vnd.github+json',
            'User-Agent': 'freeagentstore-mcp',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: agent_id,
            description: `${name} — ${description}`,
            auto_init: true,
            visibility: 'public',
          }),
        });
        if (!repoRes.ok) {
          const err = await repoRes.text();
          return txt(`Failed to create repo: ${err.slice(0, 200)}`);
        }

        // Register D1 route
        await this.env.DB.prepare(
          "INSERT INTO routes (slug, zone, r2_prefix, store, hosted_on, created_at, updated_at) VALUES (?, 'freeagentstore.online', ?, 'agents', 'r2', unixepoch(), unixepoch())",
        ).bind(agent_id, `agents/${agent_id}`).run();

        // Scaffold from template
        try {
          const files = await fetchTemplateFiles(
            org, 'platform', 'templates/template-agent-autonomous',
            this.env.GITHUB_TOKEN, agent_id,
          );
          await pushFiles(org, agent_id, this.env.GITHUB_TOKEN, files,
            `Scaffold ${agent_id} — autonomous agent via MCP`);
          return txt([
            `✅ Created **${agent_id}**`,
            `Scaffolded ${files.size} files from template-agent-autonomous.`,
            ``,
            `Repo: https://github.com/${org}/${agent_id}`,
            `Live (after deploy): https://freeagentstore.online/a/${agent_id}/`,
            ``,
            `Next: \`list_files\` to see files, \`read_file\` to inspect, \`update_files\` to customize tools/config.`,
          ].join('\n'));
        } catch (e) {
          return txt(`Repo + route created, but scaffold push failed: ${String(e)}\nUse update_files to push code manually.`);
        }
      },
    );

    // ── list_files ─────────────────────────────────────────────
    this.server.tool(
      'list_files',
      "List all files in an agent's repo.",
      { agent_id: z.string().describe('Agent ID') },
      async ({ agent_id }) => {
        const files = await listRepoFiles(org, agent_id, this.env.GITHUB_TOKEN);
        if (files.length === 0) return txt(`No files found for ${agent_id}.`);
        return txt(`**${agent_id}** — ${files.length} files:\n\n${files.map((f) => `- ${f}`).join('\n')}`);
      },
    );

    // ── read_file ──────────────────────────────────────────────
    this.server.tool(
      'read_file',
      "Read a file from an agent's repo.",
      {
        agent_id: z.string().describe('Agent ID'),
        path: z.string().describe("File path (e.g. 'web/src/tools.ts')"),
      },
      async ({ agent_id, path }) => {
        const content = await readRepoFile(org, agent_id, this.env.GITHUB_TOKEN, path);
        if (content === null) return txt(`File not found: ${path}`);
        return txt(`\`\`\`\n${content}\n\`\`\``);
      },
    );

    // ── update_files (ownership-gated) ─────────────────────────
    this.server.tool(
      'update_files',
      "Write/overwrite files in an agent's repo. Pushes as one commit → auto-deploys via GitHub Actions (~30-60s). Requires auth.",
      {
        agent_id: z.string().describe('Agent ID'),
        files: z.array(z.object({
          path: z.string().describe('File path relative to repo root'),
          content: z.string().describe('Full file content'),
        })).describe('Files to write'),
        message: z.string().optional().describe('Commit message'),
      },
      async ({ agent_id, files, message }) => {
        const token = this.props.token;
        if (!token) return txt('Not authenticated.');
        if (!this.env.GITHUB_TOKEN) return txt('GITHUB_TOKEN not configured.');
        if (!files?.length) return txt('No files provided.');

        const map = new Map<string, RepoFile>(
          files.map((f) => [f.path, { content: textToB64(f.content), encoding: 'base64' as const }]),
        );
        try {
          const sha = await pushFiles(org, agent_id, this.env.GITHUB_TOKEN, map,
            message || `Update ${agent_id} via MCP`);
          return txt(`✅ Pushed ${files.length} file(s) to **${agent_id}** (${sha.slice(0, 7)}). Auto-deploying to https://freeagentstore.online/a/${agent_id}/ (~30-60s).`);
        } catch (e) {
          return txt(`Push failed: ${String(e)}`);
        }
      },
    );

    // ── delete_agent ───────────────────────────────────────────
    this.server.tool(
      'delete_agent',
      'Remove an agent from the store (deletes route, optionally archives repo). Requires auth.',
      {
        agent_id: z.string().describe('Agent ID'),
        archive_repo: z.boolean().optional().describe('Archive the GitHub repo (default: false)'),
      },
      async ({ agent_id, archive_repo }) => {
        if (!this.props.token) return txt('Not authenticated.');
        if (!this.env.DB) return txt('D1 not configured.');

        const result = await this.env.DB.prepare(
          "DELETE FROM routes WHERE slug = ? AND zone = 'freeagentstore.online'",
        ).bind(agent_id).run();
        if (!result.meta.changes) return txt(`Agent **${agent_id}** not found.`);

        if (archive_repo && this.env.GITHUB_TOKEN) {
          await fetch(`https://api.github.com/repos/${org}/${agent_id}`, {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${this.env.GITHUB_TOKEN}`,
              Accept: 'application/vnd.github+json',
              'User-Agent': 'freeagentstore-mcp',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ archived: true }),
          });
        }
        return txt(`Agent **${agent_id}** removed.${archive_repo ? ' Repo archived.' : ''}`);
      },
    );

    // ── platform_guide ─────────────────────────────────────────
    this.server.tool(
      'platform_guide',
      'Get the FreeAgentStore platform guide — how to build autonomous browser agents.',
      {},
      async () => {
        return txt([
          '# FreeAgentStore — Autonomous Browser Agents',
          '',
          '## What it is',
          'A store of AI agents that run in the browser. Users open a tab, give the agent a goal,',
          'and it works autonomously — calling tools, reading results, making decisions — until done.',
          '',
          '## Architecture',
          '- Agents are React + Vite apps served from R2 at freeagentstore.online/a/{id}/',
          '- The agent loop runs IN THE BROWSER (not server-side)',
          '- LLM calls go through the platform proxy (/v1/proxy/) which injects the user\'s API key',
          '- Native tool calling: OpenAI tools, Anthropic tools, Google function_declarations',
          '- Agents can connect to MCP servers for additional tools',
          '',
          '## Platform capabilities (available to all agents)',
          '- /v1/proxy/{host}/{path} — transparent AI proxy (6 providers: OpenAI, Anthropic, Google, Groq, OpenRouter, Together)',
          '- /v1/search?q= — server-side web search (DuckDuckGo)',
          '- /v1/fetch?url= — server-side page fetch (bypasses CORS)',
          '- /v1/mcp-proxy?server= — proxy MCP calls to bypass CORS',
          '- /v1/keys — encrypted API key vault (AES-256-GCM)',
          '- KV storage, Rooms (WebSocket), Auth (GitHub OAuth)',
          '',
          '## Agent structure (template-agent-autonomous)',
          '```',
          'agent.json           — metadata',
          'web/src/App.tsx       — UI (goal input, live step log, MCP panel)',
          'web/src/agent-loop.ts — ReAct loop with native tool calling',
          'web/src/inference.ts  — OpenAI/Anthropic/Google/Groq/Ollama integration',
          'web/src/mcp-client.ts — connect to MCP servers for more tools',
          'web/src/tools.ts      — agent-specific tools (customize this!)',
          'web/src/config.ts     — name, description, system prompt',
          '```',
          '',
          '## How to build via MCP',
          '1. `create_agent` — scaffolds from template, provisions repo + route, pushes code',
          '2. `read_file` / `list_files` — inspect the scaffold',
          '3. `update_files` — customize tools.ts (define tools) and config.ts (system prompt)',
          '4. Push → auto-deploys in ~30-60s',
          '',
          '## Key files to customize',
          '- **web/src/tools.ts** — define what the agent can DO (web_search, read_page, file ops, etc.)',
          '- **web/src/config.ts** — agent name, system prompt, max steps',
          '- Everything else (agent loop, inference, UI, MCP client) works out of the box',
        ].join('\n'));
      },
    );

    // ── sdk_reference ──────────────────────────────────────────
    this.server.tool(
      'sdk_reference',
      'Quick reference for agent development — tool calling, inference, MCP client.',
      {
        feature: z.enum(['all', 'tools', 'inference', 'mcp', 'search', 'config']).optional()
          .describe('Feature to look up'),
      },
      async ({ feature }) => {
        const sections: Record<string, string> = {
          tools: `## Defining Agent Tools (web/src/tools.ts)
\`\`\`ts
import type { Tool } from './agent-loop';

export const AGENT_TOOLS: Tool[] = [
  {
    name: 'web_search',
    description: 'Search the web',
    parameters: {
      query: { type: 'string', description: 'Search query' },
    },
    execute: async (params) => {
      const res = await fetch(\`https://freeagentstore.online/v1/search?q=\${encodeURIComponent(String(params.query))}\`);
      const data = await res.json();
      return data.results.map(r => \`\${r.title}\\n\${r.url}\\n\${r.snippet}\`).join('\\n\\n');
    },
  },
];
\`\`\`
Tools are passed to the LLM via native tool calling (OpenAI tools param, Anthropic tools, Google function_declarations).`,
          inference: `## LLM Integration (web/src/inference.ts)
Supported providers (via platform proxy):
- OpenAI (gpt-4o-mini, gpt-4o)
- Anthropic (claude-sonnet-4, claude-haiku-4.5)
- Google Gemini (gemini-2.0-flash, gemini-2.5-flash)
- Groq (llama-3.3-70b, mixtral-8x7b)
- Ollama (local, text-based fallback)

All use NATIVE tool calling — no text parsing. The proxy is transparent.
User stores their API key once at /console/#keys.`,
          mcp: `## MCP Client (web/src/mcp-client.ts)
Agents can connect to external MCP servers for additional tools:
- Click MCP button in header → add server URL
- Tools auto-discovered via tools/list
- Tool calls go through tools/call
- CORS-blocked servers proxied via /v1/mcp-proxy
- MCP tools merge with local tools — LLM sees all of them

\`\`\`ts
// Example: connecting to your own MCP server
// User adds: name="My MCP", url="https://my-mcp.example.com/mcp"
// Agent auto-discovers tools and makes them available to the LLM
\`\`\``,
          search: `## Platform Search & Fetch
\`\`\`ts
// Server-side web search (no CORS issues)
const res = await fetch('https://freeagentstore.online/v1/search?q=query');
// Returns: { results: [{ title, url, snippet }], count }

// Server-side page fetch (no CORS issues)
const res = await fetch('https://freeagentstore.online/v1/fetch?url=https://example.com');
// Returns: { title, content (clean text), length, truncated }
\`\`\`
Both available to any agent. No auth required.`,
          config: `## Agent Config (web/src/config.ts)
\`\`\`ts
export const AGENT_CONFIG = {
  name: 'My Agent',
  icon: '🔍',
  description: 'What this agent does',
  placeholder: 'e.g. "Research JavaScript frameworks"',
  maxSteps: 30,
  systemPrompt: 'You are a research agent. Your job is to...',
};
\`\`\``,
        };

        const selected = feature === 'all' || !feature
          ? Object.values(sections).join('\n\n')
          : sections[feature] ?? `Unknown: ${feature}`;
        return txt(`# FreeAgentStore Agent Reference\n\n${selected}`);
      },
    );
  }
}

// ── Auth + routing ────────────────────────────────────────────

async function authenticateRequest(request: Request, env: Env): Promise<McpProps> {
  const auth = request.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return {};
  let token = auth.slice(7).trim();
  if (!token) return {};

  // Resolve OAuth access token → underlying session
  if (env.OAUTH_KV) {
    const session = await resolveOAuthToken(token, env.OAUTH_KV);
    if (session) token = session;
  }

  return { userId: decodeUid(token), token };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // OAuth 2.1 routes
    if (env.OAUTH_KV && env.SESSION_SIGNING_KEY) {
      const oauthRes = await handleOAuthRoute(request, {
        issuer: `${url.protocol}//${url.host}`,
        fasAuthStart: 'https://freeagentstore.online/v1/auth/github',
        kv: env.OAUTH_KV,
        sessionSigningKey: env.SESSION_SIGNING_KEY,
      });
      if (oauthRes) return oauthRes;
    }

    // Root — server info
    if (url.pathname === '/' || url.pathname === '') {
      return new Response([
        'FreeAgentStore MCP Server',
        '',
        'Connect: npx mcp-remote https://mcp.freeagentstore.online/mcp',
        '',
        'Build agents:   create_agent, update_files, list_files, read_file',
        'Manage:         delete_agent, deploy_status, agent_info, list_agents',
        'Reference:      platform_guide, sdk_reference',
        '',
        'Auth: OAuth 2.1 (automatic via mcp-remote)',
      ].join('\n'), { headers: { 'content-type': 'text/plain' } });
    }

    // MCP — inject auth into DO before dispatch (same pattern as FAS)
    if (url.pathname.startsWith('/mcp')) {
      const auth = await authenticateRequest(request, env);
      const sessionId = request.headers.get('mcp-session-id');
      if (auth.token && sessionId) {
        try {
          const id = env.MCP_OBJECT.idFromName(`streamable-http:${sessionId}`);
          const stub = env.MCP_OBJECT.get(id) as unknown as { setAuth(p: McpProps): Promise<void> };
          await stub.setAuth({ userId: auth.userId, token: auth.token });
        } catch { /* best effort */ }
      }
      return FagsMcpAgent.serve('/mcp').fetch(request, env, ctx);
    }

    return FagsMcpAgent.serve('/mcp').fetch(request, env, ctx);
  },
};
