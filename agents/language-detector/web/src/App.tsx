import { useState, useEffect, useRef, useMemo } from 'react';
import { detectLanguage, getFlag, type DetectionResult } from './detector';

const SAMPLES: { label: string; flag: string; text: string }[] = [
  // Latin script — Western European
  { label: 'English', flag: '🇬🇧', text: 'The quick brown fox jumps over the lazy dog. This is a sample English text for language detection testing purposes.' },
  { label: 'French', flag: '🇫🇷', text: "Le petit prince est un roman de l'écrivain et aviateur français Antoine de Saint-Exupéry. C'est une œuvre poétique et philosophique." },
  { label: 'Spanish', flag: '🇪🇸', text: 'El ingenioso hidalgo don Quijote de la Mancha es una novela escrita por el español Miguel de Cervantes Saavedra.' },
  { label: 'Portuguese', flag: '🇧🇷', text: 'O Brasil é o maior país da América do Sul e o quinto maior do mundo em área territorial e em população.' },
  { label: 'Italian', flag: '🇮🇹', text: "L'Italia è una repubblica parlamentare situata nell'Europa meridionale. La sua capitale è Roma, città ricca di storia." },
  { label: 'German', flag: '🇩🇪', text: 'Die Bundesrepublik Deutschland ist ein demokratischer und sozialer Bundesstaat. Die Hauptstadt und der Regierungssitz ist Berlin.' },
  { label: 'Dutch', flag: '🇳🇱', text: 'Nederland is een land in West-Europa met een rijke geschiedenis en cultuur. De hoofdstad is Amsterdam.' },
  { label: 'Romanian', flag: '🇷🇴', text: 'România este o țară situată în sud-estul Europei. Capitala și cel mai mare oraș este București.' },
  // Latin script — Nordic
  { label: 'Swedish', flag: '🇸🇪', text: 'Sverige är ett nordiskt land på Skandinaviska halvön. Huvudstaden Stockholm är landets största stad.' },
  { label: 'Norwegian', flag: '🇳🇴', text: 'Norge er et land i Nord-Europa som ligger på den vestlige delen av den skandinaviske halvøy.' },
  { label: 'Danish', flag: '🇩🇰', text: 'Danmark er et land i Nordeuropa. Landet består af halvøen Jylland og en række øer i Østersøen.' },
  { label: 'Finnish', flag: '🇫🇮', text: 'Suomi on pohjoiseurooppalainen valtio. Maan pääkaupunki ja suurin kaupunki on Helsinki.' },
  // Latin script — Central/Eastern European
  { label: 'Polish', flag: '🇵🇱', text: 'Polska jest krajem w Europie Środkowej. Stolica i największe miasto to Warszawa.' },
  { label: 'Czech', flag: '🇨🇿', text: 'Česká republika je vnitrozemský stát ve střední Evropě. Hlavním městem je Praha.' },
  { label: 'Hungarian', flag: '🇭🇺', text: 'Magyarország egy közép-európai ország. Fővárosa és legnagyobb városa Budapest.' },
  { label: 'Turkish', flag: '🇹🇷', text: 'İstanbul, Türkiyenin en büyük şehridir. Asya ve Avrupa kıtalarını birleştiren bu şehir tarihi zenginlikleriyle ünlüdür.' },
  // Latin script — Southeast Asian
  { label: 'Indonesian', flag: '🇮🇩', text: 'Indonesia adalah negara kepulauan terbesar di dunia. Ibu kota negara ini adalah Jakarta.' },
  { label: 'Malay', flag: '🇲🇾', text: 'Malaysia adalah sebuah negara persekutuan yang terletak di Asia Tenggara. Kuala Lumpur adalah ibu kota negara.' },
  { label: 'Tagalog', flag: '🇵🇭', text: 'Ang Pilipinas ay isang bansang archipelago sa Timog-Silangang Asya. Ang kabisera nito ay Maynila.' },
  { label: 'Vietnamese', flag: '🇻🇳', text: 'Việt Nam là một quốc gia nằm ở phía đông bán đảo Đông Dương thuộc khu vực Đông Nam Á.' },
  // Latin script — African
  { label: 'Swahili', flag: '🇰🇪', text: 'Kenya ni nchi iliyoko Afrika Mashariki. Nairobi ndio mji mkuu na jiji kubwa zaidi nchini.' },
  // Cyrillic script
  { label: 'Russian', flag: '🇷🇺', text: 'Россия — самая большая страна в мире по площади территории. Столица — Москва.' },
  { label: 'Ukrainian', flag: '🇺🇦', text: 'Україна є державою у Східній Європі. Столиця та найбільше місто — Київ.' },
  // Greek script
  { label: 'Greek', flag: '🇬🇷', text: 'Η Ελλάδα είναι χώρα στη νοτιοανατολική Ευρώπη. Η πρωτεύουσα και μεγαλύτερη πόλη της είναι η Αθήνα.' },
  // Arabic script
  { label: 'Arabic', flag: '🇸🇦', text: 'اللغة العربية هي أكثر اللغات السامية تحدثاً وإحدى أكثر اللغات انتشاراً في العالم.' },
  // Devanagari script
  { label: 'Hindi', flag: '🇮🇳', text: 'भारत दक्षिण एशिया में स्थित एक देश है। इसकी राजधानी नई दिल्ली है।' },
  // Thai script
  { label: 'Thai', flag: '🇹🇭', text: 'ประเทศไทยเป็นประเทศในภูมิภาคเอเชียตะวันออกเฉียงใต้ มีกรุงเทพมหานครเป็นเมืองหลวง' },
  // CJK
  { label: 'Chinese', flag: '🇨🇳', text: '中华人民共和国是位于东亚的社会主义国家。首都为北京，是世界上人口最多的国家之一。' },
  { label: 'Japanese', flag: '🇯🇵', text: '東京は日本の首都であり、世界最大の都市圏の一つです。多くの文化的な名所があります。' },
  { label: 'Korean', flag: '🇰🇷', text: '대한민국은 동아시아의 한반도에 위치한 나라입니다. 수도는 서울입니다.' },
];

export default function App() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [showAll, setShowAll] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const visibleSamples = useMemo(
    () => showAll ? SAMPLES : SAMPLES.slice(0, 12),
    [showAll],
  );

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

        {/* Sample buttons — all 30 languages */}
        <div className="flex flex-wrap gap-1.5">
          {visibleSamples.map((s) => (
            <button
              key={s.label}
              onClick={() => setText(s.text)}
              className="px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 transition-colors flex items-center gap-1"
            >
              <span>{s.flag}</span> {s.label}
            </button>
          ))}
          {!showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="px-2.5 py-1 rounded-full text-xs font-medium bg-violet-900/30 border border-violet-800/50 text-violet-400 hover:text-violet-300 transition-colors"
            >
              +{SAMPLES.length - 12} more languages
            </button>
          )}
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
          Character trigram frequency profiles evolved from Wikipedia corpora. Supports 30 languages across Latin, Cyrillic, Greek, Arabic, Devanagari, Thai, CJK scripts.
        </p>
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Heuristic agent — zero model, zero inference, zero cost.
        <a href="https://github.com/FreeAgentStore/platform/blob/main/agents/language-detector/web/src/detector.ts" className="underline ml-1">View source</a>
      </footer>
    </div>
  );
}
