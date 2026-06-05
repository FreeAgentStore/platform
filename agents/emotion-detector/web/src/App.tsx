import { useState, useEffect, useRef, useCallback } from 'react';
import { detectEmotions, type Emotion, type EmotionResult } from './emotions';

const EMOTION_COLORS: Record<Emotion, string> = {
  joy: '#fbbf24',
  anger: '#ef4444',
  sadness: '#3b82f6',
  fear: '#8b5cf6',
  surprise: '#f97316',
  disgust: '#22c55e',
  trust: '#06b6d4',
  anticipation: '#ec4899',
};

const EMOTION_LABELS: Record<Emotion, string> = {
  joy: 'Joy',
  anger: 'Anger',
  sadness: 'Sadness',
  fear: 'Fear',
  surprise: 'Surprise',
  disgust: 'Disgust',
  trust: 'Trust',
  anticipation: 'Anticipation',
};

const SAMPLES: { label: string; text: string }[] = [
  {
    label: 'Joyful review',
    text: 'This is absolutely wonderful! I am so happy and grateful for this amazing experience. Everything was perfect, and I could not stop smiling the whole time. Truly a brilliant and delightful day.',
  },
  {
    label: 'Angry complaint',
    text: 'I am furious about this terrible service. The staff was incredibly rude and hostile. This is completely unacceptable and infuriating. I have never been so frustrated and outraged in my life.',
  },
  {
    label: 'Fearful news',
    text: 'The situation is alarming and dangerous. People are terrified and anxious about what might happen next. There is a growing sense of dread and panic in the community. Everyone feels uneasy and nervous.',
  },
  {
    label: 'Surprised reaction',
    text: 'I am absolutely shocked and speechless! I never expected this to happen. This is truly unbelievable and mind-blowing. I am completely stunned and amazed by this incredible turn of events.',
  },
  {
    label: 'Mixed emotions',
    text: 'I feel both happy and sad about leaving. I am grateful for the wonderful memories but heartbroken to say goodbye. Looking forward to new adventures, yet I dread the loneliness ahead.',
  },
];

const EMOTIONS_ORDER: Emotion[] = ['joy', 'trust', 'fear', 'surprise', 'sadness', 'disgust', 'anger', 'anticipation'];

function EmotionWheel({ scores }: { scores: Record<Emotion, number> }) {
  const cx = 150;
  const cy = 150;
  const innerR = 30;
  const maxR = 120;
  const sliceAngle = (2 * Math.PI) / 8;

  const paths: React.ReactNode[] = [];
  const labels: React.ReactNode[] = [];

  EMOTIONS_ORDER.forEach((emotion, i) => {
    const score = Math.max(0, scores[emotion]);
    const barR = innerR + (maxR - innerR) * score;
    const startAngle = i * sliceAngle - Math.PI / 2;
    const endAngle = startAngle + sliceAngle;
    const gap = 0.02; // small gap between slices

    // Outer arc points
    const ox1 = cx + barR * Math.cos(startAngle + gap);
    const oy1 = cy + barR * Math.sin(startAngle + gap);
    const ox2 = cx + barR * Math.cos(endAngle - gap);
    const oy2 = cy + barR * Math.sin(endAngle - gap);

    // Inner arc points
    const ix1 = cx + innerR * Math.cos(startAngle + gap);
    const iy1 = cy + innerR * Math.sin(startAngle + gap);
    const ix2 = cx + innerR * Math.cos(endAngle - gap);
    const iy2 = cy + innerR * Math.sin(endAngle - gap);

    const largeArc = sliceAngle - 2 * gap > Math.PI ? 1 : 0;

    const d = [
      `M ${ix1} ${iy1}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 1 ${ix2} ${iy2}`,
      `L ${ox2} ${oy2}`,
      `A ${barR} ${barR} 0 ${largeArc} 0 ${ox1} ${oy1}`,
      'Z',
    ].join(' ');

    paths.push(
      <path
        key={emotion}
        d={d}
        fill={EMOTION_COLORS[emotion]}
        opacity={score > 0 ? 0.3 + score * 0.7 : 0.08}
        stroke={EMOTION_COLORS[emotion]}
        strokeWidth={1}
        strokeOpacity={0.5}
      />
    );

    // Label
    const midAngle = startAngle + sliceAngle / 2;
    const labelR = maxR + 18;
    const lx = cx + labelR * Math.cos(midAngle);
    const ly = cy + labelR * Math.sin(midAngle);

    labels.push(
      <text
        key={`label-${emotion}`}
        x={lx}
        y={ly}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={EMOTION_COLORS[emotion]}
        fontSize="11"
        fontWeight={scores[emotion] > 0.3 ? 700 : 400}
        fontFamily="var(--font-sans)"
      >
        {EMOTION_LABELS[emotion]}
      </text>
    );
  });

  return (
    <svg viewBox="0 0 300 300" className="w-full max-w-[300px] mx-auto">
      {paths}
      {labels}
      <circle cx={cx} cy={cy} r={innerR} fill="#0a0a0a" />
    </svg>
  );
}

function Bar({ label, value, min, max, color }: { label: string; value: number; min: number; max: number; color: string }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-neutral-500">{label}</span>
        <span className="font-mono text-neutral-300">{value.toFixed(2)}</span>
      </div>
      <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: color }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-neutral-600">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

export default function App() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<EmotionResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const analyze = useCallback((input: string) => {
    if (!input.trim()) {
      setResult(null);
      return;
    }
    setResult(detectEmotions(input));
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => analyze(text), 150);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [text, analyze]);

  const handleSample = (sampleText: string) => {
    setText(sampleText);
  };

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">
          FreeAgentStore
        </a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
          Emotion Detector
        </h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
          Heuristic — Plutchik's 8 emotions
        </span>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 gap-4">
        {/* Input */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type or paste text to detect emotions..."
          className="w-full h-40 p-4 rounded-lg bg-neutral-900 border border-neutral-800 resize-none focus:outline-none focus:border-neutral-600 text-neutral-100 placeholder:text-neutral-600"
        />

        {/* Sample buttons */}
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map((s) => (
            <button
              key={s.label}
              onClick={() => handleSample(s.text)}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 transition-colors"
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Primary + Secondary + Compound */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: EMOTION_COLORS[result.primary] }} />
                  <span className="text-xl font-bold" style={{ color: EMOTION_COLORS[result.primary] }}>
                    {EMOTION_LABELS[result.primary]}
                  </span>
                </div>
                {result.secondary && (
                  <>
                    <span className="text-neutral-600">+</span>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: EMOTION_COLORS[result.secondary] }} />
                      <span className="text-lg font-semibold" style={{ color: EMOTION_COLORS[result.secondary] }}>
                        {EMOTION_LABELS[result.secondary]}
                      </span>
                    </div>
                  </>
                )}
                {result.compound && (
                  <span className="ml-auto text-sm px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                    = {result.compound}
                  </span>
                )}
              </div>
            </div>

            {/* Emotion wheel */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
              <EmotionWheel scores={result.scores} />
            </div>

            {/* Score bars for each emotion */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-2">
              {EMOTIONS_ORDER.map((emotion) => (
                <div key={emotion} className="flex items-center gap-3">
                  <span
                    className="text-xs w-24 text-right font-medium"
                    style={{ color: EMOTION_COLORS[emotion] }}
                  >
                    {EMOTION_LABELS[emotion]}
                  </span>
                  <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.max(0, result.scores[emotion]) * 100}%`,
                        backgroundColor: EMOTION_COLORS[emotion],
                      }}
                    />
                  </div>
                  <span className="text-xs font-mono text-neutral-500 w-10 text-right">
                    {result.scores[emotion].toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Valence, Arousal, Confidence */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3">
                <Bar
                  label="Valence"
                  value={result.valence}
                  min={-1}
                  max={1}
                  color={result.valence >= 0 ? '#22c55e' : '#ef4444'}
                />
              </div>
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3">
                <Bar
                  label="Arousal"
                  value={result.arousal}
                  min={0}
                  max={1}
                  color="#f97316"
                />
              </div>
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3">
                <Bar
                  label="Confidence"
                  value={result.confidence}
                  min={0}
                  max={1}
                  color="#8b5cf6"
                />
              </div>
            </div>
          </div>
        )}

        <p className="text-xs text-neutral-600">
          This agent uses heuristic code — no AI model, no download, instant results.
          The analysis code was generated by an LLM and evolved through iterative testing on 1000 examples.
        </p>
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Detect emotions using Plutchik's wheel. Runs in your browser — zero model, zero inference, zero cost.
      </footer>
    </div>
  );
}
