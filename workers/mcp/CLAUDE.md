# FreeAgentStore MCP — Connection & Conventions

Remote MCP server for FreeAgentStore. 15 tools over streamable-http. Use FAGS through this
server, not by pushing to agent repos or editing `store/registry.json` directly.

## Connect

| Client | Command |
|---|---|
| Claude Code | `claude mcp add --transport http freeagentstore https://mcp.freeagentstore.online/mcp` |
| Codex / Cursor | point at `https://mcp.freeagentstore.online/mcp` (streamable-http) |
| Bridge | `npx mcp-remote https://mcp.freeagentstore.online/mcp` |

Auth: OAuth 2.1 GitHub sign-in through the host worker. The login uses a server-to-server
one-time code exchange; no session token ever appears in a URL.
Read tools work unauthenticated; write tools need an account and ownership of the agent.

## Layout

```
src/index.ts             Worker entry + all 15 tool registrations (McpAgent + McpServer + Zod)
src/safety.ts            Read-only mode, audit log, dry-run, confirmation gates (vendored from FDS/PAGS)
src/oauth-provider.ts    OAuth 2.1 authorization server + dynamic client registration
src/session.ts           HMAC session verification (base64 payload . hex signature, host format)
src/github.ts            GitHub REST helpers (repo files, commits, Actions runs)
src/*.test.ts            Vitest unit tests
server.json              MCP registry manifest
AGENTS.md                Agent behaviour rules + workflow recipes
```

## Conventions

- Success returns `txt(...)`; failures return `errText(...)` which sets `isError: true`.
- Every write tool: `guardWrite()` (read-only gate, audited if blocked) → auth/ownership → optional
  `dry_run` preview → confirm on destructive tools → mutate → `audit()` with `success` or `failed`.
- `delete_file` requires `confirm=<path>`; `delete_agent` requires `confirm=<agent_id>`.
  A dry run needs no confirm.
- The audit `subject` is the caller's `userId`; anonymous calls are not audited.
- Read-only mode: set the `MCP_READ_ONLY=1` var in `wrangler.toml` to freeze all writes.
  `whoami.readOnly` reflects it.
- Tool list is declared in three places — keep `src/index.ts`, `server.json`, and the landing
  banner in `src/index.ts` (`/` route) in sync. The root `README.md`, `store/llms.txt`, and
  `store/SKILLS.md` + `store/skills.md` list the tools too.
- No cross-store npm dependencies. `safety.ts` is a vendored copy; port fixes by hand.

## Secrets (wrangler)

`SESSION_SIGNING_KEY` (shared with the host worker), `GITHUB_TOKEN` (fine-grained PAT for the
FreeAgentStore org). See `wrangler.toml`.

## Develop

```bash
npm run dev        # wrangler dev
npm run typecheck  # tsc --noEmit
npm test           # vitest run
```

Deploys happen from `.github/workflows/deploy-mcp.yml` on push to `main`. Do not run
`wrangler deploy` by hand.
