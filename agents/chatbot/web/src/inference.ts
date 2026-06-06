import { getProvider } from './config';

export interface InferenceOptions {
  messages: Array<{ role: string; content: string }>;
  provider: string;
  model: string;
  temperature: number;
  onChunk?: (text: string) => void;
}

const PROXY_BASE = 'https://freeagentstore.online/v1/proxy';

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

async function chatViaProxy(options: InferenceOptions): Promise<string> {
  const session = getSession();
  if (!session) throw new Error('no-session');

  const provider = getProvider(options.provider);
  if (!provider || !provider.host) throw new Error('no-host');

  // Build the proxy URL and request body based on provider
  let url: string;
  let body: unknown;
  let parseStream: (chunk: string, acc: string, onChunk?: (t: string) => void) => string;

  if (options.provider === 'anthropic') {
    url = `${PROXY_BASE}/${provider.host}/v1/messages`;
    const systemMsg = options.messages.find(m => m.role === 'system');
    const chatMsgs = options.messages.filter(m => m.role !== 'system');
    body = {
      model: options.model,
      max_tokens: 4096,
      system: systemMsg?.content ?? '',
      messages: chatMsgs.map(m => ({ role: m.role, content: m.content })),
      stream: true,
    };
    parseStream = (chunk, acc, onChunk) => {
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          const token = json.delta?.text ?? '';
          if (token) {
            acc += token;
            onChunk?.(acc);
          }
        } catch {}
      }
      return acc;
    };
  } else if (options.provider === 'google') {
    url = `${PROXY_BASE}/${provider.host}/v1beta/models/${options.model}:streamGenerateContent?alt=sse`;
    const contents = options.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
    const systemMsg = options.messages.find(m => m.role === 'system');
    body = {
      contents,
      systemInstruction: systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined,
      generationConfig: { temperature: options.temperature },
    };
    parseStream = (chunk, acc, onChunk) => {
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data) continue;
        try {
          const json = JSON.parse(data);
          const token = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
          if (token) {
            acc += token;
            onChunk?.(acc);
          }
        } catch {}
      }
      return acc;
    };
  } else {
    // OpenAI-compatible (OpenAI, Groq)
    url = `${PROXY_BASE}/${provider.host}/v1/chat/completions`;
    body = {
      model: options.model,
      messages: options.messages.map(m => ({ role: m.role, content: m.content })),
      temperature: options.temperature,
      stream: true,
    };
    parseStream = (chunk, acc, onChunk) => {
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          const token = json.choices?.[0]?.delta?.content ?? '';
          if (token) {
            acc += token;
            onChunk?.(acc);
          }
        } catch {}
      }
      return acc;
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    if (response.status === 401 || response.status === 403) throw new Error('no-key');
    throw new Error(`Proxy error ${response.status}: ${text}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    fullText = parseStream(chunk, fullText, options.onChunk);
  }

  return fullText;
}

async function chatViaBuiltInAI(options: InferenceOptions): Promise<string> {
  const g = globalThis as any;
  const LM = g.LanguageModel ?? g.ai?.languageModel;
  if (!LM?.create) throw new Error('not-available');

  const systemMsg = options.messages.find(m => m.role === 'system');
  const userMsgs = options.messages.filter(m => m.role !== 'system');
  const lastUser = userMsgs[userMsgs.length - 1]?.content ?? '';

  const session = await LM.create({
    systemPrompt: systemMsg?.content ?? '',
  });

  const result = await session.prompt(lastUser);
  session.destroy?.();
  options.onChunk?.(result);
  return result;
}

async function chatViaOllama(options: InferenceOptions): Promise<string> {
  const response = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: options.model || 'llama3.2',
      messages: options.messages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
    }),
  });

  if (!response.ok) throw new Error('Ollama unavailable');

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split('\n')) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        const token = json.message?.content ?? '';
        if (token) {
          fullText += token;
          options.onChunk?.(fullText);
        }
      } catch {}
    }
  }

  return fullText;
}

export async function chat(options: InferenceOptions): Promise<string> {
  const { provider } = options;

  // Direct routes for non-proxy providers
  if (provider === 'built-in-ai') {
    return chatViaBuiltInAI(options);
  }
  if (provider === 'ollama') {
    return chatViaOllama(options);
  }

  // Proxy-based providers: try proxy, then fallback chain
  try {
    return await chatViaProxy(options);
  } catch (err: any) {
    console.warn('Proxy failed:', err.message);
  }

  // Fallback: Chrome Built-in AI
  try {
    return await chatViaBuiltInAI(options);
  } catch {
    console.warn('Built-in AI not available');
  }

  // Fallback: Ollama
  try {
    return await chatViaOllama(options);
  } catch {
    console.warn('Ollama not available');
  }

  throw new Error('No AI backend available. Configure your API key, enable Chrome Built-in AI, or run Ollama locally.');
}
