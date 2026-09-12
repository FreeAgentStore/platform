# FreeAgentStore MCP — Agent Guide

AI agent tools for FreeAgentStore, the store of AI agents that run in the browser. Use this
MCP server to browse, build, and publish agents — do not push to agent repos directly or edit
`store/registry.json` by hand.

Endpoint: `https://mcp.freeagentstore.online/mcp` (streamable-http)
Auth: OAuth 2.1 (GitHub sign-in, automatic via `mcp-remote` or any OAuth-capable client)

## Rules

1. Inspect first. Call `platform_guide`, then `agent_info` / `list_files` / `read_file` on an
   existing agent before creating or changing anything.
2. Prefer read-only tools. Only call a write tool when the task explicitly requires a change.
3. Preview mutations. Every write tool accepts `dry_run: true` — use it to validate before committing.
4. Confirm destructive actions. `delete_file` requires `confirm=<path>`; `delete_agent` requires
   `confirm=<agent_id>`. Neither can be undone. A dry run needs no confirm.
5. Respect ownership. Write tools only act on agents owned by the authenticated account.
6. Send whole files. `update_files` overwrites each listed path with the full content you supply.
7. Everything published is MIT. Only publish code the owner can release under the MIT license.

## Capabilities

| Level | Tools | Requires |
|---|---|---|
| Read (open) | `agent_info`, `deploy_status`, `list_files`, `read_file`, `search_files`, `platform_guide`, `sdk_reference`, `whoami` | nothing |
| Read (account) | `list_agents` (yours when signed in), `mcp_audit_log` | authenticated account |
| Write (owner) | `create_agent`, `update_files`, `delete_file`, `delete_agent`, `publish_to_store` | account + ownership |

## Workflow recipes

**Browse:** `list_agents` → `agent_info` → `list_files` → `read_file`.

**Create:** `platform_guide` → `sdk_reference` (`section: "tools"`) → `create_agent` with
`dry_run: true` → re-run without `dry_run` → `deploy_status` until the run succeeds.

**Edit:** `search_files` / `read_file` → `update_files` with `dry_run: true` → re-run without
`dry_run` → `deploy_status`. The agent redeploys in about 30 to 60 seconds.

**Publish:** `agent_info` (confirm it is live) → `publish_to_store` with `dry_run: true` → re-run
without `dry_run`. The store rebuilds and the agent appears on freeagentstore.online.

**Audit your actions:** `mcp_audit_log` — every write, dry-run, blocked, and failed action for
your account, newest first.

## Safety

- **Read-only mode:** when the server is deployed with `MCP_READ_ONLY=1`, every write tool
  returns an error and the attempt is audited. `whoami.readOnly` reports the current state.
- **Audit trail:** each write/dry-run/blocked/failed action is logged to KV for 90 days, keyed to
  your account, with credential-shaped values redacted. Read it back with `mcp_audit_log`.
- **Failure signalling:** failed tool calls return `isError: true` — check it rather than parsing text.
- **Ownership:** an account may only mutate agents it created. There is no admin override via MCP.

## Not supported via MCP

Cloudflare provisioning (DNS, Pages projects), API key management (`/v1/keys` in the browser),
account deletion, and bulk operations across many agents.
