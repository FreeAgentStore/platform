/**
 * LLM integration with native tool calling.
 * The proxy is transparent — tools param passes straight through to the provider.
 */

const PROXY_BASE = 'https://freeagentstore.online/v1/proxy';
const LLM_TIMEOUT = 120_000; // 2 minutes

export interface LLMConfig {
  provider: string;
  model: string;
  temperature?: number;
}

export interface Provider {
  id: string;
  name: string;
  host: string;
  models: string[];
  capable: boolean;
}

export const PROVIDERS: Provider[] = [
  { id: 'openai', name: 'OpenAI', host: 'api.openai.com', models: ['gpt-4o-mini', 'gpt-4o'], capable: true },
  { id: 'anthropic', name: 'Anthropic', host: 'api.anthropic.com', models: ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001'], capable: true },
  { id: 'google', name: 'Google Gemini', host: 'generativelanguage.googleapis.com', models: ['gemini-2.0-flash', 'gemini-2.5-flash'], capable: true },
  { id: 'groq', name: 'Groq', host: 'api.groq.com', models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'], capable: true },
  { id: 'ollama', name: 'Ollama (local)', host: '', models: ['llama3.2', 'mistral', 'gemma2', 'phi3'], capable: true },
  { id: 'built-in-ai', name: 'Chrome Nano (limited)', host: '', models: ['gemini-nano'], capable: false },
];

function getSession(): string | null {
  try {
    const stored = localStorage.getItem('fags_session');
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed?.token ?? stored;
  } catch {
    return localStorage.getItem('fags_session');
  }
}

// Unique ID generator for tool call IDs
let _callIdCounter = 0;
function nextCallId(): string {
  return `call_${Date.now().toString(36)}_${(++_callIdCounter).toString(36)}`;
}

// ── Tool definition types (provider-agnostic) ─────────────────

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
}

export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
}

export interface LLMResponse {
  text: string | null;
  toolCalls: ToolCall[];
  stopReason: 'tool_use' | 'end' | 'length';
}

export type Message =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ToolCall[] }
  | { role: 'tool'; toolName: string; content: string };

// ── OpenAI format ────────────────────────────────────────────

function toolsToOpenAI(tools: ToolDef[]) {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(t.parameters).map(([k, v]) => [k, { type: v.type, description: v.description }]),
        ),
        required: Object.entries(t.parameters).filter(([, v]) => v.required !== false).map(([k]) => k),
      },
    },
  }));
}

// Track tool_call IDs so tool results match the right call
const _openaiCallIds = new Map<string, string>(); // "assistantMsg:toolName:index" → callId

function messagesToOpenAI(messages: Message[]) {
  const out: unknown[] = [];
  let assistantIdx = 0;
  for (const m of messages) {
    if (m.role === 'system' || m.role === 'user') {
      out.push({ role: m.role, content: m.content });
    } else if (m.role === 'assistant') {
      if (m.toolCalls?.length) {
        const toolCallMsgs = m.toolCalls.map((tc, i) => {
          const id = nextCallId();
          _openaiCallIds.set(`${assistantIdx}:${tc.name}:${i}`, id);
          return { id, type: 'function', function: { name: tc.name, arguments: JSON.stringify(tc.input) } };
        });
        out.push({ role: 'assistant', content: m.content || null, tool_calls: toolCallMsgs });
        assistantIdx++;
      } else {
        out.push({ role: 'assistant', content: m.content });
      }
    } else if (m.role === 'tool') {
      // Find the matching tool_call_id
      const prevAssistant = out.findLast((x: any) => x.role === 'assistant' && x.tool_calls);
      const tc = (prevAssistant as any)?.tool_calls?.find((c: any) => c.function.name === m.toolName);
      out.push({ role: 'tool', tool_call_id: tc?.id ?? nextCallId(), content: m.content });
    }
  }
  return out;
}

function parseOpenAIResponse(data: any): LLMResponse {
  const choice = data.choices?.[0];
  const msg = choice?.message;
  const toolCalls: ToolCall[] = (msg?.tool_calls ?? []).map((tc: any) => {
    let input: Record<string, unknown> = {};
    try { input = JSON.parse(tc.function.arguments || '{}'); } catch { input = { _raw: tc.function.arguments }; }
    return { name: tc.function.name, input };
  });
  return {
    text: msg?.content ?? null,
    toolCalls,
    stopReason: choice?.finish_reason === 'tool_calls' || toolCalls.length > 0 ? 'tool_use' : 'end',
  };
}

// ── Anthropic format ─────────────────────────────────────────

function toolsToAnthropic(tools: ToolDef[]) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: {
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(t.parameters).map(([k, v]) => [k, { type: v.type, description: v.description }]),
      ),
      required: Object.entries(t.parameters).filter(([, v]) => v.required !== false).map(([k]) => k),
    },
  }));
}

function messagesToAnthropic(messages: Message[]) {
  const system = messages.find((m) => m.role === 'system')?.content ?? '';
  const out: Array<{ role: string; content: unknown }> = [];

  for (const m of messages) {
    if (m.role === 'system') continue;
    if (m.role === 'user') {
      // Merge consecutive user messages (Anthropic rejects consecutive same-role)
      const last = out[out.length - 1];
      if (last?.role === 'user') {
        if (typeof last.content === 'string') {
          last.content = last.content + '\n\n' + m.content;
        }
      } else {
        out.push({ role: 'user', content: m.content });
      }
    } else if (m.role === 'assistant') {
      const content: unknown[] = [];
      if (m.content) content.push({ type: 'text', text: m.content });
      if (m.toolCalls?.length) {
        for (const tc of m.toolCalls) {
          content.push({ type: 'tool_use', id: nextCallId(), name: tc.name, input: tc.input });
        }
      }
      if (content.length === 0) content.push({ type: 'text', text: '(thinking)' });
      out.push({ role: 'assistant', content });
    } else if (m.role === 'tool') {
      // tool_result must be in a user message
      const toolUseId = (() => {
        // Find the tool_use block in the preceding assistant message
        for (let i = out.length - 1; i >= 0; i--) {
          const msg = out[i];
          if (msg.role === 'assistant' && Array.isArray(msg.content)) {
            const block = (msg.content as any[]).find((b: any) => b.type === 'tool_use' && b.name === m.toolName);
            if (block) return block.id;
          }
        }
        return nextCallId();
      })();

      const resultBlock = { type: 'tool_result', tool_use_id: toolUseId, content: m.content };
      // Merge into previous user message if it's a tool_result array
      const last = out[out.length - 1];
      if (last?.role === 'user' && Array.isArray(last.content)) {
        (last.content as unknown[]).push(resultBlock);
      } else {
        out.push({ role: 'user', content: [resultBlock] });
      }
    }
  }
  return { system, messages: out };
}

function parseAnthropicResponse(data: any): LLMResponse {
  const blocks = data.content ?? [];
  let text: string | null = null;
  const toolCalls: ToolCall[] = [];
  for (const block of blocks) {
    if (block.type === 'text') text = (text ?? '') + block.text;
    if (block.type === 'tool_use') toolCalls.push({ name: block.name, input: block.input ?? {} });
  }
  return {
    text,
    toolCalls,
    stopReason: data.stop_reason === 'tool_use' || toolCalls.length > 0 ? 'tool_use' : 'end',
  };
}

// ── Google Gemini format ─────────────────────────────────────

function toolsToGoogle(tools: ToolDef[]) {
  return [{
    function_declarations: tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(t.parameters).map(([k, v]) => [k, { type: v.type, description: v.description }]),
        ),
        required: Object.entries(t.parameters).filter(([, v]) => v.required !== false).map(([k]) => k),
      },
    })),
  }];
}

function messagesToGoogle(messages: Message[]) {
  const system = messages.find((m) => m.role === 'system')?.content;
  const contents: unknown[] = [];
  for (const m of messages) {
    if (m.role === 'system') continue;
    if (m.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: m.content }] });
    } else if (m.role === 'assistant') {
      const parts: unknown[] = [];
      if (m.content) parts.push({ text: m.content });
      if (m.toolCalls?.length) {
        for (const tc of m.toolCalls) {
          parts.push({ functionCall: { name: tc.name, args: tc.input } });
        }
      }
      if (parts.length === 0) parts.push({ text: '' });
      contents.push({ role: 'model', parts });
    } else if (m.role === 'tool') {
      contents.push({
        role: 'function',
        parts: [{ functionResponse: { name: m.toolName, response: { result: m.content } } }],
      });
    }
  }
  return { system, contents };
}

function parseGoogleResponse(data: any): LLMResponse {
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  let text: string | null = null;
  const toolCalls: ToolCall[] = [];
  for (const part of parts) {
    if (part.text) text = (text ?? '') + part.text;
    if (part.functionCall) toolCalls.push({ name: part.functionCall.name, input: part.functionCall.args ?? {} });
  }
  return {
    text,
    toolCalls,
    stopReason: toolCalls.length > 0 ? 'tool_use' : 'end',
  };
}

// ── Main chat function ───────────────────────────────────────

async function chatWithTools(
  messages: Message[],
  tools: ToolDef[],
  config: LLMConfig,
): Promise<LLMResponse> {
  const session = getSession();
  if (!session) throw new Error('NOT_SIGNED_IN');

  const provider = PROVIDERS.find((p) => p.id === config.provider);
  if (!provider?.host) throw new Error(`Unknown provider: ${config.provider}`);

  let url: string;
  let body: unknown;

  if (config.provider === 'anthropic') {
    url = `${PROXY_BASE}/${provider.host}/v1/messages`;
    const { system, messages: msgs } = messagesToAnthropic(messages);
    body = {
      model: config.model,
      max_tokens: 4096,
      system,
      messages: msgs,
      ...(tools.length > 0 ? { tools: toolsToAnthropic(tools) } : {}),
    };
  } else if (config.provider === 'google') {
    url = `${PROXY_BASE}/${provider.host}/v1beta/models/${config.model}:generateContent`;
    const { system, contents } = messagesToGoogle(messages);
    body = {
      contents,
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      ...(tools.length > 0 ? { tools: toolsToGoogle(tools) } : {}),
      generationConfig: { temperature: config.temperature ?? 0.3 },
    };
  } else {
    // OpenAI-compatible (OpenAI, Groq)
    url = `${PROXY_BASE}/${provider.host}/v1/chat/completions`;
    body = {
      model: config.model,
      messages: messagesToOpenAI(messages),
      ...(tools.length > 0 ? { tools: toolsToOpenAI(tools) } : {}),
      temperature: config.temperature ?? 0.3,
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(LLM_TIMEOUT),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    if (response.status === 401) throw new Error('NOT_SIGNED_IN');
    if (response.status === 403) throw new Error('NO_API_KEY');
    if (response.status === 429) throw new Error('RATE_LIMITED');
    throw new Error(`API error ${response.status}: ${text.slice(0, 300)}`);
  }

  const data = await response.json();

  if (config.provider === 'anthropic') return parseAnthropicResponse(data);
  if (config.provider === 'google') return parseGoogleResponse(data);
  return parseOpenAIResponse(data);
}

// ── Ollama (text-based fallback) ─────────────────────────────

async function chatOllama(
  messages: Message[],
  tools: ToolDef[],
  model: string,
): Promise<LLMResponse> {
  const toolsDesc = tools.map((t) =>
    `${t.name}(${Object.entries(t.parameters).map(([k, v]) => `${k}: ${v.type}`).join(', ')}): ${t.description}`
  ).join('\n');

  const mapped = messages.map((m) => {
    if (m.role === 'system') {
      return { role: 'system', content: tools.length > 0
        ? `${m.content}\n\nYou have tools:\n${toolsDesc}\n\nTo call a tool respond EXACTLY:\nTOOL_CALL: tool_name\nARGS: {"key": "value"}\n\nTo give a final answer respond:\nFINAL: your answer`
        : m.content };
    }
    if (m.role === 'tool') return { role: 'user', content: `Tool ${m.toolName} returned: ${m.content}` };
    return { role: m.role, content: m.content ?? '' };
  });

  const response = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: model || 'llama3.2', messages: mapped, stream: false }),
    signal: AbortSignal.timeout(LLM_TIMEOUT),
  });

  if (!response.ok) throw new Error('Ollama not running at localhost:11434');
  const data = await response.json();
  const text = data.message?.content ?? '';

  const toolMatch = text.match(/TOOL_CALL:\s*(\w[\w-]*)/i);
  const argsMatch = text.match(/ARGS:\s*(\{[\s\S]*?\})/i);
  if (toolMatch) {
    let input: Record<string, unknown> = {};
    if (argsMatch) try { input = JSON.parse(argsMatch[1]); } catch {}
    return { text, toolCalls: [{ name: toolMatch[1], input }], stopReason: 'tool_use' };
  }
  return { text, toolCalls: [], stopReason: 'end' };
}

// ── Public API ───────────────────────────────────────────────

export type LLMFn = (messages: Message[], tools: ToolDef[]) => Promise<LLMResponse>;

export function createLLM(config: LLMConfig): LLMFn {
  return async (messages, tools) => {
    if (config.provider === 'ollama') return chatOllama(messages, tools, config.model);
    if (config.provider === 'built-in-ai') throw new Error('Chrome Nano does not support tool calling. Select a different provider.');
    return chatWithTools(messages, tools, config);
  };
}

export interface DetectResult {
  config: LLMConfig;
  hasSession: boolean;
  hasOllama: boolean;
  hasChromeAI: boolean;
  ready: boolean;
  message: string;
}

export async function detectProvider(): Promise<DetectResult> {
  const hasSession = !!getSession();
  let hasOllama = false;
  try {
    const r = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
    hasOllama = r.ok;
  } catch {}
  const g = globalThis as any;
  const hasChromeAI = !!(g.LanguageModel ?? g.ai?.languageModel)?.create;

  if (hasSession) {
    return { config: { provider: 'openai', model: 'gpt-4o-mini' }, hasSession, hasOllama, hasChromeAI, ready: true, message: 'Using your API key via proxy' };
  }
  if (hasOllama) {
    return { config: { provider: 'ollama', model: 'llama3.2' }, hasSession, hasOllama, hasChromeAI, ready: true, message: 'Using Ollama (local)' };
  }
  return { config: { provider: 'openai', model: 'gpt-4o-mini' }, hasSession, hasOllama, hasChromeAI, ready: false, message: 'Sign in and add an API key to use autonomous agents' };
}
