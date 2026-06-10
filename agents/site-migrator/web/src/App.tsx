import { useState, useEffect, useRef, useCallback } from 'react';
import { runAgent, type AgentState, type AgentHandle, type Step, type Tool } from './agent-loop';
import { createLLM, detectProvider, PROVIDERS, type LLMConfig, type DetectResult } from './inference';
import { AGENT_TOOLS } from './tools';
import { AGENT_CONFIG } from './config';
import { type McpServer, loadServers, saveServers, discoverTools, mcpToolsToAgentTools, testConnection } from './mcp-client';

export default function App() {
  const [goal, setGoal] = useState('');
  const [state, setState] = useState<AgentState | null>(null);
  const [config, setConfig] = useState<LLMConfig>({ provider: 'openai', model: 'gpt-4o-mini' });
  const [detect, setDetect] = useState<DetectResult | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showMcp, setShowMcp] = useState(false);
  const handleRef = useRef<AgentHandle | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // MCP state
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [mcpTools, setMcpTools] = useState<Tool[]>([]);
  const [mcpStatus, setMcpStatus] = useState<Record<string, { ok: boolean; count: number; error?: string }>>({});
  const [mcpLoading, setMcpLoading] = useState(false);
  const [newMcpName, setNewMcpName] = useState('');
  const [newMcpUrl, setNewMcpUrl] = useState('');

  useEffect(() => { detectProvider().then((r) => { setConfig(r.config); setDetect(r); }); }, []);
  useEffect(() => { setMcpServers(loadServers()); }, []);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; });

  // Load tools from all MCP servers
  const refreshMcpTools = useCallback(async (servers: McpServer[]) => {
    if (servers.length === 0) { setMcpTools([]); setMcpStatus({}); return; }
    setMcpLoading(true);
    const allTools: Tool[] = [];
    const status: Record<string, { ok: boolean; count: number; error?: string }> = {};

    await Promise.all(servers.map(async (server) => {
      try {
        const defs = await discoverTools(server);
        const tools = mcpToolsToAgentTools(server, defs);
        allTools.push(...tools);
        status[server.url] = { ok: true, count: defs.length };
      } catch (err: any) {
        status[server.url] = { ok: false, count: 0, error: err.message };
      }
    }));

    setMcpTools(allTools);
    setMcpStatus(status);
    setMcpLoading(false);
  }, []);

  useEffect(() => { refreshMcpTools(mcpServers); }, [mcpServers, refreshMcpTools]);

  function addMcpServer() {
    if (!newMcpName.trim() || !newMcpUrl.trim()) return;
    const server: McpServer = { name: newMcpName.trim(), url: newMcpUrl.trim() };
    const updated = [...mcpServers, server];
    setMcpServers(updated);
    saveServers(updated);
    setNewMcpName('');
    setNewMcpUrl('');
  }

  function removeMcpServer(url: string) {
    const updated = mcpServers.filter((s) => s.url !== url);
    setMcpServers(updated);
    saveServers(updated);
  }

  // All tools = local + MCP
  const allTools = [...AGENT_TOOLS, ...mcpTools];

  function handleStart() {
    if (!goal.trim()) return;
    setState(null);
    const llm = createLLM(config);
    const { promise, handle } = runAgent(goal.trim(), allTools, llm,
      (s) => setState({ ...s }),
      { maxSteps: AGENT_CONFIG.maxSteps, systemPrompt: AGENT_CONFIG.systemPrompt },
    );
    handleRef.current = handle;
    promise.catch(() => {});
  }

  const isRunning = state?.status === 'running';
  const isPaused = state?.status === 'paused';
  const isDone = state?.status === 'done' || state?.status === 'error';
  const elapsed = state?.startedAt ? ((state.completedAt ?? Date.now()) - state.startedAt) / 1000 : 0;
  const provider = PROVIDERS.find((p) => p.id === config.provider);

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800 shrink-0">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">FreeAgentStore</a>
        <h1 className="font-semibold text-lg">{AGENT_CONFIG.name}</h1>
        <span className="text-xs px-2 py-0.5 rounded bg-amber-900/40 text-amber-400">Autonomous Agent</span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setShowMcp(!showMcp)} className={`text-xs px-2 py-1 rounded ${mcpTools.length > 0 ? 'bg-emerald-900/40 text-emerald-400' : 'bg-neutral-800 text-neutral-500'} hover:brightness-125`}>
            MCP {mcpTools.length > 0 ? `(${mcpTools.length})` : ''}
          </button>
          <span className="text-xs text-neutral-500">{provider?.name ?? config.provider}</span>
          <button onClick={() => setShowSettings(!showSettings)} className="text-neutral-400 hover:text-neutral-200 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>

      {detect && !detect.ready && (
        <div className="px-4 py-3 bg-red-950/40 border-b border-red-900/50 text-sm">
          <p className="text-red-300 font-semibold mb-1">No AI backend available</p>
          <ul className="text-red-400/80 text-xs mt-1 space-y-0.5 ml-4 list-disc">
            <li><a href="https://freeagentstore.online" className="underline">Sign in</a> + add API key at <a href="https://freeagentstore.online/console/#keys" className="underline">Console</a></li>
            <li>Or run <a href="https://ollama.com" className="underline">Ollama</a> locally</li>
          </ul>
        </div>
      )}

      {/* MCP panel */}
      {showMcp && (
        <div className="border-b border-neutral-800 bg-neutral-900 px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">MCP Servers</span>
            {mcpLoading && <span className="text-xs text-violet-400">Connecting...</span>}
          </div>

          {/* Connected servers */}
          {mcpServers.map((server) => {
            const st = mcpStatus[server.url];
            return (
              <div key={server.url} className="flex items-center gap-2 text-xs">
                <span className={`w-2 h-2 rounded-full ${st?.ok ? 'bg-emerald-400' : st ? 'bg-red-400' : 'bg-neutral-600'}`} />
                <span className="font-semibold text-neutral-300">{server.name}</span>
                <span className="text-neutral-600 truncate flex-1">{server.url}</span>
                {st?.ok && <span className="text-emerald-400">{st.count} tools</span>}
                {st && !st.ok && <span className="text-red-400 truncate max-w-48" title={st.error}>{st.error}</span>}
                <button onClick={() => removeMcpServer(server.url)} className="text-neutral-600 hover:text-red-400">x</button>
              </div>
            );
          })}

          {/* Available MCP tools */}
          {mcpTools.length > 0 && (
            <div className="text-xs text-neutral-500">
              Tools: {mcpTools.map((t) => t.name).join(', ')}
            </div>
          )}

          {/* Add server form */}
          <div className="flex gap-2">
            <input value={newMcpName} onChange={(e) => setNewMcpName(e.target.value)} placeholder="Name (e.g. My MCP)" className="px-2 py-1.5 rounded-lg bg-neutral-950 border border-neutral-700 text-xs flex-1" />
            <input value={newMcpUrl} onChange={(e) => setNewMcpUrl(e.target.value)} placeholder="URL (e.g. https://mcp.example.com/mcp)" className="px-2 py-1.5 rounded-lg bg-neutral-950 border border-neutral-700 text-xs flex-[2]"
              onKeyDown={(e) => { if (e.key === 'Enter') addMcpServer(); }} />
            <button onClick={addMcpServer} disabled={!newMcpName.trim() || !newMcpUrl.trim()} className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold disabled:opacity-40">Add</button>
          </div>

          <p className="text-[10px] text-neutral-600">
            Connect to any MCP server (Streamable HTTP). Tools are auto-discovered and available to the LLM alongside local tools. CORS-blocked servers are proxied via the platform.
          </p>
        </div>
      )}

      {/* Settings */}
      {showSettings && (
        <div className="border-b border-neutral-800 bg-neutral-900 px-4 py-3">
          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <label className="text-xs text-neutral-400 block mb-1">Provider</label>
              <select value={config.provider} onChange={(e) => { const p = PROVIDERS.find((x) => x.id === e.target.value); setConfig({ provider: e.target.value, model: p?.models[0] ?? '' }); }} className="px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-700 text-sm">
                {PROVIDERS.filter((p) => p.capable).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-neutral-400 block mb-1">Model</label>
              <select value={config.model} onChange={(e) => setConfig({ ...config, model: e.target.value })} className="px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-700 text-sm">
                {(PROVIDERS.find((p) => p.id === config.provider)?.models ?? []).map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          {detect && (
            <div className="mt-2 text-xs text-neutral-500 space-x-3">
              <span>Session: {detect.hasSession ? 'yes' : 'no'}</span>
              <span>Ollama: {detect.hasOllama ? 'yes' : 'no'}</span>
            </div>
          )}
        </div>
      )}

      {/* Goal input */}
      <div className="border-b border-neutral-800 px-4 py-3">
        <div className="flex gap-2 max-w-4xl mx-auto">
          <textarea value={goal} onChange={(e) => setGoal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !isRunning) { e.preventDefault(); handleStart(); } }}
            placeholder={AGENT_CONFIG.placeholder} rows={2} disabled={isRunning || isPaused}
            className="flex-1 px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-sm resize-none focus:outline-none focus:border-violet-600 placeholder:text-neutral-600 disabled:opacity-50" />
          <div className="flex flex-col gap-1">
            {!isRunning && !isPaused && <button onClick={handleStart} disabled={!goal.trim()} className="px-5 py-2.5 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-500 disabled:opacity-40">Start</button>}
            {isRunning && <>
              <button onClick={() => handleRef.current?.pause()} className="px-4 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold">Pause</button>
              <button onClick={() => handleRef.current?.stop()} className="px-4 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold">Stop</button>
            </>}
            {isPaused && <>
              <button onClick={() => handleRef.current?.resume()} className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold">Resume</button>
              <button onClick={() => handleRef.current?.stop()} className="px-4 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold">Stop</button>
            </>}
          </div>
        </div>
      </div>

      {/* Status bar */}
      {state && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-neutral-800 bg-neutral-900/50 text-xs">
          <StatusBadge status={state.status} />
          <span className="text-neutral-500">Step {state.steps.length} / {AGENT_CONFIG.maxSteps}</span>
          <span className="text-neutral-600">{elapsed.toFixed(1)}s</span>
          <span className="text-neutral-600">{allTools.length} tools ({AGENT_TOOLS.length} local + {mcpTools.length} MCP)</span>
          {isRunning && <span className="ml-auto flex items-center gap-1.5 text-violet-400">
            <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" /></span>
            Live
          </span>}
        </div>
      )}

      {/* Activity log */}
      <div ref={logRef} className="flex-1 overflow-y-auto">
        {!state && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="text-4xl mb-4">{AGENT_CONFIG.icon}</div>
            <h2 className="text-xl font-semibold mb-2">{AGENT_CONFIG.name}</h2>
            <p className="text-neutral-500 text-sm max-w-md mb-4">{AGENT_CONFIG.description}</p>
            <p className="text-xs text-neutral-600 mb-1">Local tools: {AGENT_TOOLS.map((t) => t.name).join(', ')}</p>
            {mcpTools.length > 0 && <p className="text-xs text-emerald-600">MCP tools: {mcpTools.map((t) => t.name).join(', ')}</p>}
            {mcpServers.length === 0 && <p className="text-xs text-neutral-700 mt-2">Click <strong>MCP</strong> in the header to connect MCP servers for more tools.</p>}
          </div>
        )}

        {state && (
          <div className="max-w-4xl mx-auto p-4 space-y-1">
            <div className="flex gap-2 py-1 font-mono text-xs">
              <span className="text-neutral-500 font-semibold">[GOAL]</span>
              <span className="text-neutral-300">{state.goal}</span>
            </div>

            {state.steps.map((step, i) => (
              <StepLog key={step.id} step={step} isLast={i === state.steps.length - 1 && isRunning} />
            ))}

            {isDone && state.output && (
              <div className="mt-3 border border-neutral-700 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-neutral-800">
                  <span className="text-xs font-semibold text-emerald-400">RESULT</span>
                  <button onClick={() => navigator.clipboard.writeText(state.output ?? '')} className="text-xs text-neutral-500 hover:text-neutral-300">Copy</button>
                </div>
                <pre className="p-3 text-sm text-neutral-200 whitespace-pre-wrap font-mono leading-relaxed bg-neutral-900/50">{state.output}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StepLog({ step, isLast }: { step: Step; isLast: boolean }) {
  const isActive = isLast && (step.status === 'thinking' || step.status === 'acting');
  return (
    <div className="border-l-2 border-neutral-800 ml-2 pl-3 py-1 space-y-1">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-mono font-bold text-neutral-500">Step {step.id}</span>
        {step.duration != null && <span className="text-neutral-600">{(step.duration / 1000).toFixed(1)}s</span>}
        {isActive && step.status === 'thinking' && (
          <span className="flex items-center gap-1 text-violet-400">
            <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-violet-500" /></span>
            calling LLM...
          </span>
        )}
        {isActive && step.status === 'acting' && (
          <span className="flex items-center gap-1 text-blue-400">
            <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500" /></span>
            executing {step.toolCalls.map((tc) => tc.name).join(', ')}...
          </span>
        )}
      </div>
      {step.thought && (
        <div className="text-sm text-neutral-300 whitespace-pre-wrap leading-relaxed pl-1 border-l border-violet-900/50 ml-0.5">{step.thought}</div>
      )}
      {step.toolCalls.map((tc, j) => (
        <div key={j} className="ml-0.5 space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <span className={`font-semibold font-mono ${tc.name.startsWith('[') ? 'text-emerald-400' : 'text-blue-400'}`}>{tc.name}</span>
          </div>
          <pre className="text-xs text-blue-300/80 bg-blue-950/20 border border-blue-900/30 rounded-md p-2 overflow-x-auto font-mono">{JSON.stringify(tc.input, null, 2)}</pre>
          {tc.result != null && (
            <pre className="text-xs text-emerald-300/70 bg-emerald-950/20 border border-emerald-900/30 rounded-md p-2 overflow-x-auto font-mono max-h-64 overflow-y-auto">{tc.result}</pre>
          )}
          {tc.error && (
            <pre className="text-xs text-red-300/80 bg-red-950/20 border border-red-900/30 rounded-md p-2">{tc.error}</pre>
          )}
        </div>
      ))}
      {step.error && (
        <div className="text-xs text-red-400 bg-red-950/20 border border-red-900/30 rounded-md p-2">{step.error}</div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: AgentState['status'] }) {
  const styles: Record<string, string> = {
    idle: 'bg-neutral-800 text-neutral-400', running: 'bg-violet-900/40 text-violet-400',
    paused: 'bg-amber-900/40 text-amber-400', done: 'bg-emerald-900/40 text-emerald-400',
    error: 'bg-red-900/40 text-red-400',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] ?? styles.idle}`}>{status.toUpperCase()}</span>;
}
