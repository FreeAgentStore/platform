import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  loadServers,
  saveServers,
  mcpToolsToAgentTools,
  discoverTools,
  callTool,
  testConnection,
  resetInitCache,
} from './mcp-client';
import type { McpServer, McpToolDef } from './mcp-client';

// ── Stubs ────────────────────────────────────────────────────

let storage: Record<string, string>;

beforeEach(() => {
  storage = {};
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => storage[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { storage[key] = value; }),
    removeItem: vi.fn((key: string) => { delete storage[key]; }),
  });
  // Reset the init cache before each test
  resetInitCache();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const testServer: McpServer = { name: 'Test Server', url: 'https://mcp.example.com/mcp' };

function mockFetchJsonRpc(result: unknown, error?: { code: number; message: string }) {
  return vi.fn().mockResolvedValue({
    ok: true,
    headers: { get: () => 'application/json' },
    json: async () => ({
      jsonrpc: '2.0',
      id: 1,
      ...(error ? { error } : { result }),
    }),
  });
}

// ── loadServers / saveServers ────────────────────────────────

describe('loadServers', () => {
  it('returns empty array when nothing stored', () => {
    expect(loadServers()).toEqual([]);
  });

  it('returns empty array for invalid JSON', () => {
    storage['fags_mcp_servers'] = '{not valid json';
    expect(loadServers()).toEqual([]);
  });

  it('returns empty array for non-array JSON', () => {
    storage['fags_mcp_servers'] = '{"name":"foo"}';
    expect(loadServers()).toEqual([]);
  });

  it('filters out entries missing name or url', () => {
    storage['fags_mcp_servers'] = JSON.stringify([
      { name: 'Good', url: 'https://a.com' },
      { name: 'Missing URL' },
      { url: 'https://no-name.com' },
      null,
      42,
      { name: 'Also Good', url: 'https://b.com', useProxy: true },
    ]);
    const servers = loadServers();
    expect(servers).toHaveLength(2);
    expect(servers[0].name).toBe('Good');
    expect(servers[1].name).toBe('Also Good');
    expect(servers[1].useProxy).toBe(true);
  });
});

describe('saveServers', () => {
  it('persists servers to localStorage', () => {
    const servers: McpServer[] = [
      { name: 'A', url: 'https://a.com' },
      { name: 'B', url: 'https://b.com', useProxy: true },
    ];
    saveServers(servers);
    expect(localStorage.setItem).toHaveBeenCalledWith('fags_mcp_servers', JSON.stringify(servers));
  });
});

describe('loadServers + saveServers round-trip', () => {
  it('round-trips correctly', () => {
    const servers: McpServer[] = [
      { name: 'Test', url: 'https://test.com/mcp' },
      { name: 'Proxied', url: 'https://other.com', useProxy: true },
    ];
    saveServers(servers);
    // Simulate what localStorage.getItem returns after setItem
    storage['fags_mcp_servers'] = JSON.stringify(servers);
    const loaded = loadServers();
    expect(loaded).toEqual(servers);
  });
});

// ── mcpToolsToAgentTools ─────────────────────────────────────

describe('mcpToolsToAgentTools', () => {
  const mcpTools: McpToolDef[] = [
    {
      name: 'read_file',
      description: 'Read a file from disk',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path' },
          encoding: { type: 'string', description: 'Encoding' },
        },
        required: ['path'],
      },
    },
    {
      name: 'write_file',
      description: 'Write a file to disk',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path' },
          content: { type: 'string', description: 'File content' },
        },
        required: ['path', 'content'],
      },
    },
  ];

  it('prefixes tool names with mcp_{server_name}_{tool_name}', () => {
    const agentTools = mcpToolsToAgentTools(testServer, mcpTools);
    expect(agentTools[0].name).toBe('mcp_test_server_read_file');
    expect(agentTools[1].name).toBe('mcp_test_server_write_file');
  });

  it('sanitizes server name for prefix (non-word chars become _)', () => {
    const server: McpServer = { name: 'My Cool Server!@#', url: 'https://x.com' };
    const agentTools = mcpToolsToAgentTools(server, [mcpTools[0]]);
    // \W+ replaces consecutive non-word chars with a single _, so "!@#" -> "_"
    expect(agentTools[0].name).toBe('mcp_my_cool_server__read_file');
  });

  it('adds [MCP: server] prefix to description', () => {
    const agentTools = mcpToolsToAgentTools(testServer, mcpTools);
    expect(agentTools[0].description).toBe('[MCP: Test Server] Read a file from disk');
  });

  it('uses tool name as fallback description when description is missing', () => {
    const toolsWithoutDesc: McpToolDef[] = [{ name: 'ping' }];
    const agentTools = mcpToolsToAgentTools(testServer, toolsWithoutDesc);
    expect(agentTools[0].description).toBe('[MCP: Test Server] ping');
  });

  it('converts inputSchema properties to agent tool parameters', () => {
    const agentTools = mcpToolsToAgentTools(testServer, mcpTools);
    const params = agentTools[0].parameters;
    expect(params.path.type).toBe('string');
    expect(params.path.description).toBe('File path');
    expect(params.path.required).toBe(true);
    expect(params.encoding.type).toBe('string');
    expect(params.encoding.required).toBe(false);
  });

  it('handles missing inputSchema gracefully', () => {
    const toolsNoSchema: McpToolDef[] = [{ name: 'ping' }];
    const agentTools = mcpToolsToAgentTools(testServer, toolsNoSchema);
    expect(Object.keys(agentTools[0].parameters)).toHaveLength(0);
  });

  it('handles missing property type and description', () => {
    const toolsMinimal: McpToolDef[] = [{
      name: 'test',
      inputSchema: {
        type: 'object',
        properties: { foo: {} },
      },
    }];
    const agentTools = mcpToolsToAgentTools(testServer, toolsMinimal);
    expect(agentTools[0].parameters.foo.type).toBe('string'); // defaults to string
    expect(agentTools[0].parameters.foo.description).toBe('foo'); // defaults to key name
  });

  it('execute function calls callTool with the original tool name', async () => {
    const fetchMock = mockFetchJsonRpc({ content: [{ type: 'text', text: 'file contents' }] });
    vi.stubGlobal('fetch', fetchMock);

    const agentTools = mcpToolsToAgentTools(testServer, mcpTools);
    const result = await agentTools[0].execute({ path: '/tmp/test' });

    expect(result).toBe('file contents');
    // The call to the MCP server should use the original name, not the prefixed one
    const callBody = JSON.parse(fetchMock.mock.calls[fetchMock.mock.calls.length - 1][1].body);
    expect(callBody.method).toBe('tools/call');
    expect(callBody.params.name).toBe('read_file');
  });
});

// ── discoverTools ────────────────────────────────────────────

describe('discoverTools', () => {
  it('sends initialize then tools/list requests', async () => {
    const fetchMock = vi.fn()
      // initialize call
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: { protocolVersion: '2025-03-26', capabilities: {} },
        }),
      })
      // notifications/initialized — may fail, that's ok
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ jsonrpc: '2.0', id: 2, result: {} }),
      })
      // tools/list
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({
          jsonrpc: '2.0',
          id: 3,
          result: {
            tools: [
              { name: 'search', description: 'Search tool' },
              { name: 'calculate', description: 'Calculator' },
            ],
          },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const tools = await discoverTools(testServer);

    expect(tools).toHaveLength(2);
    expect(tools[0].name).toBe('search');
    expect(tools[1].name).toBe('calculate');

    // Check JSON-RPC format of the first call (initialize)
    const initBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(initBody.jsonrpc).toBe('2.0');
    expect(initBody.method).toBe('initialize');
    expect(initBody.params.protocolVersion).toBe('2025-03-26');
    expect(initBody.params.clientInfo.name).toBe('FreeAgentStore');
  });

  it('caches initialization — second call skips initialize', async () => {
    const fetchMock = vi.fn()
      // initialize
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ jsonrpc: '2.0', id: 1, result: {} }),
      })
      // notifications/initialized
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ jsonrpc: '2.0', id: 2, result: {} }),
      })
      // tools/list (first)
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ jsonrpc: '2.0', id: 3, result: { tools: [{ name: 'a' }] } }),
      })
      // tools/list (second, no initialize this time)
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ jsonrpc: '2.0', id: 4, result: { tools: [{ name: 'b' }] } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    await discoverTools(testServer);
    const tools2 = await discoverTools(testServer);

    expect(tools2[0].name).toBe('b');
    // 3 calls for first discover (init + notify + list), 1 for second (just list)
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('returns empty array when result has no tools', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ jsonrpc: '2.0', id: 1, result: {} }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ jsonrpc: '2.0', id: 2, result: {} }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ jsonrpc: '2.0', id: 3, result: {} }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const tools = await discoverTools(testServer);
    expect(tools).toEqual([]);
  });
});

// ── callTool ─────────────────────────────────────────────────

describe('callTool', () => {
  it('sends tools/call with correct params and returns text', async () => {
    const fetchMock = mockFetchJsonRpc({
      content: [
        { type: 'text', text: 'Line 1' },
        { type: 'text', text: 'Line 2' },
      ],
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await callTool('https://mcp.example.com', 'search', { query: 'test' });

    expect(result).toBe('Line 1\nLine 2');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.method).toBe('tools/call');
    expect(body.params.name).toBe('search');
    expect(body.params.arguments).toEqual({ query: 'test' });
  });

  it('returns "OK" when content is empty', async () => {
    const fetchMock = mockFetchJsonRpc({ content: [] });
    vi.stubGlobal('fetch', fetchMock);

    const result = await callTool('https://mcp.example.com', 'noop', {});
    expect(result).toBe('OK');
  });

  it('throws on isError response', async () => {
    const fetchMock = mockFetchJsonRpc({
      isError: true,
      content: [{ type: 'text', text: 'Permission denied' }],
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(callTool('https://mcp.example.com', 'delete', {})).rejects.toThrow('Permission denied');
  });

  it('throws on isError with empty content — fallback uses "Unknown MCP error" only when content is nullish', async () => {
    // When content is an empty array, map+filter+join produces '' which is falsy
    // but `??` only triggers on null/undefined, so the error message is ''
    const fetchMock = mockFetchJsonRpc({
      isError: true,
      content: [],
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(callTool('https://mcp.example.com', 'fail', {})).rejects.toThrow('');

    // When content is undefined/null, ?? triggers and uses 'Unknown MCP error'
    const fetchMock2 = mockFetchJsonRpc({
      isError: true,
    });
    vi.stubGlobal('fetch', fetchMock2);

    await expect(callTool('https://mcp.example.com', 'fail', {})).rejects.toThrow('Unknown MCP error');
  });

  it('throws on JSON-RPC error response', async () => {
    const fetchMock = mockFetchJsonRpc(undefined, { code: -32601, message: 'Method not found' });
    vi.stubGlobal('fetch', fetchMock);

    await expect(callTool('https://mcp.example.com', 'missing', {})).rejects.toThrow('MCP error: Method not found (-32601)');
  });

  it('throws on HTTP error response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    }));

    await expect(callTool('https://mcp.example.com', 'search', {})).rejects.toThrow('MCP 500');
  });

  it('uses useProxy=true to route through proxy', async () => {
    const fetchMock = mockFetchJsonRpc({ content: [{ type: 'text', text: 'proxied' }] });
    vi.stubGlobal('fetch', fetchMock);

    await callTool('https://mcp.example.com', 'search', {}, true);

    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain('freeagentstore.online/v1/mcp-proxy');
    expect(calledUrl).toContain(encodeURIComponent('https://mcp.example.com'));
  });

  it('uses direct URL when useProxy=false', async () => {
    const fetchMock = mockFetchJsonRpc({ content: [{ type: 'text', text: 'direct' }] });
    vi.stubGlobal('fetch', fetchMock);

    await callTool('https://mcp.example.com', 'search', {}, false);

    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toBe('https://mcp.example.com');
  });
});

// ── Auto-proxy fallback ──────────────────────────────────────

describe('auto-proxy fallback', () => {
  it('falls back to proxy on TypeError (CORS/network error)', async () => {
    const fetchMock = vi.fn()
      // Direct call fails with TypeError (CORS)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      // Proxy call succeeds
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: { content: [{ type: 'text', text: 'via proxy' }] },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    // useProxy = undefined triggers auto mode
    const result = await callTool('https://mcp.example.com', 'search', { q: 'test' }, undefined);

    expect(result).toBe('via proxy');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // First call is direct
    expect(fetchMock.mock.calls[0][0]).toBe('https://mcp.example.com');
    // Second call is via proxy
    expect(fetchMock.mock.calls[1][0]).toContain('freeagentstore.online/v1/mcp-proxy');
  });

  it('does not fall back on non-network errors', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(callTool('https://mcp.example.com', 'search', {}, undefined)).rejects.toThrow('MCP 401');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// ── testConnection ───────────────────────────────────────────

describe('testConnection', () => {
  it('returns ok:true with tool count on success', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ jsonrpc: '2.0', id: 1, result: {} }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ jsonrpc: '2.0', id: 2, result: {} }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({
          jsonrpc: '2.0',
          id: 3,
          result: { tools: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await testConnection(testServer);
    expect(result.ok).toBe(true);
    expect(result.toolCount).toBe(3);
    expect(result.error).toBeUndefined();
  });

  it('returns ok:false with error on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')));

    const result = await testConnection(testServer);
    expect(result.ok).toBe(false);
    expect(result.toolCount).toBe(0);
    expect(result.error).toBe('Connection refused');
  });
});

// ── resetInitCache ───────────────────────────────────────────

describe('resetInitCache', () => {
  it('forces re-initialization after reset', async () => {
    const fetchMock = vi.fn()
      // First discover: init + notify + list
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ jsonrpc: '2.0', id: 1, result: {} }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ jsonrpc: '2.0', id: 2, result: {} }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ jsonrpc: '2.0', id: 3, result: { tools: [] } }),
      })
      // After resetInitCache: init + notify + list again
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ jsonrpc: '2.0', id: 4, result: {} }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ jsonrpc: '2.0', id: 5, result: {} }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ jsonrpc: '2.0', id: 6, result: { tools: [{ name: 'x' }] } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    await discoverTools(testServer);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    resetInitCache();

    const tools = await discoverTools(testServer);
    // Should have re-initialized, so total 6 calls
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(tools[0].name).toBe('x');
  });
});

// ── Non-JSON response handling ───────────────────────────────

describe('non-JSON response handling', () => {
  it('throws when MCP server returns non-JSON content type', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'text/html' },
      text: async () => '<html>Not an MCP server</html>',
    }));

    await expect(callTool('https://mcp.example.com', 'search', {})).rejects.toThrow('non-JSON');
  });
});

// ── Content joining behavior ─────────────────────────────────

describe('callTool content joining', () => {
  it('skips empty text entries', async () => {
    const fetchMock = mockFetchJsonRpc({
      content: [
        { type: 'text', text: 'Hello' },
        { type: 'text', text: '' },
        { type: 'text', text: 'World' },
      ],
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await callTool('https://mcp.example.com', 'test', {});
    expect(result).toBe('Hello\nWorld');
  });

  it('handles content entries without text field', async () => {
    const fetchMock = mockFetchJsonRpc({
      content: [
        { type: 'image', data: 'base64...' },
        { type: 'text', text: 'Caption' },
      ],
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await callTool('https://mcp.example.com', 'test', {});
    expect(result).toBe('Caption');
  });
});
