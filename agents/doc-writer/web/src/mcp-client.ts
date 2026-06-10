/**
 * MCP client for browser agents.
 *
 * Connects to MCP servers via Streamable HTTP transport,
 * discovers tools, and executes them.
 */

import type { Tool } from './agent-loop';

const MCP_PROXY = 'https://freeagentstore.online/v1/mcp-proxy';
const MCP_TIMEOUT = 30_000;

export interface McpServer {
  name: string;
  url: string;
  useProxy?: boolean;
}

export interface McpToolDef {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, { type?: string; description?: string }>;
    required?: string[];
  };
}

interface McpResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

let requestId = 0;

// Cache initialized servers to avoid re-initializing on every tool call
const initializedServers = new Set<string>();

async function mcpRequest(
  serverUrl: string,
  method: string,
  params?: unknown,
  useProxy?: boolean,
): Promise<unknown> {
  const id = ++requestId;
  const body = JSON.stringify({ jsonrpc: '2.0', id, method, params: params ?? {} });

  const tryFetch = async (url: string): Promise<McpResponse> => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body,
      signal: AbortSignal.timeout(MCP_TIMEOUT),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`MCP ${res.status}: ${text.slice(0, 200)}`);
    }
    const contentType = res.headers.get('Content-Type') ?? '';
    if (!contentType.includes('json')) {
      const text = await res.text().catch(() => '');
      throw new Error(`MCP returned non-JSON (${contentType}): ${text.slice(0, 100)}`);
    }
    return await res.json() as McpResponse;
  };

  let response: McpResponse;

  if (useProxy === true) {
    response = await tryFetch(`${MCP_PROXY}?server=${encodeURIComponent(serverUrl)}`);
  } else if (useProxy === false) {
    response = await tryFetch(serverUrl);
  } else {
    // Auto: try direct, fall back to proxy on network errors
    try {
      response = await tryFetch(serverUrl);
    } catch (err: any) {
      const isNetworkError = err instanceof TypeError || err.name === 'TypeError'
        || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError');
      if (isNetworkError) {
        response = await tryFetch(`${MCP_PROXY}?server=${encodeURIComponent(serverUrl)}`);
      } else {
        throw err;
      }
    }
  }

  if (response.error) {
    throw new Error(`MCP error: ${response.error.message} (${response.error.code})`);
  }

  return response.result;
}

async function ensureInitialized(serverUrl: string, useProxy?: boolean): Promise<void> {
  if (initializedServers.has(serverUrl)) return;

  await mcpRequest(serverUrl, 'initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'FreeAgentStore', version: '1.0.0' },
  }, useProxy);

  try {
    await mcpRequest(serverUrl, 'notifications/initialized', {}, useProxy);
  } catch {
    // Notifications may not get a response — fine
  }

  initializedServers.add(serverUrl);
}

export async function discoverTools(server: McpServer): Promise<McpToolDef[]> {
  await ensureInitialized(server.url, server.useProxy);

  const result = await mcpRequest(server.url, 'tools/list', {}, server.useProxy) as {
    tools?: McpToolDef[];
  };

  return result?.tools ?? [];
}

export async function callTool(
  serverUrl: string,
  toolName: string,
  args: Record<string, unknown>,
  useProxy?: boolean,
): Promise<string> {
  const result = await mcpRequest(serverUrl, 'tools/call', {
    name: toolName,
    arguments: args,
  }, useProxy) as {
    content?: Array<{ type: string; text?: string }>;
    isError?: boolean;
  };

  if (result?.isError) {
    const text = result.content?.map((c) => c.text).filter(Boolean).join('\n') ?? 'Unknown MCP error';
    throw new Error(text);
  }

  return (result?.content ?? [])
    .map((c) => c.text ?? '')
    .filter(Boolean)
    .join('\n') || 'OK';
}

export function mcpToolsToAgentTools(server: McpServer, mcpTools: McpToolDef[]): Tool[] {
  return mcpTools.map((t) => {
    // Prefix MCP tool names to avoid collisions with local tools
    const prefixedName = `mcp_${server.name.replace(/\W+/g, '_').toLowerCase()}_${t.name}`;

    return {
      name: prefixedName,
      description: `[MCP: ${server.name}] ${t.description ?? t.name}`,
      parameters: Object.fromEntries(
        Object.entries(t.inputSchema?.properties ?? {}).map(([k, v]) => [
          k,
          {
            type: v.type ?? 'string',
            description: v.description ?? k,
            required: t.inputSchema?.required?.includes(k) ?? false,
          },
        ]),
      ),
      execute: async (params: Record<string, unknown>) => {
        return callTool(server.url, t.name, params, server.useProxy);
      },
    };
  });
}

export async function testConnection(server: McpServer): Promise<{
  ok: boolean;
  toolCount: number;
  error?: string;
}> {
  try {
    const tools = await discoverTools(server);
    return { ok: true, toolCount: tools.length };
  } catch (err: any) {
    return { ok: false, toolCount: 0, error: err.message };
  }
}

// ── Persistence ─────────────────────────────────────────────

const STORAGE_KEY = 'fags_mcp_servers';

export function loadServers(): McpServer[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Validate each entry has name + url
    return parsed.filter((s: unknown): s is McpServer =>
      typeof s === 'object' && s !== null && typeof (s as any).name === 'string' && typeof (s as any).url === 'string'
    );
  } catch {
    return [];
  }
}

export function saveServers(servers: McpServer[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(servers));
}

/** Reset initialization cache (e.g. after reconnect) */
export function resetInitCache(): void {
  initializedServers.clear();
}
