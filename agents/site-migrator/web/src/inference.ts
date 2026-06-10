/**
 * LLM integration — proxy (user API key), Ollama, or Chrome Built-in AI.
 * Agents need a capable model for tool-calling, so we prefer proxy > Ollama > Chrome AI.
 */

const PROXY_BASE = 'https://freeagentstore.online/v1/proxy';

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
  capable: boolean; // Can follow structured THOUGHT/ACTION/INPUT format
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

function getProvider(id: string): Provider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

async function chatViaProxy(
  messages: Array<{ role: string; content: string }>,
  config: LLMConfig,
): Promise<string> {
  const session = getSession();
  if (!session) throw new Error('NOT_SIGNED_IN');

  const provider = getProvider(config.provider);
  if (!provider?.host) throw new Error(`Unknown provider: ${config.provider}`);

  let url: string;
  let body: unknown;

  if (config.provider === 'anthropic') {
    url = `${PROXY_BASE}/${provider.host}/v1/messages`;
    const systemMsg = messages.find((m) => m.role === 'system');
    const chatMsgs = messages.filter((m) => m.role !== 'system');
    body = {
      model: config.model,
      max_tokens: 4096,
      system: systemMsg?.content ?? '',
      messages: chatMsgs.map((m) => ({ role: m.role, content: m.content })),
    };
  } else if (config.provider === 'google') {
    url = `${PROXY_BASE}/${provider.host}/v1beta/models/${config.model}:generateContent`;
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
    const systemMsg = messages.find((m) => m.role === 'system');
    body = {
      contents,
      systemInstruction: systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined,
      generationConfig: { temperature: config.temperature ?? 0.3 },
    };
  } else {
    url = `${PROXY_BASE}/${provider.host}/v1/chat/completions`;
    body = {
      model: config.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
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
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    if (response.status === 401) throw new Error('NOT_SIGNED_IN');
    if (response.status === 403) {
      // Check if it's a no_key error
      try {
        const err = JSON.parse(text);
        if (err.error === 'no_key') throw new Error('NO_API_KEY');
      } catch (e) {
        if (e instanceof Error && e.message === 'NO_API_KEY') throw e;
      }
      throw new Error('NO_API_KEY');
    }
    throw new Error(`API error ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json();

  if (config.provider === 'anthropic') {
    return data.content?.[0]?.text ?? '';
  }
  if (config.provider === 'google') {
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }
  return data.choices?.[0]?.message?.content ?? '';
}

async function chatViaOllama(
  messages: Array<{ role: string; content: string }>,
  model: string,
): Promise<string> {
  const response = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model || 'llama3.2',
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: false,
    }),
  });

  if (!response.ok) throw new Error('Ollama not running. Start it at localhost:11434');
  const data = await response.json();
  return data.message?.content ?? '';
}

async function chatViaBuiltInAI(
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  const g = globalThis as any;
  const LM = g.LanguageModel ?? g.ai?.languageModel;
  if (!LM?.create) throw new Error('Chrome Built-in AI not available.');

  const systemMsg = messages.find((m) => m.role === 'system');
  const userMsgs = messages.filter((m) => m.role !== 'system');
  const recent = userMsgs.slice(-6);
  const prompt = recent.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');

  const session = await LM.create({
    systemPrompt: (systemMsg?.content ?? '').slice(0, 4000),
  });

  const result = await session.prompt(prompt);
  session.destroy?.();
  return result;
}

/** Create an LLM function for the agent loop */
export function createLLM(
  config: LLMConfig,
): (messages: Array<{ role: string; content: string }>) => Promise<string> {
  return async (messages) => {
    if (config.provider === 'built-in-ai') {
      return chatViaBuiltInAI(messages);
    }
    if (config.provider === 'ollama') {
      return chatViaOllama(messages, config.model);
    }
    return chatViaProxy(messages, config);
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

/** Detect what's available and return status */
export async function detectProvider(): Promise<DetectResult> {
  const hasSession = !!getSession();

  // Check Ollama
  let hasOllama = false;
  try {
    const r = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
    hasOllama = r.ok;
  } catch {}

  // Check Chrome Built-in AI
  const g = globalThis as any;
  const LM = g.LanguageModel ?? g.ai?.languageModel;
  const hasChromeAI = !!LM?.create;

  // Priority: proxy (needs session + key) > Ollama > Chrome AI
  if (hasSession) {
    return {
      config: { provider: 'openai', model: 'gpt-4o-mini' },
      hasSession, hasOllama, hasChromeAI,
      ready: true, // We assume they have a key — will fail with clear error if not
      message: 'Using your API key via proxy',
    };
  }

  if (hasOllama) {
    return {
      config: { provider: 'ollama', model: 'llama3.2' },
      hasSession, hasOllama, hasChromeAI,
      ready: true,
      message: 'Using Ollama (local)',
    };
  }

  if (hasChromeAI) {
    return {
      config: { provider: 'built-in-ai', model: 'gemini-nano' },
      hasSession, hasOllama, hasChromeAI,
      ready: true,
      message: 'Using Chrome Nano — tool calling may be unreliable (1.8B model)',
    };
  }

  return {
    config: { provider: 'openai', model: 'gpt-4o-mini' },
    hasSession, hasOllama, hasChromeAI,
    ready: false,
    message: 'No AI backend available',
  };
}
