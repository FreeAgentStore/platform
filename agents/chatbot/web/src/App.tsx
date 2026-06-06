import { useState, useEffect, useRef, useCallback } from 'react';
import { type Message, type AgentConfig, type Document, DEFAULT_CONFIG, getDocuments, deleteDocument, getDocContext, addMessage, getMessages, clearMessages, getConfig, saveConfig } from './store';
import { chat } from './inference';
import { importFromText, importFromURL, importFromFile } from './knowledge';
import { PROVIDERS, getProvider } from './config';

type AddMode = 'paste' | 'url' | 'file' | null;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export default function App() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [config, setConfig] = useState<AgentConfig>(DEFAULT_CONFIG);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState('');
  const [generating, setGenerating] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [error, setError] = useState('');
  const [hasSession, setHasSession] = useState(false);

  // Add-document form state
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  // Config draft
  const [configDraft, setConfigDraft] = useState<AgentConfig>(DEFAULT_CONFIG);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Init
  useEffect(() => {
    setHasSession(!!localStorage.getItem('fags_session'));
    Promise.all([getDocuments(), getMessages(), getConfig()]).then(([d, m, c]) => {
      setDocs(d);
      setMessages(m);
      setConfig(c);
      setConfigDraft(c);
    });
  }, []);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  const totalSize = docs.reduce((sum, d) => sum + d.size, 0);
  const provider = getProvider(config.provider);

  const refreshDocs = useCallback(async () => {
    setDocs(await getDocuments());
  }, []);

  // --- Document management ---

  async function handleAddPaste() {
    setAddLoading(true);
    setAddError('');
    try {
      await importFromText(pasteTitle, pasteText);
      setPasteTitle('');
      setPasteText('');
      setAddMode(null);
      await refreshDocs();
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  }

  async function handleAddURL() {
    setAddLoading(true);
    setAddError('');
    try {
      await importFromURL(urlInput);
      setUrlInput('');
      setAddMode(null);
      await refreshDocs();
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  }

  async function handleAddFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAddLoading(true);
    setAddError('');
    try {
      await importFromFile(file);
      setAddMode(null);
      await refreshDocs();
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  }

  async function handleDeleteDoc(id: string) {
    await deleteDocument(id);
    await refreshDocs();
  }

  // --- Chat ---

  async function handleSend() {
    const text = input.trim();
    if (!text || generating) return;

    setInput('');
    setError('');
    setGenerating(true);
    setStreaming('');

    const userMsg = await addMessage({ role: 'user', content: text });
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    try {
      const docContext = await getDocContext();
      const styleHints: Record<string, string> = {
        concise: 'Be concise and direct.',
        detailed: 'Be thorough and detailed.',
        professional: 'Use a professional, formal tone.',
        casual: 'Be friendly and conversational.',
      };

      const systemContent = [
        config.systemPrompt,
        styleHints[config.responseStyle] || '',
        docContext ? `\n\nDocuments:\n${docContext}` : '',
      ].filter(Boolean).join('\n');

      const chatMessages = [
        { role: 'system', content: systemContent },
        ...updatedMessages.slice(-50).map(m => ({ role: m.role, content: m.content })),
      ];

      const result = await chat({
        messages: chatMessages,
        provider: config.provider,
        model: config.model,
        temperature: config.temperature,
        onChunk: (text) => setStreaming(text),
      });

      setStreaming('');
      const assistantMsg = await addMessage({ role: 'assistant', content: result });
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setError(err.message);
      setStreaming('');
    } finally {
      setGenerating(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleClearChat() {
    await clearMessages();
    setMessages([]);
  }

  async function handleSaveConfig() {
    const saved = await saveConfig(configDraft);
    setConfig(saved);
    setShowConfig(false);
  }

  const sourceBadgeColor: Record<string, string> = {
    paste: 'bg-violet-900/40 text-violet-400',
    url: 'bg-blue-900/40 text-blue-400',
    file: 'bg-emerald-900/40 text-emerald-400',
  };

  // --- Render ---

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800 shrink-0">
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          className="lg:hidden text-neutral-400 hover:text-neutral-200"
          aria-label="Toggle sidebar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">FreeAgentStore</a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>{config.agentName}</h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-violet-900/40 text-violet-400">
          {provider?.name ?? config.provider} {config.model}
        </span>
        <button
          onClick={() => { setConfigDraft({ ...config }); setShowConfig(true); }}
          className="text-neutral-400 hover:text-neutral-200"
          aria-label="Settings"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className={`${showSidebar ? 'flex' : 'hidden'} lg:flex flex-col w-72 border-r border-neutral-800 bg-neutral-950 shrink-0 absolute lg:relative z-10 h-[calc(100dvh-53px)] lg:h-auto`}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
            <span className="text-sm font-semibold text-neutral-300">Documents</span>
            <span className="text-xs text-neutral-500">{formatBytes(totalSize)} / 30 KB</span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {docs.length === 0 && (
              <p className="text-xs text-neutral-500 text-center py-8 px-4">
                No documents yet. Add some to start chatting.
              </p>
            )}
            {docs.map(doc => (
              <div key={doc.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-neutral-900 group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-neutral-200 truncate">{doc.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${sourceBadgeColor[doc.source]}`}>
                      {doc.source}
                    </span>
                    <span className="text-[10px] text-neutral-600">{formatBytes(doc.size)}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteDoc(doc.id)}
                  className="text-neutral-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
                  aria-label="Delete document"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* Add document controls */}
          <div className="p-3 border-t border-neutral-800">
            {addMode === null ? (
              <div className="flex gap-1">
                <button onClick={() => { setAddMode('paste'); setAddError(''); }}
                  className="flex-1 text-xs px-2 py-2 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-violet-600 text-neutral-400 hover:text-violet-400 transition-colors">
                  Paste text
                </button>
                <button onClick={() => { setAddMode('url'); setAddError(''); }}
                  className="flex-1 text-xs px-2 py-2 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-violet-600 text-neutral-400 hover:text-violet-400 transition-colors">
                  Import URL
                </button>
                <button onClick={() => { setAddMode('file'); setAddError(''); }}
                  className="flex-1 text-xs px-2 py-2 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-violet-600 text-neutral-400 hover:text-violet-400 transition-colors">
                  Upload file
                </button>
              </div>
            ) : addMode === 'paste' ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={pasteTitle}
                  onChange={e => setPasteTitle(e.target.value)}
                  placeholder="Title"
                  className="w-full px-2 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-sm focus:outline-none focus:border-violet-600"
                />
                <textarea
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  placeholder="Paste your text here..."
                  rows={4}
                  className="w-full px-2 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-sm resize-none focus:outline-none focus:border-violet-600"
                />
                {addError && <p className="text-xs text-red-400">{addError}</p>}
                <div className="flex gap-1">
                  <button onClick={() => setAddMode(null)}
                    className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:bg-neutral-700">
                    Cancel
                  </button>
                  <button onClick={handleAddPaste} disabled={!pasteText.trim() || addLoading}
                    className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-40">
                    {addLoading ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </div>
            ) : addMode === 'url' ? (
              <div className="space-y-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  placeholder="https://example.com/article"
                  className="w-full px-2 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-sm focus:outline-none focus:border-violet-600"
                />
                {addError && <p className="text-xs text-red-400">{addError}</p>}
                <div className="flex gap-1">
                  <button onClick={() => setAddMode(null)}
                    className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:bg-neutral-700">
                    Cancel
                  </button>
                  <button onClick={handleAddURL} disabled={!urlInput.trim() || addLoading}
                    className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-40">
                    {addLoading ? 'Importing...' : 'Import'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="file"
                  accept=".txt,.md,.csv,.json"
                  onChange={handleAddFile}
                  className="w-full text-xs text-neutral-400 file:mr-2 file:px-2 file:py-1 file:rounded-lg file:border-0 file:bg-violet-600 file:text-white file:text-xs file:cursor-pointer"
                />
                {addError && <p className="text-xs text-red-400">{addError}</p>}
                <button onClick={() => setAddMode(null)}
                  className="w-full text-xs px-2 py-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:bg-neutral-700">
                  Cancel
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Sidebar overlay backdrop on mobile */}
        {showSidebar && (
          <div className="lg:hidden fixed inset-0 bg-black/50 z-[5]" onClick={() => setShowSidebar(false)} />
        )}

        {/* Main chat area */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Session/key banners */}
          {!hasSession && (
            <div className="px-4 py-2 bg-amber-900/30 border-b border-amber-800/50 text-amber-300 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span>Sign in to use your API key.</span>
              <a href="https://freeagentstore.online" className="underline hover:text-amber-200 ml-1">Sign in</a>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && !streaming && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="text-4xl mb-4" style={{ fontFamily: 'var(--font-serif)' }}>
                  {config.agentName}
                </div>
                <p className="text-neutral-500 text-sm max-w-md">
                  {docs.length === 0
                    ? 'Add some documents in the sidebar, then ask questions about them.'
                    : `${docs.length} document${docs.length !== 1 ? 's' : ''} loaded (${formatBytes(totalSize)}). Ask a question!`
                  }
                </p>
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-violet-600 text-white rounded-br-md'
                    : 'bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-bl-md'
                }`}>
                  <MessageContent content={msg.content} />
                </div>
              </div>
            ))}

            {streaming && (
              <div className="flex justify-start">
                <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-bl-md bg-neutral-900 border border-neutral-800 text-neutral-200 text-sm leading-relaxed">
                  <MessageContent content={streaming} />
                </div>
              </div>
            )}

            {generating && !streaming && (
              <div className="flex justify-start">
                <div className="px-4 py-2.5 rounded-2xl rounded-bl-md bg-neutral-900 border border-neutral-800 text-neutral-400 text-sm">
                  <span className="inline-flex gap-1">
                    <span className="animate-pulse">Thinking</span>
                    <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
                    <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
                    <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div className="flex justify-center">
                <div className="px-4 py-2 rounded-lg bg-red-900/30 border border-red-800/50 text-red-300 text-sm max-w-md">
                  {error}
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input bar */}
          <div className="border-t border-neutral-800 p-3 shrink-0">
            <div className="flex gap-2 max-w-3xl mx-auto">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={docs.length === 0 ? 'Add documents first, then ask questions...' : 'Ask a question about your documents...'}
                rows={1}
                className="flex-1 px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-sm resize-none focus:outline-none focus:border-violet-600 placeholder:text-neutral-600 max-h-32"
                style={{ minHeight: '42px' }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || generating}
                className="px-4 py-2.5 rounded-xl bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-40 transition-colors shrink-0"
                aria-label="Send message"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
                </svg>
              </button>
            </div>
            <p className="text-[10px] text-neutral-600 text-center mt-1.5">
              Enter to send, Shift+Enter for newline
            </p>
          </div>
        </main>
      </div>

      {/* Config modal */}
      {showConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowConfig(false)}>
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-serif)' }}>Settings</h2>

            <div>
              <label className="text-xs text-neutral-400 block mb-1">Agent Name</label>
              <input
                value={configDraft.agentName}
                onChange={e => setConfigDraft({ ...configDraft, agentName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-sm focus:outline-none focus:border-violet-600"
              />
            </div>

            <div>
              <label className="text-xs text-neutral-400 block mb-1">Provider</label>
              <select
                value={configDraft.provider}
                onChange={e => {
                  const p = getProvider(e.target.value);
                  setConfigDraft({
                    ...configDraft,
                    provider: e.target.value,
                    model: p?.models[0] ?? '',
                  });
                }}
                className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-sm focus:outline-none focus:border-violet-600"
              >
                {PROVIDERS.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-neutral-400 block mb-1">Model</label>
              <select
                value={configDraft.model}
                onChange={e => setConfigDraft({ ...configDraft, model: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-sm focus:outline-none focus:border-violet-600"
              >
                {(getProvider(configDraft.provider)?.models ?? []).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-neutral-400 block mb-1">
                Temperature: {configDraft.temperature.toFixed(1)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={configDraft.temperature}
                onChange={e => setConfigDraft({ ...configDraft, temperature: parseFloat(e.target.value) })}
                className="w-full accent-violet-600"
              />
            </div>

            <div>
              <label className="text-xs text-neutral-400 block mb-1">System Prompt</label>
              <textarea
                value={configDraft.systemPrompt}
                onChange={e => setConfigDraft({ ...configDraft, systemPrompt: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-sm resize-none focus:outline-none focus:border-violet-600"
              />
            </div>

            <div>
              <label className="text-xs text-neutral-400 block mb-1">Response Style</label>
              <div className="flex gap-2 flex-wrap">
                {(['concise', 'detailed', 'professional', 'casual'] as const).map(style => (
                  <button
                    key={style}
                    onClick={() => setConfigDraft({ ...configDraft, responseStyle: style })}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      configDraft.responseStyle === style
                        ? 'bg-violet-600 text-white'
                        : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                    }`}
                  >
                    {style.charAt(0).toUpperCase() + style.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleClearChat}
                className="px-4 py-2 rounded-lg text-sm bg-red-900/30 border border-red-800/50 text-red-300 hover:bg-red-900/50"
              >
                Clear chat history
              </button>
              <div className="flex-1" />
              <button
                onClick={() => setShowConfig(false)}
                className="px-4 py-2 rounded-lg text-sm bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfig}
                className="px-4 py-2 rounded-lg text-sm bg-violet-600 text-white hover:bg-violet-500"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Renders message content with basic markdown-like formatting */
function MessageContent({ content }: { content: string }) {
  // Split on code blocks
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const inner = part.slice(3, -3);
          const newlineIdx = inner.indexOf('\n');
          const code = newlineIdx >= 0 ? inner.slice(newlineIdx + 1) : inner;
          return (
            <pre key={i} className="bg-neutral-950 rounded-lg p-3 my-2 overflow-x-auto text-xs font-mono">
              <code>{code}</code>
            </pre>
          );
        }
        // Inline formatting: bold, inline code
        return (
          <span key={i}>
            {part.split('\n').map((line, j, arr) => (
              <span key={j}>
                {renderInline(line)}
                {j < arr.length - 1 && <br />}
              </span>
            ))}
          </span>
        );
      })}
    </>
  );
}

function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('`')) {
      nodes.push(
        <code key={match.index} className="bg-neutral-800 px-1 py-0.5 rounded text-xs font-mono">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={match.index}>{token.slice(2, -2)}</strong>);
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}
