export interface ProviderInfo {
  id: string;
  name: string;
  models: string[];
  host: string;
}

export const PROVIDERS: ProviderInfo[] = [
  { id: 'openai', name: 'OpenAI', models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'], host: 'api.openai.com' },
  { id: 'anthropic', name: 'Anthropic', models: ['claude-3-haiku-20240307', 'claude-3-5-sonnet-20241022'], host: 'api.anthropic.com' },
  { id: 'google', name: 'Google AI', models: ['gemini-1.5-flash', 'gemini-1.5-pro'], host: 'generativelanguage.googleapis.com' },
  { id: 'groq', name: 'Groq', models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'], host: 'api.groq.com' },
  { id: 'ollama', name: 'Ollama (local)', models: ['llama3.2', 'mistral', 'phi3'], host: 'localhost:11434' },
  { id: 'built-in-ai', name: 'Chrome Built-in AI', models: ['gemini-nano'], host: '' },
];

export function getProvider(id: string): ProviderInfo | undefined {
  return PROVIDERS.find(p => p.id === id);
}
