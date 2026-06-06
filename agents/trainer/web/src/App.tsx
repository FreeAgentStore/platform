import { useState, useCallback, useEffect } from 'react';
import {
  type Example, type EvolutionEntry, type EvalResult,
  evaluate, evolve,
} from './evolve';
import {
  type TrainerProject,
  loadProjects, saveProjects, createProject, exportProject, importProject,
  STARTER_TEMPLATES,
} from './store';

export default function App() {
  const [projects, setProjects] = useState<TrainerProject[]>(() => loadProjects());
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = projects.find(p => p.id === activeId) ?? null;

  const persist = useCallback((updated: TrainerProject[]) => {
    setProjects(updated);
    saveProjects(updated);
  }, []);

  const updateActive = useCallback((fn: (p: TrainerProject) => TrainerProject) => {
    if (!activeId) return;
    persist(projects.map(p => p.id === activeId ? fn(p) : p));
  }, [activeId, projects, persist]);

  // No project selected — show project list
  if (!active) {
    return (
      <Shell>
        <ProjectList
          projects={projects}
          onSelect={setActiveId}
          onCreate={(spec, examples) => {
            const p = createProject(spec);
            p.examples = examples ?? [];
            const updated = [...projects, p];
            persist(updated);
            setActiveId(p.id);
          }}
          onImport={(json) => {
            const p = importProject(json);
            const updated = [...projects, p];
            persist(updated);
            setActiveId(p.id);
          }}
          onDelete={(id) => persist(projects.filter(p => p.id !== id))}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <TrainerWorkbench
        project={active}
        onBack={() => setActiveId(null)}
        onUpdate={updateActive}
      />
    </Shell>
  );
}

// --- Shell ---

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">FreeAgentStore</a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>Heuristic Trainer</h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">Feed data. Evolve code. Ship agents.</span>
      </header>
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}

// --- Project List ---

function ProjectList({ projects, onSelect, onCreate, onImport, onDelete }: {
  projects: TrainerProject[];
  onSelect: (id: string) => void;
  onCreate: (spec: TrainerProject['spec'], examples?: Example[]) => void;
  onImport: (json: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="max-w-3xl mx-auto w-full p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Your Projects</h2>
        <p className="text-sm text-neutral-500">Each project trains one heuristic agent. Pick a starter or create from scratch.</p>
      </div>

      {/* Existing projects */}
      {projects.length > 0 && (
        <div className="space-y-2">
          {projects.map(p => (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 cursor-pointer"
              onClick={() => onSelect(p.id)}>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{p.spec.name}</div>
                <div className="text-xs text-neutral-500 truncate">{p.spec.description}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-neutral-500">{p.examples.length} examples</div>
                {p.history.length > 0 && (
                  <div className="text-xs font-mono text-emerald-400">
                    {(p.history[p.history.length - 1].score * 100).toFixed(0)}%
                  </div>
                )}
              </div>
              <button onClick={e => { e.stopPropagation(); onDelete(p.id); }}
                className="text-neutral-600 hover:text-red-400 text-xs px-2 py-1">Delete</button>
            </div>
          ))}
        </div>
      )}

      {/* Starters */}
      <div>
        <h3 className="text-sm font-semibold text-neutral-400 mb-3">Start from a template</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {STARTER_TEMPLATES.map(t => (
            <button key={t.name} onClick={() => onCreate(t.spec, t.examples)}
              className="p-4 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-violet-600 text-left transition-colors">
              <div className="font-semibold text-sm">{t.name}</div>
              <div className="text-xs text-neutral-500 mt-1">{t.spec.description.slice(0, 80)}...</div>
              <div className="text-xs text-neutral-600 mt-2">{t.examples.length} starter examples</div>
            </button>
          ))}
        </div>
      </div>

      {/* Create blank */}
      <div className="flex gap-3">
        <button onClick={() => onCreate({ name: 'my-agent', description: 'Describe what this agent does...', inputType: 'string', outputType: 'unknown' })}
          className="px-4 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm text-neutral-300 hover:text-neutral-100 transition-colors">
          Blank Project
        </button>
        <button onClick={() => {
          const input = prompt('Paste exported project JSON:');
          if (input) { try { onImport(input); } catch (e) { alert(`Import failed: ${e}`); } }
        }}
          className="px-4 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm text-neutral-300 hover:text-neutral-100 transition-colors">
          Import JSON
        </button>
      </div>
    </div>
  );
}

// --- Trainer Workbench ---

type Tab = 'examples' | 'code' | 'test' | 'history' | 'settings';

function TrainerWorkbench({ project, onBack, onUpdate }: {
  project: TrainerProject;
  onBack: () => void;
  onUpdate: (fn: (p: TrainerProject) => TrainerProject) => void;
}) {
  const [tab, setTab] = useState<Tab>('examples');
  const [evolving, setEvolving] = useState(false);
  const [status, setStatus] = useState('');
  const [lastEval, setLastEval] = useState<EvalResult | null>(null);

  // Auto-evaluate when code or examples change
  useEffect(() => {
    if (project.currentCode && project.examples.length > 0) {
      setLastEval(evaluate(project.currentCode, project.examples, project.spec.scoreFn));
    } else {
      setLastEval(null);
    }
  }, [project.currentCode, project.examples, project.spec.scoreFn]);

  const handleEvolve = useCallback(async () => {
    if (project.examples.length === 0) { alert('Add examples first.'); return; }
    setEvolving(true);
    setStatus('Starting evolution...');
    try {
      const { code, source, evalResult } = await evolve(
        project.spec,
        project.examples,
        project.currentCode || undefined,
        project.aiConfig,
        setStatus,
      );

      const entry: EvolutionEntry = {
        version: project.history.length + 1,
        code,
        score: evalResult.score,
        passed: evalResult.passed,
        total: evalResult.total,
        source,
        timestamp: Date.now(),
      };

      // Keep the better code
      const prevScore = lastEval?.score ?? 0;
      const improved = evalResult.score >= prevScore;

      onUpdate(p => ({
        ...p,
        currentCode: improved ? code : p.currentCode,
        history: [...p.history, entry],
        updatedAt: Date.now(),
      }));

      setStatus(improved
        ? `Improved: ${(prevScore * 100).toFixed(0)}% -> ${(evalResult.score * 100).toFixed(0)}% (${source})`
        : `No improvement: ${(evalResult.score * 100).toFixed(0)}% (kept previous, ${source})`
      );
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setEvolving(false);
    }
  }, [project, lastEval, onUpdate]);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'examples', label: `Examples (${project.examples.length})` },
    { key: 'code', label: 'Code' },
    { key: 'test', label: 'Test' },
    { key: 'history', label: `History (${project.history.length})` },
    { key: 'settings', label: 'Settings' },
  ];

  return (
    <div className="flex-1 flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-neutral-800 bg-neutral-900/50">
        <button onClick={onBack} className="text-xs text-neutral-500 hover:text-neutral-300">Back</button>
        <span className="font-semibold text-sm">{project.spec.name}</span>

        {lastEval && (
          <span className={`text-xs font-mono px-2 py-0.5 rounded ${
            lastEval.score > 0.8 ? 'bg-emerald-950 text-emerald-400'
            : lastEval.score > 0.5 ? 'bg-amber-950 text-amber-400'
            : 'bg-neutral-800 text-neutral-400'
          }`}>
            {(lastEval.score * 100).toFixed(0)}% ({lastEval.passed}/{lastEval.total})
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {status && <span className="text-xs text-neutral-500 max-w-[300px] truncate">{status}</span>}
          <button onClick={handleEvolve} disabled={evolving}
            className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold disabled:opacity-40 transition-colors">
            {evolving ? 'Evolving...' : 'Evolve'}
          </button>
          <button onClick={() => navigator.clipboard.writeText(exportProject(project))}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-400 text-xs hover:text-neutral-200">Export</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 pt-2 bg-neutral-950">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-xs font-medium rounded-t-lg transition-colors ${
              tab === t.key ? 'bg-neutral-900 text-neutral-100 border border-neutral-800 border-b-0' : 'text-neutral-500 hover:text-neutral-300'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 bg-neutral-900 border-t border-neutral-800 overflow-auto">
        {tab === 'examples' && (
          <ExamplesTab
            examples={project.examples}
            lastEval={lastEval}
            onChange={examples => onUpdate(p => ({ ...p, examples, updatedAt: Date.now() }))}
          />
        )}
        {tab === 'code' && (
          <CodeTab
            code={project.currentCode}
            onChange={code => onUpdate(p => ({ ...p, currentCode: code, updatedAt: Date.now() }))}
          />
        )}
        {tab === 'test' && (
          <TestTab project={project} lastEval={lastEval} />
        )}
        {tab === 'history' && (
          <HistoryTab
            history={project.history}
            onRestore={code => onUpdate(p => ({ ...p, currentCode: code, updatedAt: Date.now() }))}
          />
        )}
        {tab === 'settings' && (
          <SettingsTab
            spec={project.spec}
            aiConfig={project.aiConfig}
            onSpecChange={spec => onUpdate(p => ({ ...p, spec, updatedAt: Date.now() }))}
            onAIConfigChange={aiConfig => onUpdate(p => ({ ...p, aiConfig, updatedAt: Date.now() }))}
          />
        )}
      </div>
    </div>
  );
}

// --- Examples Tab ---

function ExamplesTab({ examples, lastEval, onChange }: {
  examples: Example[];
  lastEval: EvalResult | null;
  onChange: (examples: Example[]) => void;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const [newInput, setNewInput] = useState('');
  const [newOutput, setNewOutput] = useState('');

  const addExample = () => {
    if (!newInput.trim() || !newOutput.trim()) return;
    try {
      JSON.parse(newInput); JSON.parse(newOutput);
    } catch {
      alert('Input and Output must be valid JSON.');
      return;
    }
    const ex: Example = { id: crypto.randomUUID(), input: newInput.trim(), expectedOutput: newOutput.trim(), weight: 1 };
    onChange([...examples, ex]);
    setNewInput('');
    setNewOutput('');
  };

  return (
    <div className="p-4 space-y-4">
      {/* Add new */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-neutral-500 block mb-1">Input (JSON)</label>
          <textarea value={newInput} onChange={e => setNewInput(e.target.value)}
            placeholder='e.g. "<form><input type=password /></form>"'
            className="w-full h-20 p-2 rounded-lg bg-neutral-950 border border-neutral-800 font-mono text-xs resize-y focus:outline-none focus:border-violet-600 text-neutral-100 placeholder:text-neutral-600" />
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1">Expected Output (JSON)</label>
          <textarea value={newOutput} onChange={e => setNewOutput(e.target.value)}
            placeholder='e.g. { "isLogin": true, "confidence": 0.9 }'
            className="w-full h-20 p-2 rounded-lg bg-neutral-950 border border-neutral-800 font-mono text-xs resize-y focus:outline-none focus:border-violet-600 text-neutral-100 placeholder:text-neutral-600" />
        </div>
      </div>
      <button onClick={addExample}
        className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors">
        Add Example
      </button>

      {/* List */}
      <div className="divide-y divide-neutral-800">
        {examples.map(ex => {
          const result = lastEval?.results.find(r => r.id === ex.id);
          return (
            <div key={ex.id} className="py-3 flex gap-3 items-start">
              <div className="w-5 pt-0.5">
                {result ? (
                  result.passed
                    ? <span className="text-emerald-400 text-sm">P</span>
                    : <span className="text-red-400 text-sm">F</span>
                ) : <span className="text-neutral-700 text-sm">-</span>}
              </div>
              <div className="flex-1 min-w-0 grid grid-cols-2 gap-2">
                {editId === ex.id ? (
                  <>
                    <textarea value={ex.input}
                      onChange={e => onChange(examples.map(x => x.id === ex.id ? { ...x, input: e.target.value } : x))}
                      className="p-2 rounded bg-neutral-950 border border-neutral-800 font-mono text-xs resize-y focus:outline-none focus:border-violet-600" />
                    <textarea value={ex.expectedOutput}
                      onChange={e => onChange(examples.map(x => x.id === ex.id ? { ...x, expectedOutput: e.target.value } : x))}
                      className="p-2 rounded bg-neutral-950 border border-neutral-800 font-mono text-xs resize-y focus:outline-none focus:border-violet-600" />
                  </>
                ) : (
                  <>
                    <pre className="font-mono text-xs text-neutral-300 whitespace-pre-wrap break-all overflow-hidden max-h-20">{ex.input}</pre>
                    <pre className="font-mono text-xs text-neutral-400 whitespace-pre-wrap break-all overflow-hidden max-h-20">{ex.expectedOutput}</pre>
                  </>
                )}
                {result && !result.passed && (
                  <div className="col-span-2 text-xs text-red-400 font-mono">
                    Got: {result.actual}{result.error ? ` (${result.error})` : ''}
                  </div>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => setEditId(editId === ex.id ? null : ex.id)}
                  className="text-xs text-neutral-600 hover:text-neutral-300 px-1">{editId === ex.id ? 'Done' : 'Edit'}</button>
                <button onClick={() => onChange(examples.filter(x => x.id !== ex.id))}
                  className="text-xs text-neutral-600 hover:text-red-400 px-1">Del</button>
              </div>
            </div>
          );
        })}
        {examples.length === 0 && (
          <div className="py-8 text-center text-neutral-600 text-sm">
            No examples yet. Add input/output pairs above, then hit Evolve.
          </div>
        )}
      </div>
    </div>
  );
}

// --- Code Tab ---

function CodeTab({ code, onChange }: { code: string; onChange: (code: string) => void }) {
  return (
    <div className="p-4 flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-500">Heuristic function body (JavaScript)</span>
        <button onClick={() => navigator.clipboard.writeText(code)}
          className="text-xs px-2 py-1 rounded bg-neutral-800 text-neutral-400 hover:text-neutral-200">Copy</button>
      </div>
      <textarea value={code} onChange={e => onChange(e.target.value)}
        placeholder="// Code will appear here after evolution.&#10;// Or paste your own code to test."
        className="flex-1 min-h-[400px] p-4 rounded-lg bg-neutral-950 border border-neutral-800 font-mono text-sm resize-y focus:outline-none focus:border-violet-600 text-neutral-100 placeholder:text-neutral-600"
        spellCheck={false} />
    </div>
  );
}

// --- Test Tab ---

function TestTab({ project, lastEval }: { project: TrainerProject; lastEval: EvalResult | null }) {
  const [manualInput, setManualInput] = useState('');
  const [manualResult, setManualResult] = useState<string | null>(null);

  const runManual = () => {
    if (!project.currentCode || !manualInput.trim()) return;
    try {
      const fn = new Function('input', project.currentCode) as (input: unknown) => unknown;
      const input = JSON.parse(manualInput);
      const result = fn(input);
      setManualResult(JSON.stringify(result, null, 2));
    } catch (e) {
      setManualResult(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Manual test */}
      <div>
        <h3 className="text-sm font-semibold text-neutral-400 mb-2">Run ad-hoc test</h3>
        <div className="flex gap-3">
          <textarea value={manualInput} onChange={e => setManualInput(e.target.value)}
            placeholder="Paste input JSON..."
            className="flex-1 h-24 p-2 rounded-lg bg-neutral-950 border border-neutral-800 font-mono text-xs resize-y focus:outline-none focus:border-violet-600" />
          <div className="flex flex-col gap-2">
            <button onClick={runManual} disabled={!project.currentCode}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-40">
              Run
            </button>
          </div>
        </div>
        {manualResult && (
          <pre className="mt-2 p-3 rounded-lg bg-neutral-950 border border-neutral-800 font-mono text-xs text-emerald-400 whitespace-pre-wrap max-h-48 overflow-auto">
            {manualResult}
          </pre>
        )}
      </div>

      {/* Results grid */}
      {lastEval && (
        <div>
          <h3 className="text-sm font-semibold text-neutral-400 mb-2">
            Test Results — {(lastEval.score * 100).toFixed(0)}% ({lastEval.passed}/{lastEval.total})
          </h3>
          <div className="flex gap-1 mb-3">
            {lastEval.results.map(r => (
              <div key={r.id}
                className={`h-3 flex-1 rounded-sm ${r.passed ? 'bg-emerald-500' : 'bg-red-500'}`}
                title={`${r.id}: ${r.passed ? 'PASS' : 'FAIL'} (${r.timeMs.toFixed(1)}ms)`} />
            ))}
          </div>
          <div className="space-y-1">
            {lastEval.results.map(r => {
              const ex = project.examples.find(e => e.id === r.id);
              return (
                <div key={r.id} className={`p-2 rounded text-xs font-mono ${r.passed ? 'bg-neutral-950 text-neutral-400' : 'bg-red-950/30 text-red-300'}`}>
                  <span className={r.passed ? 'text-emerald-400' : 'text-red-400'}>{r.passed ? 'PASS' : 'FAIL'}</span>
                  <span className="text-neutral-600 ml-2">{r.timeMs.toFixed(1)}ms</span>
                  {!r.passed && ex && (
                    <div className="mt-1 text-red-400/70">
                      Expected: {ex.expectedOutput.slice(0, 100)}
                      <br />Got: {r.actual.slice(0, 100)}{r.error ? ` (${r.error})` : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!lastEval && (
        <div className="text-center text-neutral-600 text-sm py-8">
          Add examples and evolve code to see test results.
        </div>
      )}
    </div>
  );
}

// --- History Tab ---

function HistoryTab({ history, onRestore }: { history: EvolutionEntry[]; onRestore: (code: string) => void }) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="p-4">
      {history.length === 0 ? (
        <div className="text-center text-neutral-600 text-sm py-8">No evolution history yet. Hit Evolve to start.</div>
      ) : (
        <div className="space-y-2">
          {[...history].reverse().map(entry => (
            <div key={entry.version} className="rounded-lg bg-neutral-950 border border-neutral-800 overflow-hidden">
              <div className="flex items-center gap-3 p-3 cursor-pointer"
                onClick={() => setExpanded(expanded === entry.version ? null : entry.version)}>
                <span className="text-xs font-mono text-neutral-500">v{entry.version}</span>
                <span className={`text-sm font-mono font-bold ${
                  entry.score > 0.8 ? 'text-emerald-400' : entry.score > 0.5 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {(entry.score * 100).toFixed(0)}%
                </span>
                <span className="text-xs text-neutral-500">{entry.passed}/{entry.total} passed</span>
                <span className="text-xs text-neutral-600">{entry.source}</span>
                <span className="text-xs text-neutral-700 ml-auto">{new Date(entry.timestamp).toLocaleString()}</span>
                <button onClick={e => { e.stopPropagation(); onRestore(entry.code); }}
                  className="text-xs px-2 py-1 rounded bg-neutral-800 text-neutral-400 hover:text-emerald-400">Restore</button>
              </div>
              {expanded === entry.version && (
                <pre className="p-3 border-t border-neutral-800 font-mono text-xs text-neutral-400 max-h-60 overflow-auto whitespace-pre-wrap">
                  {entry.code}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Score chart */}
      {history.length > 1 && (
        <div className="mt-6">
          <h3 className="text-xs text-neutral-500 mb-2">Score over time</h3>
          <div className="flex items-end gap-1 h-20">
            {history.map(entry => (
              <div key={entry.version} className="flex-1 flex flex-col items-center">
                <div className={`w-full rounded-t-sm ${
                  entry.score > 0.8 ? 'bg-emerald-500' : entry.score > 0.5 ? 'bg-amber-500' : 'bg-red-500'
                }`} style={{ height: `${entry.score * 100}%` }} />
                <span className="text-[9px] text-neutral-600 mt-1">v{entry.version}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Settings Tab ---

function SettingsTab({ spec, aiConfig, onSpecChange, onAIConfigChange }: {
  spec: TrainerProject['spec'];
  aiConfig: TrainerProject['aiConfig'];
  onSpecChange: (spec: TrainerProject['spec']) => void;
  onAIConfigChange: (config: TrainerProject['aiConfig']) => void;
}) {
  return (
    <div className="p-4 max-w-2xl space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-neutral-400 mb-3">Agent Spec</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-neutral-500 block mb-1">Name</label>
            <input value={spec.name} onChange={e => onSpecChange({ ...spec, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-sm focus:outline-none focus:border-violet-600" />
          </div>
          <div>
            <label className="text-xs text-neutral-500 block mb-1">Description (what the LLM sees)</label>
            <textarea value={spec.description} onChange={e => onSpecChange({ ...spec, description: e.target.value })}
              className="w-full h-20 px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-sm resize-y focus:outline-none focus:border-violet-600" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-neutral-500 block mb-1">Input Type</label>
              <input value={spec.inputType} onChange={e => onSpecChange({ ...spec, inputType: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-sm font-mono focus:outline-none focus:border-violet-600" />
            </div>
            <div>
              <label className="text-xs text-neutral-500 block mb-1">Output Type</label>
              <input value={spec.outputType} onChange={e => onSpecChange({ ...spec, outputType: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-sm font-mono focus:outline-none focus:border-violet-600" />
            </div>
          </div>
          <div>
            <label className="text-xs text-neutral-500 block mb-1">Custom Scoring Function (optional, JS body with <code>actual</code> and <code>expected</code> params, return 0-1)</label>
            <textarea value={spec.scoreFn ?? ''} onChange={e => onSpecChange({ ...spec, scoreFn: e.target.value || undefined })}
              placeholder="return JSON.stringify(actual) === JSON.stringify(expected) ? 1 : 0;"
              className="w-full h-16 px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-xs font-mono resize-y focus:outline-none focus:border-violet-600" />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-neutral-400 mb-3">AI Source</h3>
        <p className="text-xs text-neutral-600 mb-3">
          Priority: Chrome Built-in AI (auto) &gt; Ollama (auto) &gt; OpenAI-compatible API (requires key).
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-neutral-500 block mb-1">Ollama Model (default: llama3.2)</label>
            <input value={aiConfig.ollamaModel ?? ''} onChange={e => onAIConfigChange({ ...aiConfig, ollamaModel: e.target.value || undefined })}
              placeholder="llama3.2"
              className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-sm font-mono focus:outline-none focus:border-violet-600" />
          </div>
          <div>
            <label className="text-xs text-neutral-500 block mb-1">OpenAI API Key</label>
            <input type="password" value={aiConfig.openaiKey ?? ''} onChange={e => onAIConfigChange({ ...aiConfig, openaiKey: e.target.value || undefined })}
              placeholder="sk-..."
              className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-sm font-mono focus:outline-none focus:border-violet-600" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-neutral-500 block mb-1">Base URL</label>
              <input value={aiConfig.openaiBaseUrl ?? ''} onChange={e => onAIConfigChange({ ...aiConfig, openaiBaseUrl: e.target.value || undefined })}
                placeholder="https://api.openai.com/v1"
                className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-sm font-mono focus:outline-none focus:border-violet-600" />
            </div>
            <div>
              <label className="text-xs text-neutral-500 block mb-1">Model</label>
              <input value={aiConfig.openaiModel ?? ''} onChange={e => onAIConfigChange({ ...aiConfig, openaiModel: e.target.value || undefined })}
                placeholder="gpt-4o-mini"
                className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-sm font-mono focus:outline-none focus:border-violet-600" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
