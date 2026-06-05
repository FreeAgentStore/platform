import { useState, useRef, useCallback, useEffect } from 'react';
import {
  generateCards,
  generateFromAudio,
  initWhisper,
  isWhisperReady,
  DEMO_TEXT,
  type StudySet,
  type Flashcard,
} from './generator';

type View = 'input' | 'cards' | 'list';
type AudioState = 'none' | 'downloading' | 'ready' | 'recording' | 'transcribing';

export default function App() {
  const [text, setText] = useState('');
  const [studySet, setStudySet] = useState<StudySet | null>(null);
  const [view, setView] = useState<View>('input');
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [audioState, setAudioState] = useState<AudioState>('none');
  const [whisperProgress, setWhisperProgress] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleGenerate = useCallback(() => {
    if (!text.trim()) return;
    const set = generateCards(text);
    setStudySet(set);
    setCardIndex(0);
    setFlipped(false);
    setView('cards');
  }, [text]);

  const loadDemo = useCallback(() => {
    setText(DEMO_TEXT);
  }, []);

  const handleRecordAudio = useCallback(async () => {
    // If whisper not loaded, load it first
    if (!isWhisperReady()) {
      setAudioState('downloading');
      try {
        await initWhisper((pct) => setWhisperProgress(pct));
        setAudioState('ready');
      } catch {
        setAudioState('none');
        return;
      }
    }

    // Start recording
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      recordingChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordingChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(recordingChunksRef.current, { type: 'audio/webm' });
        setAudioState('transcribing');
        try {
          const set = await generateFromAudio(blob);
          setStudySet(set);
          setCardIndex(0);
          setFlipped(false);
          setView('cards');
        } catch (err) {
          console.error(err);
        }
        setAudioState('ready');
      };

      mediaRecorder.start(1000);
      setAudioState('recording');
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
    } catch {
      console.error('Microphone access denied');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = 0;
    }
  }, []);

  const shuffleCards = useCallback(() => {
    if (!studySet) return;
    const shuffled = [...studySet.cards].sort(() => Math.random() - 0.5);
    setStudySet({ ...studySet, cards: shuffled });
    setCardIndex(0);
    setFlipped(false);
  }, [studySet]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const currentCard: Flashcard | null = studySet?.cards[cardIndex] ?? null;

  const exportAnkiCSV = () => {
    if (!studySet) return;
    const csv = studySet.cards.map(c => `${c.front}\t${c.back}`).join('\n');
    navigator.clipboard.writeText(csv);
  };

  const exportJSON = () => {
    if (!studySet) return;
    const blob = new Blob([JSON.stringify(studySet.cards, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flashcards.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportMarkdown = () => {
    if (!studySet) return;
    let md = `# ${studySet.title}\n\n`;
    for (const card of studySet.cards) {
      md += `**Q:** ${card.front}\n\n`;
      md += `**A:** ${card.back}\n\n`;
      md += `---\n\n`;
    }
    navigator.clipboard.writeText(md);
  };

  const typeBadgeColor = (type: Flashcard['type']) => {
    switch (type) {
      case 'definition': return 'bg-blue-900/50 text-blue-400 border-blue-800';
      case 'fact': return 'bg-amber-900/50 text-amber-400 border-amber-800';
      case 'concept': return 'bg-violet-900/50 text-violet-400 border-violet-800';
      case 'list': return 'bg-green-900/50 text-green-400 border-green-800';
    }
  };

  // Count cards by type
  const typeCounts = studySet?.cards.reduce((acc, c) => {
    acc[c.type] = (acc[c.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) ?? {};

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col" style={{ fontFamily: "'Manrope',system-ui,sans-serif" }}>
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">FreeAgentStore</a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>Study Card Maker</h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
          Heuristic + optional Whisper
        </span>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 gap-4">
        {/* Input view */}
        {view === 'input' && (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your class notes, textbook excerpt, or article here..."
              className="w-full h-56 p-4 rounded-lg bg-neutral-900 border border-neutral-800 resize-none focus:outline-none focus:border-neutral-600 text-neutral-100 placeholder:text-neutral-600 text-sm leading-relaxed"
            />

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleGenerate}
                disabled={!text.trim()}
                className="px-5 py-2.5 rounded-lg font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Generate Cards
              </button>
              <button
                onClick={loadDemo}
                className="px-4 py-2.5 rounded-lg text-sm text-neutral-400 border border-neutral-700 hover:border-neutral-600 hover:text-neutral-300"
              >
                Load demo text
              </button>

              {/* Audio recording button */}
              {audioState === 'none' || audioState === 'ready' ? (
                <button
                  onClick={handleRecordAudio}
                  className="px-4 py-2.5 rounded-lg text-sm text-neutral-400 border border-neutral-700 hover:border-neutral-600 hover:text-neutral-300 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
                  Record audio notes
                  {audioState === 'none' && <span className="text-xs text-neutral-600">(downloads ~40MB model)</span>}
                </button>
              ) : audioState === 'downloading' ? (
                <div className="flex items-center gap-2 px-4 py-2.5 text-sm text-neutral-400">
                  <div className="w-24 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${whisperProgress}%` }} />
                  </div>
                  <span className="text-xs">Downloading model... {whisperProgress}%</span>
                </div>
              ) : audioState === 'recording' ? (
                <button
                  onClick={stopRecording}
                  className="px-4 py-2.5 rounded-lg text-sm text-white bg-red-600 hover:bg-red-500 flex items-center gap-2"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                  {formatTime(recordingTime)} -- Stop
                </button>
              ) : audioState === 'transcribing' ? (
                <div className="flex items-center gap-2 px-4 py-2.5 text-sm text-neutral-400">
                  <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                  Transcribing and generating cards...
                </div>
              ) : null}
            </div>

            <p className="text-xs text-neutral-600">
              Paste any educational text -- the generator extracts definitions, facts, lists, cause/effect relationships, and key terms to create flashcards.
              Optionally record audio notes (requires a one-time ~40MB model download).
            </p>
          </>
        )}

        {/* Card view */}
        {view === 'cards' && studySet && currentCard && (
          <>
            {/* Stats */}
            <div className="flex flex-wrap gap-4 text-sm text-neutral-400 bg-neutral-900 rounded-lg px-4 py-2 border border-neutral-800">
              <span>Cards: <strong className="text-neutral-200">{studySet.cards.length}</strong></span>
              <span>Words: <strong className="text-neutral-200">{studySet.wordCount.toLocaleString()}</strong></span>
              {Object.entries(typeCounts).map(([type, count]) => (
                <span key={type}>{type}: <strong className="text-neutral-200">{count}</strong></span>
              ))}
            </div>

            {/* Card */}
            <div
              onClick={() => setFlipped(!flipped)}
              className="cursor-pointer select-none bg-neutral-900 border border-neutral-800 rounded-xl p-8 min-h-[200px] flex flex-col items-center justify-center text-center transition-all hover:border-neutral-700"
            >
              <span className={`text-xs px-2 py-0.5 rounded border mb-4 ${typeBadgeColor(currentCard.type)}`}>
                {currentCard.type}
              </span>
              {flipped ? (
                <p className="text-neutral-200 text-lg leading-relaxed">{currentCard.back}</p>
              ) : (
                <p className="text-neutral-100 text-xl font-medium leading-relaxed">{currentCard.front}</p>
              )}
              <p className="text-neutral-600 text-xs mt-4">
                {flipped ? 'Click to see question' : 'Click to reveal answer'}
              </p>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => { setCardIndex(Math.max(0, cardIndex - 1)); setFlipped(false); }}
                disabled={cardIndex === 0}
                className="px-4 py-2 rounded-lg text-sm text-neutral-400 border border-neutral-700 hover:border-neutral-600 disabled:opacity-30"
              >
                Previous
              </button>
              <span className="text-sm text-neutral-500">
                {cardIndex + 1} / {studySet.cards.length}
              </span>
              <button
                onClick={() => { setCardIndex(Math.min(studySet.cards.length - 1, cardIndex + 1)); setFlipped(false); }}
                disabled={cardIndex === studySet.cards.length - 1}
                className="px-4 py-2 rounded-lg text-sm text-neutral-400 border border-neutral-700 hover:border-neutral-600 disabled:opacity-30"
              >
                Next
              </button>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <button onClick={shuffleCards} className="text-xs px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400 border border-neutral-700">
                Shuffle
              </button>
              <button onClick={() => setView('list')} className="text-xs px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400 border border-neutral-700">
                List view
              </button>
              <button onClick={() => { setView('input'); setStudySet(null); }} className="text-xs px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400 border border-neutral-700">
                New text
              </button>
              <div className="flex-1" />
              <button onClick={exportAnkiCSV} className="text-xs px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400 border border-neutral-700">
                Copy as Anki CSV
              </button>
              <button onClick={exportJSON} className="text-xs px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400 border border-neutral-700">
                Download JSON
              </button>
              <button onClick={exportMarkdown} className="text-xs px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400 border border-neutral-700">
                Copy Markdown
              </button>
            </div>
          </>
        )}

        {/* List view */}
        {view === 'list' && studySet && (
          <>
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => setView('cards')} className="text-xs px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400 border border-neutral-700">
                Card view
              </button>
              <button onClick={() => { setView('input'); setStudySet(null); }} className="text-xs px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400 border border-neutral-700">
                New text
              </button>
              <div className="flex-1" />
              <button onClick={exportAnkiCSV} className="text-xs px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400 border border-neutral-700">
                Copy as Anki CSV
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-neutral-500 text-left border-b border-neutral-800">
                    <th className="pb-2 pr-4 w-8">#</th>
                    <th className="pb-2 pr-4">Front</th>
                    <th className="pb-2 pr-4">Back</th>
                    <th className="pb-2 w-24">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {studySet.cards.map((card, i) => (
                    <tr key={i} className="hover:bg-neutral-900/50">
                      <td className="py-2 pr-4 text-neutral-600">{i + 1}</td>
                      <td className="py-2 pr-4 text-neutral-200">{card.front}</td>
                      <td className="py-2 pr-4 text-neutral-400">{card.back}</td>
                      <td className="py-2">
                        <span className={`text-xs px-2 py-0.5 rounded border ${typeBadgeColor(card.type)}`}>
                          {card.type}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Heuristic flashcard generation -- no AI model needed for text input.
        Audio transcription powered by <a href="https://huggingface.co/onnx-community/whisper-tiny.en" className="underline">Whisper Tiny</a>.
      </footer>
    </div>
  );
}
