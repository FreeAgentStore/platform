import { useState, useRef, useCallback } from 'react';

interface Note {
  id: string;
  raw: string;
  structured: string;
  timestamp: number;
}

export default function App() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [processing, setProcessing] = useState(false);
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Speech recognition not supported in this browser.'); return; }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalTranscript = '';
    recognition.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript + ' ';
        else interim += e.results[i][0].transcript;
      }
      setTranscript(finalTranscript + interim);
    };

    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    setTranscript('');
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const structureNote = useCallback(async () => {
    if (!transcript.trim()) return;
    setProcessing(true);

    const prompt = `Structure this spoken note into a clean format with:
- A short title (max 8 words)
- Key points as bullet list
- Action items (if any) marked with [ ]

Spoken note: "${transcript}"

Return ONLY the structured note, no explanation.`;

    let structured = '';

    try {
      const g = globalThis as any;
      const LM = g.LanguageModel ?? g.ai?.languageModel;
      if (LM?.create) {
        const session = await LM.create({ systemPrompt: 'You structure messy spoken notes into clean, organized markdown.' });
        structured = await session.prompt(prompt);
        session.destroy?.();
      }
    } catch {}

    if (!structured) {
      try {
        const r = await fetch('http://localhost:11434/api/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        });
        if (r.ok) structured = (await r.json()).response;
      } catch {}
    }

    if (!structured) {
      // Heuristic fallback: basic formatting
      const sentences = transcript.split(/[.!?]+/).filter(s => s.trim());
      structured = `# Note\n\n${sentences.map(s => `- ${s.trim()}`).join('\n')}`;
    }

    const note: Note = {
      id: crypto.randomUUID(),
      raw: transcript,
      structured,
      timestamp: Date.now(),
    };
    setNotes(prev => [note, ...prev]);
    setTranscript('');
    setProcessing(false);
  }, [transcript]);

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col" style={{ fontFamily: "'Manrope',system-ui,sans-serif" }}>
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">FreeAgentStore</a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>Voice Notes</h1>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 gap-4">
        {/* Record button */}
        <div className="text-center py-6">
          <button
            onClick={listening ? stopListening : startListening}
            className={`w-20 h-20 rounded-full text-3xl border-4 transition-all ${
              listening ? 'bg-red-600 border-red-400 animate-pulse' : 'bg-neutral-800 border-neutral-600 hover:border-violet-500'
            }`}
          >
            {listening ? '⏹' : '🎤'}
          </button>
          <p className="text-sm text-neutral-500 mt-2">
            {listening ? 'Listening... tap to stop' : 'Tap to start speaking'}
          </p>
        </div>

        {/* Live transcript */}
        {transcript && (
          <div className="p-4 rounded-lg bg-neutral-900 border border-neutral-800">
            <div className="text-xs text-neutral-500 mb-1">Live transcript</div>
            <p className="text-sm leading-relaxed">{transcript}</p>
            <button onClick={structureNote} disabled={processing || listening}
              className="mt-3 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold disabled:opacity-40">
              {processing ? 'Structuring...' : 'Structure Note'}
            </button>
          </div>
        )}

        {/* Saved notes */}
        {notes.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-neutral-400 mb-2">Notes ({notes.length})</h2>
            <div className="space-y-3">
              {notes.map(note => (
                <div key={note.id} className="p-4 rounded-lg bg-neutral-900 border border-neutral-800">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs text-neutral-500">{new Date(note.timestamp).toLocaleTimeString()}</span>
                    <button onClick={() => navigator.clipboard.writeText(note.structured)}
                      className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">Copy</button>
                  </div>
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">{note.structured}</div>
                  <details className="mt-2">
                    <summary className="text-xs text-neutral-600 cursor-pointer">Raw transcript</summary>
                    <p className="text-xs text-neutral-500 mt-1">{note.raw}</p>
                  </details>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Web Speech API + Chrome Built-in AI. Your voice never leaves your device.
      </footer>
    </div>
  );
}
