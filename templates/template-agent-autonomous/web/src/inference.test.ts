import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createLLM, detectProvider, PROVIDERS } from './inference';
import type { LLMFn, Message, ToolDef } from './inference';

// ── Stubs ────────────────────────────────────────────────────

const fakeSession = 'test-session-token';

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => {
      if (key === 'fags_session') return JSON.stringify({ token: fakeSession });
      return null;
    }),
    setItem: vi.fn(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const sampleTools: ToolDef[] = [
  {
    name: 'search',
    description: 'Search the web',
    parameters: {
      query: { type: 'string', description: 'Search query', required: true },
      limit: { type: 'number', description: 'Max results', required: false },
    },
  },
];

const systemMsg: Message = { role: 'system', content: 'You are a helpful agent.' };
const userMsg: Message = { role: 'user', content: 'Find info about vitest.' };
const messages: Message[] = [systemMsg, userMsg];

// ── PROVIDERS constant ───────────────────────────────────────

describe('PROVIDERS', () => {
  it('has at least 5 providers', () => {
    expect(PROVIDERS.length).toBeGreaterThanOrEqual(5);
  });

  it('each provider has id, name, models array', () => {
    for (const p of PROVIDERS) {
      expect(p.id).toBeTypeOf('string');
      expect(p.name).toBeTypeOf('string');
      expect(Array.isArray(p.models)).toBe(true);
      expect(p.models.length).toBeGreaterThan(0);
    }
  });

  it('includes openai, anthropic, google, groq, ollama, built-in-ai', () => {
    const ids = PROVIDERS.map((p) => p.id);
    expect(ids).toContain('openai');
    expect(ids).toContain('anthropic');
    expect(ids).toContain('google');
    expect(ids).toContain('groq');
    expect(ids).toContain('ollama');
    expect(ids).toContain('built-in-ai');
  });

  it('marks built-in-ai as not capable (no tool calling)', () => {
    const chromeAI = PROVIDERS.find((p) => p.id === 'built-in-ai');
    expect(chromeAI?.capable).toBe(false);
  });

  it('marks cloud providers as capable', () => {
    for (const id of ['openai', 'anthropic', 'google', 'groq']) {
      const p = PROVIDERS.find((pr) => pr.id === id);
      expect(p?.capable).toBe(true);
    }
  });
});

// ── createLLM — built-in-ai rejection ────────────────────────

describe('createLLM', () => {
  it('throws for built-in-ai provider (no tool calling support)', async () => {
    const llm = createLLM({ provider: 'built-in-ai', model: 'gemini-nano' });
    await expect(llm(messages, sampleTools)).rejects.toThrow('Chrome Nano does not support tool calling');
  });
});

// ── OpenAI format: request body + response parsing ───────────

describe('OpenAI format (via createLLM)', () => {
  it('sends correct request body for OpenAI provider', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Hello', tool_calls: [] }, finish_reason: 'stop' }],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const llm = createLLM({ provider: 'openai', model: 'gpt-4o-mini', temperature: 0.5 });
    await llm(messages, sampleTools);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('api.openai.com/v1/chat/completions');
    expect(opts.method).toBe('POST');
    expect(opts.headers.Authorization).toBe(`Bearer ${fakeSession}`);

    const body = JSON.parse(opts.body);
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.temperature).toBe(0.5);
    expect(body.tools).toHaveLength(1);
    expect(body.tools[0].type).toBe('function');
    expect(body.tools[0].function.name).toBe('search');
    expect(body.tools[0].function.parameters.properties.query.type).toBe('string');
    expect(body.tools[0].function.parameters.required).toContain('query');
    // "limit" has required: false, should not be in required array
    expect(body.tools[0].function.parameters.required).not.toContain('limit');
  });

  it('parses OpenAI response with no tool calls', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'The answer is 42.', tool_calls: undefined }, finish_reason: 'stop' }],
      }),
    }));

    const llm = createLLM({ provider: 'openai', model: 'gpt-4o-mini' });
    const result = await llm(messages, []);

    expect(result.text).toBe('The answer is 42.');
    expect(result.toolCalls).toHaveLength(0);
    expect(result.stopReason).toBe('end');
  });

  it('parses OpenAI response with tool calls', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: null,
            tool_calls: [{
              id: 'call_123',
              type: 'function',
              function: { name: 'search', arguments: '{"query":"vitest","limit":5}' },
            }],
          },
          finish_reason: 'tool_calls',
        }],
      }),
    }));

    const llm = createLLM({ provider: 'openai', model: 'gpt-4o-mini' });
    const result = await llm(messages, sampleTools);

    expect(result.text).toBeNull();
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe('search');
    expect(result.toolCalls[0].input).toEqual({ query: 'vitest', limit: 5 });
    expect(result.stopReason).toBe('tool_use');
  });

  it('handles malformed JSON in tool call arguments', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: 'oops',
            tool_calls: [{
              id: 'call_bad',
              type: 'function',
              function: { name: 'search', arguments: '{broken json!!!' },
            }],
          },
          finish_reason: 'tool_calls',
        }],
      }),
    }));

    const llm = createLLM({ provider: 'openai', model: 'gpt-4o-mini' });
    const result = await llm(messages, sampleTools);

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe('search');
    // Malformed JSON should be stored as _raw
    expect(result.toolCalls[0].input._raw).toBe('{broken json!!!');
  });
});

// ── Anthropic format ─────────────────────────────────────────

describe('Anthropic format (via createLLM)', () => {
  it('sends correct request body for Anthropic provider', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'Hello from Claude.' }],
        stop_reason: 'end_turn',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const llm = createLLM({ provider: 'anthropic', model: 'claude-sonnet-4-20250514' });
    await llm(messages, sampleTools);

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('api.anthropic.com/v1/messages');

    const body = JSON.parse(opts.body);
    expect(body.model).toBe('claude-sonnet-4-20250514');
    expect(body.max_tokens).toBe(4096);
    expect(body.system).toBe('You are a helpful agent.');
    // Anthropic messages should not include the system message
    expect(body.messages.every((m: any) => m.role !== 'system')).toBe(true);
    expect(body.tools).toHaveLength(1);
    expect(body.tools[0].name).toBe('search');
    expect(body.tools[0].input_schema.properties.query.type).toBe('string');
  });

  it('parses Anthropic text response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'Hello from Claude.' }],
        stop_reason: 'end_turn',
      }),
    }));

    const llm = createLLM({ provider: 'anthropic', model: 'claude-sonnet-4-20250514' });
    const result = await llm(messages, []);

    expect(result.text).toBe('Hello from Claude.');
    expect(result.toolCalls).toHaveLength(0);
    expect(result.stopReason).toBe('end');
  });

  it('parses Anthropic tool_use response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          { type: 'text', text: 'Let me search.' },
          { type: 'tool_use', id: 'tu_1', name: 'search', input: { query: 'vitest' } },
        ],
        stop_reason: 'tool_use',
      }),
    }));

    const llm = createLLM({ provider: 'anthropic', model: 'claude-sonnet-4-20250514' });
    const result = await llm(messages, sampleTools);

    expect(result.text).toBe('Let me search.');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe('search');
    expect(result.toolCalls[0].input).toEqual({ query: 'vitest' });
    expect(result.stopReason).toBe('tool_use');
  });

  it('parses Anthropic mixed blocks — concatenates text parts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          { type: 'text', text: 'Part 1. ' },
          { type: 'text', text: 'Part 2.' },
        ],
        stop_reason: 'end_turn',
      }),
    }));

    const llm = createLLM({ provider: 'anthropic', model: 'claude-sonnet-4-20250514' });
    const result = await llm(messages, []);

    expect(result.text).toBe('Part 1. Part 2.');
  });
});

// ── Google Gemini format ─────────────────────────────────────

describe('Google Gemini format (via createLLM)', () => {
  it('sends correct request body for Google provider', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Hello from Gemini.' }] } }],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const llm = createLLM({ provider: 'google', model: 'gemini-2.0-flash' });
    await llm(messages, sampleTools);

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('generativelanguage.googleapis.com');
    expect(url).toContain('gemini-2.0-flash');

    const body = JSON.parse(opts.body);
    expect(body.systemInstruction.parts[0].text).toBe('You are a helpful agent.');
    expect(body.contents).toBeDefined();
    expect(body.tools).toHaveLength(1);
    expect(body.tools[0].function_declarations).toHaveLength(1);
    expect(body.tools[0].function_declarations[0].name).toBe('search');
  });

  it('parses Google text response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Gemini says hello.' }] } }],
      }),
    }));

    const llm = createLLM({ provider: 'google', model: 'gemini-2.0-flash' });
    const result = await llm(messages, []);

    expect(result.text).toBe('Gemini says hello.');
    expect(result.toolCalls).toHaveLength(0);
    expect(result.stopReason).toBe('end');
  });

  it('parses Google functionCall response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [
              { text: 'Searching...' },
              { functionCall: { name: 'search', args: { query: 'vitest' } } },
            ],
          },
        }],
      }),
    }));

    const llm = createLLM({ provider: 'google', model: 'gemini-2.0-flash' });
    const result = await llm(messages, sampleTools);

    expect(result.text).toBe('Searching...');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe('search');
    expect(result.toolCalls[0].input).toEqual({ query: 'vitest' });
    expect(result.stopReason).toBe('tool_use');
  });

  it('handles Google functionCall with no args', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{ functionCall: { name: 'search' } }],
          },
        }],
      }),
    }));

    const llm = createLLM({ provider: 'google', model: 'gemini-2.0-flash' });
    const result = await llm(messages, sampleTools);

    expect(result.toolCalls[0].input).toEqual({});
  });
});

// ── HTTP error handling ──────────────────────────────────────

describe('HTTP error handling', () => {
  it('throws NOT_SIGNED_IN on 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    }));

    const llm = createLLM({ provider: 'openai', model: 'gpt-4o-mini' });
    await expect(llm(messages, [])).rejects.toThrow('NOT_SIGNED_IN');
  });

  it('throws NO_API_KEY on 403', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    }));

    const llm = createLLM({ provider: 'openai', model: 'gpt-4o-mini' });
    await expect(llm(messages, [])).rejects.toThrow('NO_API_KEY');
  });

  it('throws RATE_LIMITED on 429', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Too many requests',
    }));

    const llm = createLLM({ provider: 'openai', model: 'gpt-4o-mini' });
    await expect(llm(messages, [])).rejects.toThrow('RATE_LIMITED');
  });

  it('throws generic API error on 500', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal server error',
    }));

    const llm = createLLM({ provider: 'openai', model: 'gpt-4o-mini' });
    await expect(llm(messages, [])).rejects.toThrow('API error 500');
  });

  it('throws NOT_SIGNED_IN when no session token', async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
    });

    const llm = createLLM({ provider: 'openai', model: 'gpt-4o-mini' });
    await expect(llm(messages, [])).rejects.toThrow('NOT_SIGNED_IN');
  });

  it('throws for unknown provider', async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => {
        if (key === 'fags_session') return JSON.stringify({ token: fakeSession });
        return null;
      }),
      setItem: vi.fn(),
    });

    const llm = createLLM({ provider: 'nonexistent', model: 'whatever' });
    await expect(llm(messages, [])).rejects.toThrow('Unknown provider');
  });
});

// ── Ollama ───────────────────────────────────────────────────

describe('Ollama format (via createLLM)', () => {
  it('sends request to localhost:11434', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        message: { content: 'FINAL: The answer is 42' },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const llm = createLLM({ provider: 'ollama', model: 'llama3.2' });
    const result = await llm(messages, sampleTools);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('http://localhost:11434/api/chat');
    expect(result.toolCalls).toHaveLength(0);
  });

  it('parses TOOL_CALL in Ollama response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        message: { content: 'TOOL_CALL: search\nARGS: {"query":"vitest"}' },
      }),
    }));

    const llm = createLLM({ provider: 'ollama', model: 'llama3.2' });
    const result = await llm(messages, sampleTools);

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe('search');
    expect(result.toolCalls[0].input).toEqual({ query: 'vitest' });
    expect(result.stopReason).toBe('tool_use');
  });

  it('handles Ollama not running', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }));

    const llm = createLLM({ provider: 'ollama', model: 'llama3.2' });
    await expect(llm(messages, [])).rejects.toThrow('Ollama not running');
  });
});

// ── detectProvider ───────────────────────────────────────────

describe('detectProvider', () => {
  it('returns openai config when session exists', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no ollama')));

    const result = await detectProvider();
    expect(result.hasSession).toBe(true);
    expect(result.ready).toBe(true);
    expect(result.config.provider).toBe('openai');
    expect(result.config.model).toBe('gpt-4o-mini');
    expect(result.message).toContain('API key');
  });

  it('returns ollama config when no session but Ollama is running', async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    const result = await detectProvider();
    expect(result.hasSession).toBe(false);
    expect(result.hasOllama).toBe(true);
    expect(result.ready).toBe(true);
    expect(result.config.provider).toBe('ollama');
  });

  it('returns not ready when no session and no Ollama', async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
    });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no ollama')));

    const result = await detectProvider();
    expect(result.hasSession).toBe(false);
    expect(result.hasOllama).toBe(false);
    expect(result.ready).toBe(false);
    expect(result.message).toContain('Sign in');
  });

  it('detects Chrome AI when globalThis.LanguageModel exists', async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
    });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no ollama')));
    (globalThis as any).LanguageModel = { create: vi.fn() };

    const result = await detectProvider();
    expect(result.hasChromeAI).toBe(true);

    delete (globalThis as any).LanguageModel;
  });

  it('detects Chrome AI when globalThis.ai.languageModel exists', async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
    });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no ollama')));
    (globalThis as any).ai = { languageModel: { create: vi.fn() } };

    const result = await detectProvider();
    expect(result.hasChromeAI).toBe(true);

    delete (globalThis as any).ai;
  });
});

// ── Message format conversion (tool result round-trip) ───────

describe('Message format — tool result round-trip via OpenAI', () => {
  it('sends assistant tool calls and tool results in correct OpenAI format', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Final answer.', tool_calls: undefined }, finish_reason: 'stop' }],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const messagesWithToolHistory: Message[] = [
      systemMsg,
      userMsg,
      { role: 'assistant', content: 'Let me search.', toolCalls: [{ name: 'search', input: { query: 'vitest' } }] },
      { role: 'tool', toolName: 'search', content: 'Found: vitest docs' },
    ];

    const llm = createLLM({ provider: 'openai', model: 'gpt-4o-mini' });
    await llm(messagesWithToolHistory, sampleTools);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    // Should have system, user, assistant (with tool_calls), and tool result
    expect(body.messages).toHaveLength(4);
    expect(body.messages[2].role).toBe('assistant');
    expect(body.messages[2].tool_calls).toHaveLength(1);
    expect(body.messages[3].role).toBe('tool');
    expect(body.messages[3].content).toBe('Found: vitest docs');
    // tool_call_id should reference the assistant's tool call
    expect(body.messages[3].tool_call_id).toBe(body.messages[2].tool_calls[0].id);
  });
});
