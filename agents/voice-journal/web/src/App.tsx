import { useState, useRef, useCallback, useEffect } from 'react';
import { initModel, processRecording, type JournalEntry } from './journal';

type State = 'idle' | 'loading' | 'ready' | 'recording' | 'processing';
type ProcessingStage = 'transcribing' | 'analyzing' | 'summarizing';

const MOOD_COLORS: Record<string, string> = {
  Happy: '#fbbf24',
  Angry: '#ef4444',
  Sad: '#3b82f6',
  Anxious: '#8b5cf6',
  Surprised: '#f97316',
  Disgusted: '#22c55e',
  Confident: '#06b6d4',
  Eager: '#ec4899',
  Neutral: '#737373',
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function loadHistory(): JournalEntry[] {
  try {
    return JSON.parse(localStorage.getItem('voice-journal-history') || '[]');
  } catch {
    return [];
  }
}

function saveHistory(entries: JournalEntry[]) {
  localStorage.setItem('voice-journal-history', JSON.stringify(entries.slice(0, 50)));
}

export default function App() {
  const [state, setState] = useState<State>('idle');
  const [progress, setProgress] = useState(0);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('transcribing');
  const [recordingTime, setRecordingTime] = useState(0);
  const [currentEntry, setCurrentEntry] = useState<JournalEntry | null>(null);
  const [history, setHistory] = useState<JournalEntry[]>(loadHistory);
  const [expandedTranscript, setExpandedTranscript] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const init = useCallback(async () => {
    setState('loading');
    setProgress(0);
    try {
      await initModel((pct) => setProgress(pct));
      setState('ready');
    } catch (e) {
      console.error(e);
      setState('idle');
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        setState('processing');

        // Simulate stages
        setProcessingStage('transcribing');
        try {
          const entry = await processRecording(blob);

          setProcessingStage('analyzing');
          await new Promise((r) => setTimeout(r, 300));

          setProcessingStage('summarizing');
          await new Promise((r) => setTimeout(r, 300));

          setCurrentEntry(entry);
          const updated = [entry, ...history];
          setHistory(updated);
          saveHistory(updated);
        } catch (e) {
          console.error(e);
        }

        setState('ready');
      };

      recorder.start();
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
      setState('recording');
    } catch (e) {
      console.error('Microphone access denied:', e);
    }
  }, [history]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">
          FreeAgentStore
        </a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
          Voice Journal
        </h1>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 gap-4">
        {state === 'idle' && (
          <div className="text-center py-12">
            <p className="text-neutral-400 mb-4">
              Record voice entries, get transcription + mood analysis + summary. ~40MB model, cached for next time.
            </p>
            <button onClick={init} className="px-6 py-3 rounded-lg font-semibold text-white bg-violet-600 hover:bg-violet-500">
              Download Model
            </button>
          </div>
        )}

        {state === 'loading' && (
          <div className="text-center py-12">
            <div className="w-48 h-2 bg-neutral-800 rounded-full mx-auto overflow-hidden">
              <div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-neutral-400 mt-3 text-sm">Downloading Whisper Tiny... {progress}%</p>
          </div>
        )}

        {(state === 'ready' || state === 'recording' || state === 'processing') && (
          <>
            {/* Record button */}
            <div className="flex flex-col items-center gap-3 py-6">
              {state === 'recording' ? (
                <>
                  <button
                    onClick={stopRecording}
                    className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors"
                  >
                    <div className="w-6 h-6 rounded bg-white" />
                  </button>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-neutral-300 font-mono text-lg">{formatDuration(recordingTime)}</span>
                  </div>
                </>
              ) : state === 'processing' ? (
                <div className="text-center space-y-2">
                  <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-neutral-400 text-sm">
                    {processingStage === 'transcribing' && 'Transcribing...'}
                    {processingStage === 'analyzing' && 'Analyzing mood...'}
                    {processingStage === 'summarizing' && 'Summarizing...'}
                  </p>
                </div>
              ) : (
                <>
                  <button
                    onClick={startRecording}
                    className="w-20 h-20 rounded-full bg-violet-600 hover:bg-violet-500 flex items-center justify-center transition-colors"
                  >
                    <div className="w-5 h-5 rounded-full bg-white" />
                  </button>
                  <p className="text-neutral-500 text-sm">Tap to record</p>
                </>
              )}
            </div>

            {/* Current entry result */}
            {currentEntry && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-4">
                {/* Summary */}
                <p className="text-neutral-100 font-semibold leading-relaxed">{currentEntry.summary}</p>

                {/* Mood badge */}
                <div className="flex items-center gap-3">
                  <span
                    className="text-xs font-semibold px-3 py-1 rounded-full"
                    style={{
                      backgroundColor: (MOOD_COLORS[currentEntry.mood.primary] || '#737373') + '22',
                      color: MOOD_COLORS[currentEntry.mood.primary] || '#737373',
                      border: `1px solid ${(MOOD_COLORS[currentEntry.mood.primary] || '#737373')}44`,
                    }}
                  >
                    {currentEntry.mood.primary}
                  </span>
                  <span className="text-xs text-neutral-500">
                    valence: {currentEntry.mood.valence > 0 ? '+' : ''}{currentEntry.mood.valence}
                  </span>
                </div>

                {/* Key topics */}
                {currentEntry.keyTopics.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {currentEntry.keyTopics.map((topic) => (
                      <span key={topic} className="text-xs px-2 py-1 rounded bg-neutral-800 text-neutral-400">
                        {topic}
                      </span>
                    ))}
                  </div>
                )}

                {/* Stats */}
                <div className="flex flex-wrap gap-3 text-xs text-neutral-500">
                  <span>{formatDuration(currentEntry.duration)}</span>
                  <span>{currentEntry.wordCount} words</span>
                  <span>{currentEntry.wordsPerMinute} WPM</span>
                </div>

                {/* Transcript */}
                <div>
                  <button
                    onClick={() => setExpandedTranscript(!expandedTranscript)}
                    className="text-xs text-neutral-500 hover:text-neutral-300 mb-2"
                  >
                    {expandedTranscript ? 'Hide transcript' : 'Show full transcript'}
                  </button>
                  {expandedTranscript && (
                    <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap bg-neutral-800/50 rounded p-3">
                      {currentEntry.transcript}
                    </p>
                  )}
                </div>

                {/* Playback */}
                {audioUrl && (
                  <audio controls src={audioUrl} className="w-full h-8 opacity-70" />
                )}
              </div>
            )}

            {/* History */}
            {history.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm text-neutral-500 font-semibold">Past Entries</h2>
                {history.map((entry, i) => (
                  <div
                    key={entry.timestamp}
                    className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: (MOOD_COLORS[entry.mood.primary] || '#737373') + '22',
                          color: MOOD_COLORS[entry.mood.primary] || '#737373',
                        }}
                      >
                        {entry.mood.primary}
                      </span>
                      <span className="text-[10px] text-neutral-600">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-neutral-600 ml-auto">
                        {formatDuration(entry.duration)} / {entry.wordCount}w
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed line-clamp-2">{entry.summary}</p>
                    {i === 0 && entry.keyTopics.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {entry.keyTopics.map((topic) => (
                          <span key={topic} className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-500">
                            {topic}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Powered by <a href="https://huggingface.co/Xenova/whisper-tiny.en" className="underline">Whisper Tiny</a> via Transformers.js.
        Audio never leaves your device.
      </footer>
    </div>
  );
}
