import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpAgent } from 'agents/mcp';
import { z } from 'zod';
import {
  deleteRepoFile,
  fetchTemplateFiles,
  listRepoFiles,
  pushFiles,
  type RepoFile,
  readRepoFile,
  searchRepoFiles,
  textToB64,
} from './github.js';
import { handleOAuthRoute, resolveOAuthToken } from './oauth-provider.js';
import { verifySession } from './session.js';

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

export class FagsMcpAgent extends McpAgent<Env, unknown, McpProps> {
  server = new McpServer({ name: 'FreeAgentStore', version: '0.3.0' });

  async setAuth(props: McpProps): Promise<void> {
    this.props = props;
    try {
      await (
        this as unknown as { ctx: { storage: { put(k: string, v: unknown): Promise<void> } } }
      ).ctx.storage.put('props', props);
    } catch {}
  }

  /** Check if the current user owns an agent (by D1 owner_id). */
  private async ownsAgent(agentId: string): Promise<boolean> {
    const uid = this.props.userId;
    if (!uid || !this.env.DB) return false;
    const row = await this.env.DB.prepare(
      "SELECT owner_id FROM routes WHERE slug = ? AND zone = 'freeagentstore.online'",
    )
      .bind(agentId)
      .first<{ owner_id: string | null }>();
    if (!row) return false;
    // Legacy agents without owner_id: deny writes (must be backfilled by admin)
    if (!row.owner_id) return false;
    return row.owner_id === uid;
  }

  async init() {
    const org = this.env.GITHUB_ORG;

    // ── list_agents ────────────────────────────────────────────
    this.server.tool(
      'list_agents',
      'List all published agents, or just yours if authenticated.',
      { mine: z.boolean().optional().describe('If true, list only your agents') },
      async ({ mine }) => {
        if (!this.env.DB) return txt('D1 not configured.');
        const uid = this.props.userId;
        let rows: D1Result<{ slug: string; created_at: number }>;
        if (mine && uid) {
          rows = await this.env.DB.prepare(
            'SELECT slug, created_at FROM routes WHERE owner_id = ? ORDER BY created_at DESC',
          )
            .bind(uid)
            .all<{ slug: string; created_at: number }>();
        } else {
          rows = await this.env.DB.prepare(
            'SELECT slug, created_at FROM routes ORDER BY created_at DESC',
          ).all<{ slug: string; created_at: number }>();
        }
        if (!rows.results.length)
          return txt(
            mine
              ? 'You have no agents yet. Use `create_agent` to build one.'
              : 'No agents published yet.',
          );
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
        } catch {
          status = 'Unreachable';
        }
        return txt(
          `**${agent_id}**\nStatus: ${status}\nLive: ${liveUrl}\nRepo: ${repoUrl}\nDeploy: push to main -> GitHub Actions -> R2`,
        );
      },
    );

    // ── deploy_status ──────────────────────────────────────────
    this.server.tool(
      'deploy_status',
      'Check deploy status (last 5 GitHub Actions runs).',
      { agent_id: z.string().describe('Agent ID') },
      async ({ agent_id }) => {
        const ghToken = this.env.GITHUB_TOKEN;
        const res = await fetch(
          `https://api.github.com/repos/${org}/${agent_id}/actions/runs?per_page=5`,
          {
            headers: {
              ...(ghToken ? { Authorization: `Bearer ${ghToken}` } : {}),
              Accept: 'application/vnd.github+json',
              'User-Agent': 'freeagentstore-mcp',
            },
          },
        );
        if (!res.ok) return txt(`GitHub API error: ${res.status}`);
        const data = (await res.json()) as {
          workflow_runs?: Array<{
            name: string;
            conclusion: string | null;
            status: string;
            updated_at: string;
            html_url: string;
            head_sha: string;
          }>;
        };
        const runs = data.workflow_runs ?? [];
        if (runs.length === 0) return txt(`No workflow runs for ${agent_id}.`);
        const lines = runs.map(
          (r) =>
            `- ${r.conclusion === 'success' ? 'ok' : r.conclusion === 'failure' ? 'FAIL' : '...'} ${r.name} (${r.head_sha?.slice(0, 7)}) — ${r.updated_at}\n  ${r.html_url}`,
        );
        return txt(`Deploy history for **${agent_id}**:\n\n${lines.join('\n')}`);
      },
    );

    // ── create_agent ───────────────────────────────────────────
    this.server.tool(
      'create_agent',
      'Create a new autonomous browser agent. Provisions GitHub repo, scaffolds from template, registers D1 route with ownership, pushes code. Live at freeagentstore.online/a/{id}/ after deploy (~1-2 min).',
      {
        agent_id: z
          .string()
          .regex(/^[a-z0-9-]+$/)
          .describe('Agent slug (lowercase, hyphens)'),
        name: z.string().describe('Display name'),
        description: z.string().describe('What the agent does'),
      },
      async ({ agent_id, name, description }) => {
        const uid = this.props.userId;
        const token = this.props.token;
        if (!token || !uid) return txt('Not authenticated. Connect via OAuth first.');
        if (!this.env.GITHUB_TOKEN) return txt('GITHUB_TOKEN not configured.');
        if (!this.env.DB) return txt('D1 not configured.');

        const existing = await this.env.DB.prepare(
          "SELECT slug FROM routes WHERE slug = ? AND zone = 'freeagentstore.online'",
        )
          .bind(agent_id)
          .first();
        if (existing)
          return txt(
            `Agent **${agent_id}** already exists at https://freeagentstore.online/a/${agent_id}/`,
          );

        // Create repo
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
        if (!repoRes.ok)
          return txt(`Failed to create repo: ${(await repoRes.text()).slice(0, 200)}`);

        // Register route with owner
        await this.env.DB.prepare(
          "INSERT INTO routes (slug, zone, r2_prefix, store, hosted_on, owner_id, created_at, updated_at) VALUES (?, 'freeagentstore.online', ?, 'agents', 'r2', ?, unixepoch(), unixepoch())",
        )
          .bind(agent_id, `agents/${agent_id}`, uid)
          .run();

        // Scaffold
        try {
          const files = await fetchTemplateFiles(
            org,
            'platform',
            'templates/template-agent-autonomous',
            this.env.GITHUB_TOKEN,
            agent_id,
          );
          await pushFiles(
            org,
            agent_id,
            this.env.GITHUB_TOKEN,
            files,
            `Scaffold ${agent_id} via MCP`,
          );
          return txt(
            `Created **${agent_id}** (${files.size} files).\nRepo: https://github.com/${org}/${agent_id}\nLive (after deploy): https://freeagentstore.online/a/${agent_id}/\n\nNext: \`read_file\` to inspect, \`update_files\` to customize tools.ts and config.ts.`,
          );
        } catch (e) {
          return txt(
            `Repo + route created, but scaffold failed: ${String(e)}\nUse \`update_files\` to push code.`,
          );
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
        return txt(
          `**${agent_id}** — ${files.length} files:\n\n${files.map((f) => `- ${f}`).join('\n')}`,
        );
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

    // ── search_files ───────────────────────────────────────────
    this.server.tool(
      'search_files',
      "Search for text across all files in an agent's repo. Returns matching file paths and line previews.",
      {
        agent_id: z.string().describe('Agent ID'),
        query: z.string().describe('Text to search for (case-insensitive)'),
      },
      async ({ agent_id, query }) => {
        const results = await searchRepoFiles(org, agent_id, query, this.env.GITHUB_TOKEN);
        if (results.length === 0) return txt(`No matches for "${query}" in ${agent_id}.`);
        const lines = results.map(
          (r) => `**${r.path}**\n${r.matches.map((m) => `  ${m}`).join('\n')}`,
        );
        return txt(`${results.length} file(s) match "${query}":\n\n${lines.join('\n\n')}`);
      },
    );

    // ── update_files (ownership-gated) ─────────────────────────
    this.server.tool(
      'update_files',
      "Write/overwrite files in an agent's repo as one commit. Auto-deploys ~30-60s. Requires ownership.",
      {
        agent_id: z.string().describe('Agent ID'),
        files: z
          .array(z.object({ path: z.string(), content: z.string() }))
          .describe('Files to write (full content each)'),
        message: z.string().optional().describe('Commit message'),
      },
      async ({ agent_id, files, message }) => {
        if (!this.props.token) return txt('Not authenticated.');
        if (!this.env.GITHUB_TOKEN) return txt('GITHUB_TOKEN not configured.');
        if (!files?.length) return txt('No files provided.');
        if (!(await this.ownsAgent(agent_id)))
          return txt(`You don't own "${agent_id}". Only the creator can update it.`);

        const map = new Map<string, RepoFile>(
          files.map((f) => [
            f.path,
            { content: textToB64(f.content), encoding: 'base64' as const },
          ]),
        );
        try {
          const sha = await pushFiles(
            org,
            agent_id,
            this.env.GITHUB_TOKEN,
            map,
            message || `Update ${agent_id} via MCP`,
          );
          return txt(
            `Pushed ${files.length} file(s) to **${agent_id}** (${sha.slice(0, 7)}). Deploying to https://freeagentstore.online/a/${agent_id}/`,
          );
        } catch (e) {
          return txt(`Push failed: ${String(e)}`);
        }
      },
    );

    // ── delete_file (ownership-gated) ──────────────────────────
    this.server.tool(
      'delete_file',
      "Delete a file from an agent's repo. Requires ownership.",
      {
        agent_id: z.string().describe('Agent ID'),
        path: z.string().describe('File path to delete'),
        message: z.string().optional().describe('Commit message'),
      },
      async ({ agent_id, path, message }) => {
        if (!this.props.token) return txt('Not authenticated.');
        if (!this.env.GITHUB_TOKEN) return txt('GITHUB_TOKEN not configured.');
        if (!(await this.ownsAgent(agent_id))) return txt(`You don't own "${agent_id}".`);
        try {
          await deleteRepoFile(
            org,
            agent_id,
            this.env.GITHUB_TOKEN,
            path,
            message || `Delete ${path} via MCP`,
          );
          return txt(`Deleted **${path}** from ${agent_id}.`);
        } catch (e) {
          return txt(`Delete failed: ${String(e)}`);
        }
      },
    );

    // ── delete_agent (ownership-gated) ─────────────────────────
    this.server.tool(
      'delete_agent',
      'Remove an agent from the store. Requires ownership.',
      {
        agent_id: z.string().describe('Agent ID'),
        archive_repo: z.boolean().optional().describe('Archive the GitHub repo'),
      },
      async ({ agent_id, archive_repo }) => {
        if (!this.props.token) return txt('Not authenticated.');
        if (!this.env.DB) return txt('D1 not configured.');
        if (!(await this.ownsAgent(agent_id))) return txt(`You don't own "${agent_id}".`);

        await this.env.DB.prepare(
          "DELETE FROM routes WHERE slug = ? AND zone = 'freeagentstore.online'",
        )
          .bind(agent_id)
          .run();

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

    // ── publish_to_store ───────────────────────────────────────
    this.server.tool(
      'publish_to_store',
      'Add an agent to the store registry so it appears on freeagentstore.online. Updates registry.json in the platform repo and triggers a store rebuild. Requires ownership.',
      {
        agent_id: z.string().describe('Agent ID (must already be created)'),
        name: z.string().describe('Display name'),
        description: z.string().describe('Store description'),
        icon: z.string().optional().describe('Emoji icon (default: robot)'),
        icon_bg: z.string().optional().describe('Icon background color (hex, default: #7c3aed)'),
        category: z
          .enum([
            'text',
            'productivity',
            'code',
            'vision',
            'game-ai',
            'creative',
            'audio',
            'education',
            'automation',
            'web-analysis',
          ])
          .describe('Store category'),
      },
      async ({ agent_id, name, description, icon, icon_bg, category }) => {
        if (!this.props.token) return txt('Not authenticated.');
        if (!this.env.GITHUB_TOKEN) return txt('GITHUB_TOKEN not configured.');
        if (!(await this.ownsAgent(agent_id))) return txt(`You don't own "${agent_id}".`);

        // Read current registry.json from platform repo
        const registryContent = await readRepoFile(
          org,
          'platform',
          this.env.GITHUB_TOKEN,
          'store/registry.json',
        );
        if (!registryContent) return txt('Could not read store/registry.json from platform repo.');

        let registry: { agents: Array<Record<string, unknown>> };
        try {
          registry = JSON.parse(registryContent);
        } catch {
          return txt('Failed to parse registry.json.');
        }

        // Check if already in registry
        const existingIdx = registry.agents.findIndex((a) => a.id === agent_id);
        const entry = {
          id: agent_id,
          name,
          description,
          icon: icon || '\u{1F916}',
          iconBg: icon_bg || '#7c3aed',
          category,
          storeType: 'agent',
          type: 'agent',
          api: { note: `Autonomous agent — use at freeagentstore.online/a/${agent_id}/` },
          developer: 'FreeAgentStore',
          agentUrl: `https://freeagentstore.online/a/${agent_id}/`,
          noEsm: true,
        };

        if (existingIdx >= 0) {
          registry.agents[existingIdx] = entry;
        } else {
          registry.agents.push(entry);
        }

        // Push updated registry.json
        const map = new Map<string, RepoFile>([
          [
            'store/registry.json',
            { content: textToB64(`${JSON.stringify(registry, null, 2)}\n`), encoding: 'base64' },
          ],
        ]);
        try {
          await pushFiles(
            org,
            'platform',
            this.env.GITHUB_TOKEN,
            map,
            `Add ${agent_id} to store registry via MCP`,
          );
          return txt(
            `Published **${agent_id}** to store registry (${registry.agents.length} total agents). Store will rebuild on next deploy-store workflow run.`,
          );
        } catch (e) {
          return txt(`Failed to update registry: ${String(e)}`);
        }
      },
    );

    // ── platform_guide ─────────────────────────────────────────
    this.server.tool(
      'platform_guide',
      'How to build autonomous browser agents on FreeAgentStore.',
      {},
      async () => {
        return txt(
          [
            '# FreeAgentStore — Autonomous Browser Agents',
            '',
            '## What it is',
            'A store of AI agents that run in the browser. Users open a tab, give the agent a goal,',
            'and it works autonomously — calling tools, reading results, making decisions — until done.',
            '',
            '## Architecture',
            '- Agents are React + Vite apps served from R2 at freeagentstore.online/a/{id}/',
            '- The agent loop runs IN THE BROWSER (not server-side)',
            "- LLM calls go through the platform proxy (/v1/proxy/) which injects the user's API key",
            '- Native tool calling: OpenAI tools, Anthropic tools, Google function_declarations',
            '- Agents can connect to MCP servers for additional tools',
            '',
            '## Platform capabilities',
            '- /v1/proxy/{host}/{path} — AI proxy (OpenAI, Anthropic, Google, Groq, OpenRouter, Together)',
            '- /v1/search?q= — server-side web search',
            '- /v1/fetch?url= — server-side page fetch (CORS bypass)',
            '- /v1/mcp-proxy?server= — MCP proxy for CORS bypass',
            '- /v1/keys — encrypted API key vault (AES-256-GCM)',
            '',
            '## Build via MCP',
            '1. `create_agent` — scaffold from template, repo + route + code',
            '2. `read_file` / `list_files` / `search_files` — inspect',
            '3. `update_files` — customize tools.ts + config.ts',
            '4. `publish_to_store` — add to store registry',
            '',
            '## Key files to customize',
            '- **web/src/tools.ts** — what the agent can DO',
            '- **web/src/config.ts** — name, system prompt, max steps',
            '- Everything else works out of the box',
          ].join('\n'),
        );
      },
    );

    // ── sdk_reference ──────────────────────────────────────────
    this.server.tool(
      'sdk_reference',
      'Reference for agent tools, inference, MCP, search, fetch, and config.',
      {
        feature: z
          .enum([
            'all',
            'tools',
            'inference',
            'mcp',
            'search',
            'config',
            'proxy',
            'keys',
            'kv',
            'rooms',
            'auth',
          ])
          .optional()
          .describe('Feature to look up'),
      },
      async ({ feature }) => {
        const sections: Record<string, string> = {
          tools: `## Agent Tools (web/src/tools.ts)\n\`\`\`ts\nimport type { Tool } from './agent-loop';\n\nexport const AGENT_TOOLS: Tool[] = [\n  {\n    name: 'web_search',\n    description: 'Search the web',\n    parameters: { query: { type: 'string', description: 'Search query' } },\n    execute: async (params) => {\n      const res = await fetch(\`https://freeagentstore.online/v1/search?q=\${encodeURIComponent(String(params.query))}\`);\n      const data = await res.json();\n      return data.results.map(r => \`\${r.title}\\n\${r.url}\\n\${r.snippet}\`).join('\\n\\n');\n    },\n  },\n];\n\`\`\`\nTools use native tool calling (OpenAI tools, Anthropic tools, Google function_declarations).`,
          inference: `## LLM Providers (via /v1/proxy/)\n- OpenAI: gpt-4o-mini, gpt-4o\n- Anthropic: claude-sonnet-4, claude-haiku-4.5\n- Google: gemini-2.0-flash, gemini-2.5-flash\n- Groq: llama-3.3-70b, mixtral-8x7b\n- Ollama: local, text-based fallback\n\nAll use native tool calling. Proxy is transparent.`,
          mcp: `## MCP Client (web/src/mcp-client.ts)\nAgents connect to MCP servers for more tools:\n- User adds server URL via UI\n- Tools auto-discovered (tools/list)\n- Calls via tools/call\n- CORS-blocked servers proxied via /v1/mcp-proxy`,
          search: `## Web Search & Fetch\n\`\`\`ts\n// Search\nfetch('https://freeagentstore.online/v1/search?q=...')\n// -> { results: [{title, url, snippet}], count }\n\n// Fetch page\nfetch('https://freeagentstore.online/v1/fetch?url=...')\n// -> { title, content, length, truncated }\n\`\`\`\nBoth server-side, no CORS issues, no auth required.`,
          config: `## Config (web/src/config.ts)\n\`\`\`ts\nexport const AGENT_CONFIG = {\n  name: 'My Agent',\n  icon: '\\u{1F50D}',\n  description: '...',\n  placeholder: 'e.g. ...',\n  maxSteps: 30,\n  systemPrompt: 'You are...',\n};\n\`\`\``,
          proxy: `## AI Proxy\n/v1/proxy/{host}/{path} — transparent passthrough.\nUser's encrypted API key injected server-side.\nSupports: OpenAI, Anthropic, Google, Groq, OpenRouter, Together.\nRate limit: 100 req/hour/user. Usage logged with cost.`,
          keys: `## Key Vault\nUsers store API keys once at /console/#keys.\nEncrypted AES-256-GCM, stored in D1.\nAgent calls proxy, proxy decrypts + injects.\nBrowser never sees plaintext keys.`,
          kv: `## KV Storage\n\`\`\`ts\nawait agent.kv.set('key', { any: 'json' })\nawait agent.kv.get('key')\nawait agent.kv.delete('key')\n\`\`\`\n1MB/user, per-agent namespace.`,
          rooms: `## Real-time Rooms\n\`\`\`ts\nconst room = agent.rooms.join('room-id')\nroom.onMessage(msg => console.log(msg))\nroom.send({ type: 'data', value: 42 })\n\`\`\`\nWebSocket via Durable Objects. 32 peers/room, 64 rooms/agent.`,
          auth: `## Auth\nGitHub OAuth. Users sign in at freeagentstore.online.\nSession token stored in cookie + localStorage.\nAgents access via SDK: agent.auth.signIn(), agent.auth.user.`,
        };
        const selected =
          feature === 'all' || !feature
            ? Object.values(sections).join('\n\n')
            : (sections[feature] ?? `Unknown: ${feature}`);
        return txt(`# FreeAgentStore Reference\n\n${selected}`);
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
  if (env.OAUTH_KV) {
    const session = await resolveOAuthToken(token, env.OAUTH_KV);
    if (session) token = session;
  }
  // SECURITY: verify the HMAC signature — never trust a decoded uid. Without
  // this, a forged `Bearer base64({"uid":"<victim>"}).x` would set
  // userId=<victim> and pass the ownsAgent gates (update_files / delete_agent /
  // publish_to_store) for any user's agent. Fail closed on bad/expired tokens
  // and when the signing key isn't configured.
  if (!env.SESSION_SIGNING_KEY) return {};
  const claims = await verifySession(token, env.SESSION_SIGNING_KEY);
  if (!claims) return {};
  return { userId: claims.uid, token };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (env.OAUTH_KV && env.SESSION_SIGNING_KEY) {
      const oauthRes = await handleOAuthRoute(request, {
        issuer: `${url.protocol}//${url.host}`,
        fasAuthStart: 'https://freeagentstore.online/v1/auth/github',
        kv: env.OAUTH_KV,
        sessionSigningKey: env.SESSION_SIGNING_KEY,
      });
      if (oauthRes) return oauthRes;
    }

    if (url.pathname === '/' || url.pathname === '') {
      if (isProtocolClient(request)) return wrongEndpoint();
      return new Response(
        [
          'FreeAgentStore MCP Server v0.3.0',
          '',
          'Connect: npx mcp-remote https://mcp.freeagentstore.online/mcp',
          '',
          'Build:    create_agent, update_files, delete_file, search_files, list_files, read_file',
          'Publish:  publish_to_store',
          'Manage:   delete_agent, deploy_status, agent_info, list_agents',
          'Docs:     platform_guide, sdk_reference',
          '',
          'Auth: OAuth 2.1 (automatic via mcp-remote)',
        ].join('\n'),
        { headers: { 'content-type': 'text/plain' } },
      );
    }

    if (url.pathname.startsWith('/mcp')) {
      const auth = await authenticateRequest(request, env);
      const sessionId = request.headers.get('mcp-session-id');
      if (auth.token && sessionId) {
        try {
          const id = env.MCP_OBJECT.idFromName(`streamable-http:${sessionId}`);
          const stub = env.MCP_OBJECT.get(id) as unknown as { setAuth(p: McpProps): Promise<void> };
          await stub.setAuth({ userId: auth.userId, token: auth.token });
        } catch {}
      }
      return FagsMcpAgent.serve('/mcp').fetch(request, env, ctx);
    }

    // Everything else 404s rather than falling through to serve(). On
    // agents@0.0.74 the fallthrough happened to 405, because serve() matches
    // POST-on-basePattern only, and agents>=0.14's default streamable-http
    // handler gates on its own basePattern too — so this was already harmless.
    // But that is library internals, not a contract: `transport: "auto"` in
    // agents>=0.14 dispatches a bare GET to the legacy SSE handler without
    // re-checking the base path. Own the routing here instead.
    return new Response('Not found — the MCP endpoint is /mcp', { status: 404 });
  },
};

/**
 * Is this an MCP protocol client rather than a person in a browser?
 *
 * A client pointed at the origin instead of `/mcp` asks for the event stream
 * with `GET / Accept: text/event-stream` (the legacy SSE transport), or POSTs
 * JSON-RPC. Answering either with 200 and a short non-stream body tells the
 * client "stream opened" and then drops it — and the spec-correct response to a
 * dropped stream is to reconnect, so it redials ~1/sec, forever. The flood is
 * invisible: every response is a 200, nothing throws, no AI tokens are spent,
 * nothing is written to D1, and the MCP rate limiter only counts `tools/call`
 * messages carrying an account, which a bare GET has neither of.
 *
 * OPTIONS and HEAD deliberately return false so CORS preflight is unaffected.
 */
function isProtocolClient(request: Request): boolean {
  if (request.method === 'POST') return true;
  return (request.headers.get('accept') ?? '').includes('text/event-stream');
}

/** The JSON-RPC 405 the MCP spec requires from an endpoint with no stream to offer. */
function wrongEndpoint(): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32000,
        message: 'Method Not Allowed — the MCP endpoint is https://mcp.freeagentstore.online/mcp',
      },
    }),
    { status: 405, headers: { 'content-type': 'application/json', allow: 'GET, HEAD' } },
  );
}
