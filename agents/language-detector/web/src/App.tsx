import { useState, useEffect, useRef } from 'react';
import { detectLanguage, getFlag, type DetectionResult } from './detector';

const SAMPLES: { label: string; text: string }[] = [
  { label: 'English', text: 'The quick brown fox jumps over the lazy dog. This is a sample English text for language detection testing purposes.' },
  { label: 'French', text: "Le petit prince est un roman de l'ecrivain et aviateur francais Antoine de Saint-Exupery. C'est une oeuvre poetique et philosophique." },
  { label: 'Spanish', text: 'El ingenioso hidalgo don Quijote de la Mancha es una novela escrita por el espanol Miguel de Cervantes Saavedra.' },
  { label: 'German', text: 'Die Bundesrepublik Deutschland ist ein demokratischer und sozialer Bundesstaat. Die Hauptstadt und der Regierungssitz ist Berlin.' },
  { label: 'Japanese', text: '\u6771\u4EAC\u306F\u65E5\u672C\u306E\u9996\u90FD\u3067\u3042\u308A\u3001\u4E16\u754C\u6700\u5927\u306E\u90FD\u5E02\u570F\u306E\u4E00\u3064\u3067\u3059\u3002\u591A\u304F\u306E\u6587\u5316\u7684\u306A\u540D\u6240\u304C\u3042\u308A\u307E\u3059\u3002' },
  { label: 'Arabic', text: '\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0647\u064A \u0623\u0643\u062B\u0631 \u0627\u0644\u0644\u063A\u0627\u062A \u0627\u0644\u0633\u0627\u0645\u064A\u0629 \u062A\u062D\u062F\u062B\u0627\u064B \u0648\u0625\u062D\u062F\u0649 \u0623\u0643\u062B\u0631 \u0627\u0644\u0644\u063A\u0627\u062A \u0627\u0646\u062A\u0634\u0627\u0631\u0627\u064B \u0641\u064A \u0627\u0644\u0639\u0627\u0644\u0645' },
  { label: 'Russian', text: '\u0420\u043E\u0441\u0441\u0438\u044F \u2014 \u0441\u0430\u043C\u0430\u044F \u0431\u043E\u043B\u044C\u0448\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0430 \u0432 \u043C\u0438\u0440\u0435 \u043F\u043E \u043F\u043B\u043E\u0449\u0430\u0434\u0438 \u0442\u0435\u0440\u0440\u0438\u0442\u043E\u0440\u0438\u0438.' },
  { label: 'Korean', text: '\uB300\uD55C\uBBFC\uAD6D\uC740 \uB3D9\uC544\uC2DC\uC544\uC758 \uD55C\uBC18\uB3C4\uC5D0 \uC704\uCE58\uD55C \uB098\uB77C\uC785\uB2C8\uB2E4. \uC218\uB3C4\uB294 \uC11C\uC6B8\uC785\uB2C8\uB2E4.' },
  { label: 'Portuguese', text: 'O Brasil e o maior pais da America do Sul e o quinto maior do mundo em area territorial e em populacao.' },
  { label: 'Italian', text: "L'Italia e una repubblica parlamentare situata nell'Europa meridionale. La sua capitale e Roma, citta ricca di storia." },
  { label: 'Dutch', text: 'Nederland is een land in West-Europa met een rijke geschiedenis en cultuur. De hoofdstad is Amsterdam.' },
  { label: 'Turkish', text: 'Istanbul, Turkiyenin en buyuk sehridir. Asya ve Avrupa kitalarini birlestiren bu sehir tarihi zenginlikleriyle unludur.' },
];

export default function App() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<DetectionResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!text.trim()) {
      setResult(null);
      return;
    }
    timerRef.current = setTimeout(() => {
      setResult(detectLanguage(text));
    }, 150);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [text]);

  const trigramCount = text.trim().length >= 3
    ? new Set(
        text.toLowerCase().replace(/[0-9]/g, '').replace(/\s+/g, ' ').trim()
          .split('').reduce<string[]>((acc, _, i, arr) => {
            if (i <= arr.length - 3) acc.push(arr.slice(i, i + 3).join(''));
            return acc;
          }, [])
      ).size
    : 0;

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">
          FreeAgentStore
        </a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
          Language Detector
        </h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
          Heuristic — evolved from Wikipedia
        </span>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 gap-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type or paste text to detect its language..."
          className="w-full h-40 p-4 rounded-lg bg-neutral-900 border border-neutral-800 resize-none focus:outline-none focus:border-neutral-600 text-neutral-100 placeholder:text-neutral-600"
        />

        {/* Sample buttons */}
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map((s) => (
            <button
              key={s.label}
              onClick={() => setText(s.text)}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 transition-colors"
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Stats */}
        {text.trim() && (
          <div className="flex gap-4 text-xs text-neutral-500">
            <span>{text.length} characters</span>
            <span>{trigramCount} unique trigrams</span>
          </div>
        )}

        {/* Result card */}
        {result && result.language !== 'und' && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{getFlag(result.language)}</span>
              <div>
                <div className="text-xl font-bold text-neutral-100">
                  {result.languageName}
                </div>
                <div className="text-sm text-neutral-500 font-mono">
                  {result.language}
                </div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-sm text-neutral-400">Confidence</div>
                <div className="text-lg font-bold text-neutral-100">
                  {(result.confidence * 100).toFixed(0)}%
                </div>
              </div>
            </div>

            {/* Confidence bar */}
            <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${result.confidence * 100}%`,
                  backgroundColor: result.confidence > 0.7
                    ? '#22c55e'
                    : result.confidence > 0.4
                      ? '#eab308'
                      : '#ef4444',
                }}
              />
            </div>

            {/* Top 5 candidates */}
            {result.scores.length > 1 && (
              <div className="space-y-2">
                <div className="text-xs text-neutral-500 font-medium uppercase tracking-wide">
                  Top candidates
                </div>
                {result.scores.map((s, i) => (
                  <div key={s.code} className="flex items-center gap-3">
                    <span className="text-xs font-mono text-neutral-500 w-4 text-right">
                      {i + 1}
                    </span>
                    <span className="text-sm">{getFlag(s.code)}</span>
                    <span className={`text-sm ${i === 0 ? 'text-neutral-100 font-medium' : 'text-neutral-400'}`}>
                      {s.name}
                    </span>
                    <span className="text-xs font-mono text-neutral-600">
                      {s.code}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-neutral-800 overflow-hidden ml-2">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${s.score * 100}%`,
                          backgroundColor: i === 0 ? '#7c3aed' : '#525252',
                        }}
                      />
                    </div>
                    <span className="text-xs font-mono text-neutral-500 w-12 text-right">
                      {(s.score * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {result && result.language === 'und' && text.trim() && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 text-neutral-500 text-sm">
            Could not detect language. Try entering more text (at least 20 characters work best).
          </div>
        )}

        <p className="text-xs text-neutral-600">
          This agent uses heuristic code — no AI model, no download, instant results.
          Character trigram frequency profiles evolved from Wikipedia corpora. Supports 30 languages.
        </p>
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Heuristic agent — zero model, zero inference, zero cost.
        <a href="https://github.com/FreeAgentStore/platform/blob/main/agents/language-detector/web/src/detector.ts" className="underline ml-1">View source</a>
      </footer>
    </div>
  );
}
