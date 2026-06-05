import { useState } from 'react';
import { parseResume, getEvolutionHistory } from './parser';

export default function App() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<ReturnType<typeof parseResume> | null>(null);
  const history = getEvolutionHistory();

  const handleParse = () => {
    if (!text.trim()) return;
    setResult(parseResume(text));
  };

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">FreeAgentStore</a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>Resume Parser</h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-pink-900/40 text-pink-400">v7 — {history[history.length-1].accuracy ?? history[history.length-1].score * 100}% accuracy</span>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row max-w-5xl mx-auto w-full p-4 gap-4">
        <div className="flex-1 flex flex-col gap-2">
          <label className="text-sm text-neutral-400">Paste resume text</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"John Smith\njohn@email.com | (415) 555-1234\n\nExperience\nSenior Engineer at Acme Corp\nJan 2021 - Present\n- Built scalable APIs\n\nSkills\nJavaScript, React, Node.js, Python\n\nEducation\nBS Computer Science - Stanford\n2014 - 2018"}
            className="flex-1 min-h-[300px] p-4 rounded-lg bg-neutral-900 border border-neutral-800 resize-none focus:outline-none focus:border-pink-600 text-neutral-100 placeholder:text-neutral-600 font-mono text-sm"
          />
          <button onClick={handleParse} disabled={!text.trim()}
            className="px-4 py-2.5 rounded-lg font-semibold text-white disabled:opacity-40 transition-colors"
            style={{ backgroundColor: '#be185d' }}>
            Parse Resume
          </button>
        </div>

        <div className="flex-1 flex flex-col gap-2">
          <label className="text-sm text-neutral-400">Structured output</label>
          {result ? (
            <div className="flex-1 p-4 rounded-lg bg-neutral-900 border border-neutral-800 overflow-auto max-h-[500px] text-sm space-y-3">
              {result.name && <Field label="Name" value={result.name} />}
              {result.email && <Field label="Email" value={result.email} />}
              {result.phone && <Field label="Phone" value={result.phone} />}
              {result.location && <Field label="Location" value={result.location} />}
              {result.linkedin && <Field label="LinkedIn" value={result.linkedin} />}
              {result.summary && <Field label="Summary" value={result.summary} />}
              {result.skills.length > 0 && (
                <div>
                  <span className="text-neutral-500 text-xs">Skills</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {result.skills.map((s, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-pink-900/30 text-pink-300 text-xs">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {result.experience.length > 0 && (
                <div>
                  <span className="text-neutral-500 text-xs">Experience ({result.experience.length})</span>
                  {result.experience.map((e, i) => (
                    <div key={i} className="mt-1 p-2 rounded bg-neutral-800/50 text-xs">
                      <div className="font-semibold">{e.title}</div>
                      {e.company && <div className="text-neutral-400">{e.company}</div>}
                      {e.dates && <div className="text-neutral-500">{e.dates}</div>}
                    </div>
                  ))}
                </div>
              )}
              {result.education.length > 0 && (
                <div>
                  <span className="text-neutral-500 text-xs">Education ({result.education.length})</span>
                  {result.education.map((e, i) => (
                    <div key={i} className="mt-1 p-2 rounded bg-neutral-800/50 text-xs">
                      <div className="font-semibold">{e.degree}</div>
                      {e.institution && <div className="text-neutral-400">{e.institution}</div>}
                    </div>
                  ))}
                </div>
              )}
              {result.certifications.length > 0 && <Field label="Certifications" value={result.certifications.join(', ')} />}
            </div>
          ) : (
            <div className="flex-1 p-4 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-600 text-sm">
              Paste a resume and click "Parse Resume"
            </div>
          )}
        </div>
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Heuristic agent — evolved from {history[history.length-1].examples} resumes over {history.length} versions.
        <a href="https://github.com/FreeAgentStore/platform/tree/main/packages/agents/resume-parser" className="underline ml-1">View evolution history</a>
      </footer>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-neutral-500 text-xs">{label}</span>
      <div className="text-neutral-200">{value}</div>
    </div>
  );
}
