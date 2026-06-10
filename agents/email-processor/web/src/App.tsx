import { useState, useEffect, useRef } from 'react';
import { runAgent, type AgentState, type AgentHandle, type Step } from './agent-loop';
import { createLLM, detectProvider, PROVIDERS, type LLMConfig, type DetectResult } from './inference';
import { AGENT_TOOLS } from './tools';
import { AGENT_CONFIG } from './config';

export default function App() {
  const [goal, setGoal] = useState('');
  const [state, setState] = useState<AgentState | null>(null);
  const [config, setConfig] = useState<LLMConfig>({ provider: 'openai', model: 'gpt-4o-mini' });
  const [detect, setDetect] = useState<DetectResult | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const handleRef = useRef<AgentHandle | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => { detectProvider().then((r) => { setConfig(r.config); setDetect(r); }); }, []);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; });

  function handleStart() {
    if (!goal.trim()) return;
    setState(null);
    const llm = createLLM(config);
    const { promise, handle } = runAgent(goal.trim(), AGENT_TOOLS, llm,
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

      {state && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-neutral-800 bg-neutral-900/50 text-xs">
          <StatusBadge status={state.status} />
          <span className="text-neutral-500">Step {state.steps.length} / {AGENT_CONFIG.maxSteps}</span>
          <span className="text-neutral-600">{elapsed.toFixed(1)}s</span>
          {isRunning && <span className="ml-auto flex items-center gap-1.5 text-violet-400">
            <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" /></span>
            Live
          </span>}
        </div>
      )}

      <div ref={logRef} className="flex-1 overflow-y-auto">
        {!state && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="text-4xl mb-4">{AGENT_CONFIG.icon}</div>
            <h2 className="text-xl font-semibold mb-2">{AGENT_CONFIG.name}</h2>
            <p className="text-neutral-500 text-sm max-w-md mb-6">{AGENT_CONFIG.description}</p>
            <p className="text-xs text-neutral-600">Tools: {AGENT_TOOLS.map((t) => t.name).join(', ')}</p>
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
        <div className="text-sm text-neutral-300 whitespace-pre-wrap leading-relaxed pl-1 border-l border-violet-900/50 ml-0.5">
          {step.thought}
        </div>
      )}

      {step.toolCalls.map((tc, j) => (
        <div key={j} className="ml-0.5 space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-blue-400 font-semibold font-mono">{tc.name}</span>
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
