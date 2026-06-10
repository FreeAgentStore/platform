/**
 * MCP client for browser agents.
 *
 * Connects to MCP servers via Streamable HTTP transport,
 * discovers tools, and executes them. Works with:
 * - Direct HTTP MCP servers (if CORS allows)
 * - Platform MCP proxy (/v1/mcp-proxy?server=...) for CORS-blocked servers
 * - Local MCP servers via mcp-remote bridge on localhost
 */

import type { Tool } from './agent-loop';

const MCP_PROXY = 'https://freeagentstore.online/v1/mcp-proxy';

export interface McpServer {
  /** User-facing label */
  name: string;
  /** MCP server URL (e.g. https://mcp.example.com/mcp) */
  url: string;
  /** Use the platform proxy to bypass CORS (default: auto-detect) */
  useProxy?: boolean;
}

export interface McpToolDef {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description?: string }>;
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

/** Send a JSON-RPC request to an MCP server */
async function mcpRequest(
  serverUrl: string,
  method: string,
  params?: unknown,
  useProxy?: boolean,
): Promise<unknown> {
  const id = ++requestId;
  const body = JSON.stringify({ jsonrpc: '2.0', id, method, params: params ?? {} });

  // Try direct first, fall back to proxy on CORS error
  const tryFetch = async (url: string): Promise<McpResponse> => {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`MCP server error ${res.status}: ${text.slice(0, 200)}`);
    }
    return await res.json() as McpResponse;
  };

  let response: McpResponse;

  if (useProxy === true) {
    // Force proxy
    const proxyUrl = `${MCP_PROXY}?server=${encodeURIComponent(serverUrl)}`;
    response = await tryFetch(proxyUrl);
  } else if (useProxy === false) {
    // Force direct
    response = await tryFetch(serverUrl);
  } else {
    // Auto: try direct, fall back to proxy
    try {
      response = await tryFetch(serverUrl);
    } catch (err: any) {
      if (err.message?.includes('Failed to fetch') || err.message?.includes('CORS') || err.message?.includes('NetworkError')) {
        const proxyUrl = `${MCP_PROXY}?server=${encodeURIComponent(serverUrl)}`;
        response = await tryFetch(proxyUrl);
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

/** Initialize connection — send initialize + initialized */
async function initializeServer(serverUrl: string, useProxy?: boolean): Promise<void> {
  await mcpRequest(serverUrl, 'initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'FreeAgentStore', version: '1.0.0' },
  }, useProxy);

  // Send initialized notification (no response expected, but send as request for HTTP transport)
  try {
    await mcpRequest(serverUrl, 'notifications/initialized', {}, useProxy);
  } catch {
    // Some servers don't respond to notifications — that's fine
  }
}

/** Discover tools from an MCP server */
export async function discoverTools(server: McpServer): Promise<McpToolDef[]> {
  await initializeServer(server.url, server.useProxy);

  const result = await mcpRequest(server.url, 'tools/list', {}, server.useProxy) as {
    tools: McpToolDef[];
  };

  return result.tools ?? [];
}

/** Call a tool on an MCP server */
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
    content: Array<{ type: string; text?: string }>;
    isError?: boolean;
  };

  if (result.isError) {
    const text = result.content?.map((c) => c.text).filter(Boolean).join('\n') ?? 'Unknown MCP error';
    throw new Error(text);
  }

  return result.content
    ?.map((c) => c.text ?? '')
    .filter(Boolean)
    .join('\n') || 'OK';
}

/** Convert MCP tool definitions to agent Tool objects */
export function mcpToolsToAgentTools(server: McpServer, mcpTools: McpToolDef[]): Tool[] {
  return mcpTools.map((t) => ({
    name: t.name,
    description: `[MCP: ${server.name}] ${t.description ?? ''}`,
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
  }));
}

/** Test if an MCP server is reachable */
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
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveServers(servers: McpServer[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(servers));
}
