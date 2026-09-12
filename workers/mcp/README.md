# FreeAgentStore MCP Server

A Cloudflare Worker exposing FreeAgentStore as 15 MCP tools: browse the store, scaffold and
edit browser-based AI agents in their GitHub repos, publish them, and read the platform docs.

- **Endpoint:** `https://mcp.freeagentstore.online/mcp` (streamable-http)
- **Manifest:** [`server.json`](./server.json)
- **Auth:** OAuth 2.1 (GitHub sign-in via the host worker)

## Connect

```bash
# Claude Code
claude mcp add --transport http freeagentstore https://mcp.freeagentstore.online/mcp

# Any client via the reference bridge
npx mcp-remote https://mcp.freeagentstore.online/mcp
```

Project-local `.mcp.json`:

```json
{ "mcpServers": { "freeagentstore": { "type": "http", "url": "https://mcp.freeagentstore.online/mcp" } } }
```

## Tools

| Category | Tools |
|---|---|
| Build | `create_agent`, `update_files`, `delete_file`, `search_files`, `list_files`, `read_file` |
| Publish | `publish_to_store` |
| Manage | `delete_agent`, `deploy_status`, `agent_info`, `list_agents` |
| Account | `whoami`, `mcp_audit_log` |
| Docs | `platform_guide`, `sdk_reference` |

Every write tool accepts `dry_run: true` to validate without committing. `delete_file` additionally
requires `confirm=<path>` and `delete_agent` requires `confirm=<agent_id>`. Failed calls return
`isError: true`.

## Safety layer (`src/safety.ts`)

Vendored and simplified from the FDS/PAGS MCP servers. FAGS gates writes by D1 ownership inside
each tool, so this layer adds the orthogonal maturity primitives:

- **Read-only mode** — deploy with `MCP_READ_ONLY=1` to disable all write tools.
- **Audit log** — every write/dry-run/blocked/failed action → `OAUTH_KV`, 90-day TTL, secrets redacted; read via `mcp_audit_log`.
- **Dry-run** — preview any mutation without side effects.
- **Confirmation gates** — destructive tools require an explicit `confirm` token.

## Architecture

Cloudflare Worker + SQLite Durable Object (`agents` SDK `McpAgent`). Agent routes and ownership
live in D1 (`fags`); agent source lives in one GitHub repo per agent under the FreeAgentStore org;
OAuth state and audit events live in `OAUTH_KV`.

See [AGENTS.md](./AGENTS.md) for the agent workflow and [CLAUDE.md](./CLAUDE.md) for conventions.

## Develop

```bash
npm run dev        # wrangler dev
npm run typecheck  # tsc --noEmit
npm test           # vitest run
```

Deploys run from `.github/workflows/deploy-mcp.yml` on push to `main`.
