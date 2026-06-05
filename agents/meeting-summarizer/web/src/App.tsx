import { useState, useRef, useCallback, useEffect } from 'react';
import { analyzeMeeting, type MeetingResult } from './summarizer';

type State = 'idle' | 'loading' | 'ready' | 'recording' | 'transcribing' | 'analyzing';
type Tab = 'transcript' | 'summary' | 'decisions' | 'actions' | 'topics';

export default function App() {
  const [state, setState] = useState<State>('idle');
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<Tab>('transcript');
  const [result, setResult] = useState<MeetingResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const workerRef = useRef<Worker | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number>(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const init = useCallback(() => {
    setState('loading');
    const w = new Worker('./whisper-worker.js', { type: 'module' });
    workerRef.current = w;
    w.onmessage = (e) => {
      if (e.data.type === 'progress') setProgress(e.data.pct);
      if (e.data.type === 'ready') setState('ready');
      if (e.data.type === 'result') {
        setState('analyzing');
        const meeting = analyzeMeeting(e.data.text, e.data.chunks ?? []);
        setResult(meeting);
        setActiveTab('transcript');
        setState('ready');
      }
      if (e.data.type === 'error') {
        console.error(e.data.error);
        setState('ready');
      }
    };
    w.postMessage({ type: 'init' });
  }, []);

  const processAudio = useCallback((blob: Blob, name: string) => {
    if (!workerRef.current) return;
    setState('transcribing');
    setResult(null);
    setFileName(name);
    const blobUrl = URL.createObjectURL(blob);
    workerRef.current.postMessage({ type: 'transcribe', id: crypto.randomUUID(), audio: blobUrl });
  }, []);

  const handleFile = useCallback((file: File) => {
    processAudio(file, file.name);
  }, [processAudio]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      recordingChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordingChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(recordingChunksRef.current, { type: 'audio/webm' });
        processAudio(blob, 'Recording');
      };

      mediaRecorder.start(1000);
      setState('recording');
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
    } catch {
      console.error('Microphone access denied');
    }
  }, [processAudio]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = 0;
    }
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) return `${h}h ${m}m ${sec}s`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
  };

  const exportMarkdown = () => {
    if (!result) return;
    let md = `# Meeting Summary\n\n`;
    md += `**Duration:** ${formatDuration(result.duration)} | **Words:** ${result.wordCount} | **Speakers:** ${new Set(result.turns.map(t => t.speaker)).size}\n\n`;

    if (result.keyPoints.length > 0) {
      md += `## Key Points\n\n`;
      for (const p of result.keyPoints) md += `- ${p}\n`;
      md += '\n';
    }
    if (result.decisions.length > 0) {
      md += `## Decisions\n\n`;
      for (const d of result.decisions) md += `- ${d}\n`;
      md += '\n';
    }
    if (result.actionItems.length > 0) {
      md += `## Action Items\n\n`;
      md += `| Action | Assignee | Deadline |\n|---|---|---|\n`;
      for (const a of result.actionItems) {
        md += `| ${a.text} | ${a.assignee ?? '-'} | ${a.deadline ?? '-'} |\n`;
      }
      md += '\n';
    }
    if (result.topics.length > 0) {
      md += `## Topics\n\n${result.topics.join(', ')}\n\n`;
    }
    md += `## Transcript\n\n`;
    if (result.turns.length > 0) {
      for (const t of result.turns) {
        md += `**${t.speaker}** (${formatTime(t.startTime)}): ${t.text}\n\n`;
      }
    } else {
      md += result.transcript + '\n';
    }
    return md;
  };

  const downloadMarkdown = () => {
    const md = exportMarkdown();
    if (!md) return;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'meeting-summary.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyTranscript = () => {
    if (!result) return;
    if (result.turns.length > 0) {
      const text = result.turns.map(t => `[${formatTime(t.startTime)}] ${t.speaker}: ${t.text}`).join('\n\n');
      navigator.clipboard.writeText(text);
    } else {
      navigator.clipboard.writeText(result.transcript);
    }
  };

  const copyActionItems = () => {
    if (!result) return;
    const text = result.actionItems.map(a => {
      let line = `- ${a.text}`;
      if (a.assignee) line += ` (${a.assignee})`;
      if (a.deadline) line += ` [${a.deadline}]`;
      return line;
    }).join('\n');
    navigator.clipboard.writeText(text);
  };

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'transcript', label: 'Transcript' },
    { id: 'summary', label: 'Summary', count: result?.keyPoints.length },
    { id: 'decisions', label: 'Decisions', count: result?.decisions.length },
    { id: 'actions', label: 'Action Items', count: result?.actionItems.length },
    { id: 'topics', label: 'Topics', count: result?.topics.length },
  ];

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col" style={{ fontFamily: "'Manrope',system-ui,sans-serif" }}>
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">FreeAgentStore</a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>Meeting Summarizer</h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
          Whisper Tiny + heuristics
        </span>
      </header>

      <main className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-4 gap-4">
        {/* Idle — download model */}
        {state === 'idle' && (
          <div className="text-center py-12">
            <p className="text-neutral-400 mb-4">
              Upload a meeting recording to get a transcript, speaker turns, decisions, and action items.
              <br />
              <span className="text-neutral-500 text-sm">~40MB model download (Whisper Tiny), cached for next time.</span>
            </p>
            <button onClick={init} className="px-6 py-3 rounded-lg font-semibold text-white bg-violet-600 hover:bg-violet-500">
              Download Model
            </button>
          </div>
        )}

        {/* Loading model */}
        {state === 'loading' && (
          <div className="text-center py-12">
            <div className="w-48 h-2 bg-neutral-800 rounded-full mx-auto overflow-hidden">
              <div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-neutral-400 mt-3 text-sm">Downloading Whisper Tiny... {progress}%</p>
          </div>
        )}

        {/* Ready / Recording / Transcribing / Analyzing */}
        {(state === 'ready' || state === 'recording' || state === 'transcribing' || state === 'analyzing') && (
          <>
            {/* Input zone */}
            <div className="flex gap-3">
              {/* File drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="flex-1 border-2 border-dashed border-neutral-700 rounded-lg p-6 text-center cursor-pointer hover:border-violet-500 transition-colors"
                onClick={() => {
                  if (state !== 'ready') return;
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.mp3,.wav,.m4a,.webm,audio/*';
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) handleFile(file);
                  };
                  input.click();
                }}
              >
                {state === 'transcribing' ? (
                  <div>
                    <div className="inline-block w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mb-2" />
                    <p className="text-neutral-400 text-sm">Transcribing {fileName}... (this may take a minute)</p>
                  </div>
                ) : state === 'analyzing' ? (
                  <div>
                    <div className="inline-block w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mb-2" />
                    <p className="text-neutral-400 text-sm">Analyzing transcript...</p>
                  </div>
                ) : (
                  <p className="text-neutral-400 text-sm">Drop audio file here or click to browse<br /><span className="text-neutral-600 text-xs">.mp3, .wav, .m4a, .webm</span></p>
                )}
              </div>

              {/* Record button */}
              {state === 'recording' ? (
                <button
                  onClick={stopRecording}
                  className="flex flex-col items-center justify-center px-6 rounded-lg bg-red-600 hover:bg-red-500 text-white gap-1"
                >
                  <span className="w-3 h-3 rounded-full bg-white animate-pulse" />
                  <span className="text-sm font-semibold">{formatTime(recordingTime)}</span>
                  <span className="text-xs">Stop</span>
                </button>
              ) : (
                <button
                  onClick={startRecording}
                  disabled={state !== 'ready'}
                  className="flex flex-col items-center justify-center px-6 rounded-lg border border-neutral-700 hover:border-violet-500 text-neutral-400 hover:text-neutral-200 gap-1 transition-colors disabled:opacity-40"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
                  <span className="text-xs">Record</span>
                </button>
              )}
            </div>

            {/* Results */}
            {result && (
              <>
                {/* Stats bar */}
                <div className="flex flex-wrap gap-4 text-sm text-neutral-400 bg-neutral-900 rounded-lg px-4 py-2 border border-neutral-800">
                  <span>Duration: <strong className="text-neutral-200">{formatDuration(result.duration)}</strong></span>
                  <span>Words: <strong className="text-neutral-200">{result.wordCount.toLocaleString()}</strong></span>
                  <span>Speakers: <strong className="text-neutral-200">{new Set(result.turns.map(t => t.speaker)).size}</strong></span>
                  <span>Actions: <strong className="text-neutral-200">{result.actionItems.length}</strong></span>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 border-b border-neutral-800">
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-3 py-2 text-sm rounded-t-lg transition-colors ${
                        activeTab === tab.id
                          ? 'bg-neutral-900 text-neutral-100 border border-neutral-800 border-b-neutral-900 -mb-px'
                          : 'text-neutral-500 hover:text-neutral-300'
                      }`}
                    >
                      {tab.label}
                      {tab.count !== undefined && tab.count > 0 && (
                        <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-neutral-800 text-neutral-400">{tab.count}</span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                  {/* Transcript tab */}
                  {activeTab === 'transcript' && (
                    <div>
                      <div className="flex justify-end mb-3">
                        <button onClick={copyTranscript} className="text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400">
                          Copy transcript
                        </button>
                      </div>
                      {result.turns.length > 0 ? (
                        <div className="space-y-3">
                          {result.turns.map((t, i) => (
                            <div key={i} className="flex gap-3 text-sm">
                              <div className="flex-shrink-0 w-24">
                                <span className="text-violet-400 font-medium text-xs">{t.speaker}</span>
                                <br />
                                <span className="text-neutral-600 font-mono text-xs">{formatTime(t.startTime)}</span>
                              </div>
                              <p className="text-neutral-200 leading-relaxed">{t.text}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap text-neutral-200 leading-relaxed text-sm">{result.transcript}</p>
                      )}
                      <p className="mt-4 text-xs text-neutral-600 italic">
                        Speaker detection is approximate -- based on pauses, not voice recognition.
                      </p>
                    </div>
                  )}

                  {/* Summary tab */}
                  {activeTab === 'summary' && (
                    <div>
                      {result.keyPoints.length > 0 ? (
                        <ul className="space-y-2">
                          {result.keyPoints.map((p, i) => (
                            <li key={i} className="flex gap-2 text-sm">
                              <span className="text-violet-400 flex-shrink-0 mt-1">&#8226;</span>
                              <span className="text-neutral-200 leading-relaxed">{p}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-neutral-500 text-sm">No key points detected. The analysis relies on emphasis markers in the transcript.</p>
                      )}
                    </div>
                  )}

                  {/* Decisions tab */}
                  {activeTab === 'decisions' && (
                    <div>
                      {result.decisions.length > 0 ? (
                        <ul className="space-y-2">
                          {result.decisions.map((d, i) => (
                            <li key={i} className="flex gap-2 text-sm">
                              <span className="text-green-400 flex-shrink-0 mt-1">&#10003;</span>
                              <span className="text-neutral-200 leading-relaxed">{d}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-neutral-500 text-sm">No decisions detected. Look for phrases like "we decided", "let's go with", "approved".</p>
                      )}
                    </div>
                  )}

                  {/* Action Items tab */}
                  {activeTab === 'actions' && (
                    <div>
                      {result.actionItems.length > 0 ? (
                        <>
                          <div className="flex justify-end mb-3">
                            <button onClick={copyActionItems} className="text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400">
                              Copy action items
                            </button>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-neutral-500 text-left border-b border-neutral-800">
                                  <th className="pb-2 pr-4">Action</th>
                                  <th className="pb-2 pr-4 w-28">Assignee</th>
                                  <th className="pb-2 w-28">Deadline</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-neutral-800">
                                {result.actionItems.map((a, i) => (
                                  <tr key={i}>
                                    <td className="py-2 pr-4 text-neutral-200">{a.text}</td>
                                    <td className="py-2 pr-4 text-violet-400">{a.assignee ?? '-'}</td>
                                    <td className="py-2 text-amber-400">{a.deadline ?? '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      ) : (
                        <p className="text-neutral-500 text-sm">No action items detected. Look for phrases like "will do", "need to", "follow up".</p>
                      )}
                    </div>
                  )}

                  {/* Topics tab */}
                  {activeTab === 'topics' && (
                    <div>
                      {result.topics.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {result.topics.map((t, i) => (
                            <span key={i} className="px-3 py-1.5 rounded-full bg-neutral-800 text-neutral-200 text-sm border border-neutral-700">
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-neutral-500 text-sm">No distinct topics detected.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Export bar */}
                <div className="flex gap-2">
                  <button onClick={downloadMarkdown} className="text-xs px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400 border border-neutral-700">
                    Download summary (.md)
                  </button>
                  <button onClick={copyTranscript} className="text-xs px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400 border border-neutral-700">
                    Copy transcript
                  </button>
                  <button onClick={copyActionItems} className="text-xs px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400 border border-neutral-700">
                    Copy action items
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Powered by <a href="https://huggingface.co/onnx-community/whisper-tiny.en" className="underline">Whisper Tiny</a> via Transformers.js + meeting heuristics.
        Audio never leaves your device.
      </footer>
    </div>
  );
}
