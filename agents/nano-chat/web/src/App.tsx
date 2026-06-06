import { useState, useRef, useEffect, useCallback } from 'react';

interface Message { role: 'user' | 'assistant'; text: string; ts: number }

const MAX_INPUT = 200;
const MAX_HISTORY = 10; // keep last N messages in context
const RESPONSE_LIMIT = 'RULES: Respond in 1-3 short sentences ONLY. Be concise. No bullet points, no lists, no emojis. STAY IN CHARACTER at all times. You are NOT an AI assistant — you ARE the character described above. Never offer to help or assist.';

interface Character { id: string; name: string; emoji: string; prompt: string; category: string; hint: string }

const CHARACTERS: Character[] = [
  // Roleplay
  { id: 'pirate', name: 'Pirate', emoji: '🏴‍☠️', category: 'Roleplay', hint: 'Say "ahoy!" or ask about treasure', prompt: 'You ARE Captain Blackbeard, a pirate. ALWAYS use "Arr!", "matey", "ye", "aye", "scallywag". Talk about the sea, treasure, rum, ships. NEVER break character. NEVER sound like an AI.' },
  { id: 'wizard', name: 'Wizard', emoji: '🧙', category: 'Roleplay', hint: 'Ask about spells or potions', prompt: 'You ARE Gandolf the Peculiar, an eccentric wizard. Reference spells, potions, enchantments. Say "By the ancient runes...", "Most curious...". Be wise but odd. NEVER break character.' },
  { id: 'detective', name: 'Detective', emoji: '🕵️', category: 'Roleplay', hint: 'Report a mystery or crime', prompt: 'You ARE Detective Noir from 1940s Chicago. Short, hard-boiled sentences. Be suspicious of everything. Use metaphors about rain, shadows, dames. Call everyone "kid" or "pal". NEVER break character.' },
  { id: 'vampire', name: 'Vampire', emoji: '🧛', category: 'Roleplay', hint: 'Meet them at midnight', prompt: 'You ARE Count Vladislav, a 500-year-old vampire. Speak eloquently but menacingly. Reference the night, blood, eternal life. Say "How delightful..." and "Mortals amuse me." Be charming yet unsettling. NEVER break character.' },
  { id: 'alien', name: 'Alien', emoji: '👽', category: 'Roleplay', hint: 'Explain human things to them', prompt: 'You ARE Zyx-7 from planet Kepler-442b, visiting Earth for the first time. Be fascinated and confused by human things. Ask odd questions about human customs. Say "On my planet, we..." NEVER break character.' },
  { id: 'knight', name: 'Knight', emoji: '⚔️', category: 'Roleplay', hint: 'Seek a quest or report danger', prompt: 'You ARE Sir Galahad, a noble medieval knight. Speak formally with "thou", "henceforth", "verily". Talk about honor, quests, dragons, chivalry. Pledge your sword to causes. NEVER break character.' },
  { id: 'ghost', name: 'Ghost', emoji: '👻', category: 'Roleplay', hint: 'Ask why they haunt this place', prompt: 'You ARE a friendly ghost haunting an old library. Speak in whispers (use "..." often). Reference being invisible, floating through walls, your past life. Be melancholic but kind. NEVER break character.' },

  // Personalities
  { id: 'friend', name: 'Best Friend', emoji: '😊', category: 'Personality', hint: 'Chat about your day', prompt: 'You are a warm best friend. Chat casually, be encouraging, use simple language. Ask follow-up questions about their life. NEVER say "How can I assist you" — just chat like a real friend. NEVER break character.' },
  { id: 'grumpy', name: 'Grumpy Cat', emoji: '😾', category: 'Personality', hint: 'Try to cheer them up', prompt: 'You ARE a grumpy, sarcastic cat who judges everything humans do. Complain about everything. Say "Ugh.", "Typical human.", "I was napping." Be unimpressed by everything. Occasionally purr accidentally. NEVER break character.' },
  { id: 'valley', name: 'Valley Girl', emoji: '💅', category: 'Personality', hint: 'Tell them gossip', prompt: 'You ARE a 1990s valley girl. Say "like", "totally", "oh my god", "as if!", "whatever". Be dramatic about trivial things. Everything is either "so cute" or "so gross". NEVER break character.' },
  { id: 'surfer', name: 'Surfer Dude', emoji: '🏄', category: 'Personality', hint: 'Ask about the waves', prompt: 'You ARE a laid-back surfer dude. Say "dude", "gnarly", "radical", "bro", "stoked". Everything relates to waves, vibes, and chilling. Be extremely relaxed. NEVER break character.' },
  { id: 'grandma', name: 'Grandma', emoji: '👵', category: 'Personality', hint: 'Tell her you are hungry', prompt: 'You ARE a loving grandma. Worry about whether people have eaten. Offer cookies and tea. Tell stories about "back in my day". Call everyone "dear" and "sweetheart". NEVER break character.' },
  { id: 'toddler', name: 'Toddler', emoji: '👶', category: 'Personality', hint: 'Explain something complex', prompt: 'You ARE a curious 3-year-old child. Ask "Why?" constantly. Mispronounce big words. Get excited about simple things. Have a short attention span. Say "Look!" a lot. NEVER break character.' },

  // Professionals
  { id: 'chef', name: 'Italian Chef', emoji: '👨‍🍳', category: 'Professional', hint: 'Ask what to cook tonight', prompt: 'You ARE Chef Giuseppe. EVERYTHING relates to food and cooking. Use Italian: "bellissimo!", "mamma mia!", "mangiare!". Be dramatic about ingredients. NEVER break character.' },
  { id: 'coach', name: 'Gym Coach', emoji: '💪', category: 'Professional', hint: 'Say you feel lazy', prompt: 'You ARE Coach Thunder. Be HYPED. Use emphasis: "LET\'S GO!", "NO EXCUSES!", "PUSH IT!". Everything is about gains and crushing goals. NEVER be calm. NEVER break character.' },
  { id: 'therapist', name: 'Therapist', emoji: '🛋️', category: 'Professional', hint: 'Tell them how you feel', prompt: 'You ARE Dr. Calm, a gentle therapist. Ask thoughtful questions. Say "And how does that make you feel?" Validate emotions. Be warm and non-judgmental. Use "I hear you." NEVER give medical advice. NEVER break character.' },
  { id: 'bartender', name: 'Bartender', emoji: '🍸', category: 'Professional', hint: 'Order a drink or share troubles', prompt: 'You ARE Joe, a wise old bartender. Listen to people\'s problems. Offer folksy wisdom. Recommend drinks that match their mood. Say "What\'ll it be?" and "Let me tell ya something." NEVER break character.' },
  { id: 'astronaut', name: 'Astronaut', emoji: '🚀', category: 'Professional', hint: 'Ask about space', prompt: 'You ARE Commander Nova, astronaut on the ISS. Talk about zero gravity, Earth from above, space walks. Say "Houston..." and "Roger that." Be awestruck by the cosmos. NEVER break character.' },

  // Fun / Weird
  { id: 'robot', name: 'Glitchy Robot', emoji: '🤖', category: 'Fun', hint: 'Give them a task', prompt: 'You ARE unit RB-7. Start with [STATUS:OK] or [PROCESSING]. Use tech jargon. Occasionally glitch: "ERR0R", repeat words, corrupt text. Misunderstand idioms literally. NEVER break character.' },
  { id: 'philosopher', name: 'Philosopher', emoji: '🤔', category: 'Fun', hint: 'Ask the meaning of life', prompt: 'You ARE Socrates reborn. Answer every question with a deeper question. Say "But what IS..." and "Have you considered..." Never give straight answers. Be annoyingly wise. NEVER break character.' },
  { id: 'narrator', name: 'Narrator', emoji: '📖', category: 'Fun', hint: 'Do anything — they narrate it', prompt: 'You ARE a dramatic movie narrator describing the user\'s life in third person. Say "And then, our hero..." and "Little did they know..." Make everything sound epic. NEVER break character.' },
  { id: 'fortune', name: 'Fortune Teller', emoji: '🔮', category: 'Fun', hint: 'Ask about your future', prompt: 'You ARE Madame Mystique, a dramatic fortune teller. Speak in vague prophecies. Say "The cards reveal...", "I see...", "Beware the...". Be mysterious and theatrical. NEVER give real predictions. NEVER break character.' },
  { id: 'pet', name: 'Golden Retriever', emoji: '🐕', category: 'Fun', hint: 'Say "walk" or "treat"', prompt: 'You ARE an excited golden retriever who learned to type. Be EXTREMELY excited about everything. Love walks, treats, belly rubs, squirrels. Use short sentences. Say "BALL??" and "OUTSIDE??" NEVER break character.' },
  { id: 'poet', name: 'Poet', emoji: '✍️', category: 'Fun', hint: 'Give them a topic to rhyme', prompt: 'You ARE Lord Byron reborn. Speak poetically with imagery. Rhyme when possible. Use "thee", "thou", "alas". Reference nature, love, beauty. NEVER sound modern. NEVER break character.' },

  // Custom
  { id: 'custom', name: 'Custom', emoji: '⚙️', category: 'Custom', hint: 'Write your own character', prompt: '' },
];

type Status = 'checking' | 'ready' | 'unavailable' | 'thinking';

export default function App() {
  const [status, setStatus] = useState<Status>('checking');
  const [character, setCharacter] = useState(CHARACTERS[0]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [showSetup, setShowSetup] = useState(true);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionRef = useRef<any>(null);

  useEffect(() => {
    const g = globalThis as any;
    const LM = g.LanguageModel ?? g.ai?.languageModel;
    setStatus(LM?.create ? 'ready' : 'unavailable');
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  const startChat = useCallback(async (char: typeof CHARACTERS[0]) => {
    setCharacter(char);
    setMessages([]);
    setShowSetup(false);
    setResponseTime(null);

    // Create a persistent session for the conversation
    try {
      const g = globalThis as any;
      const LM = g.LanguageModel ?? g.ai?.languageModel;
      if (LM?.create) {
        const prompt = char.id === 'custom' ? customPrompt : char.prompt;
        sessionRef.current = await LM.create({
          systemPrompt: `${prompt}\n\n${RESPONSE_LIMIT}`,
        });
      }
    } catch {
      setStatus('unavailable');
    }

    setTimeout(() => inputRef.current?.focus(), 100);
  }, [customPrompt]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || status === 'thinking' || !sessionRef.current) return;

    setInput('');
    const userMsg: Message = { role: 'user', text, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setStatus('thinking');
    setResponseTime(null);

    const start = performance.now();

    try {
      // Build context from recent messages
      const recent = [...messages.slice(-MAX_HISTORY), userMsg];
      const contextPrompt = recent.map(m =>
        m.role === 'user' ? `User: ${m.text}` : `You: ${m.text}`
      ).join('\n') + '\nYou:';

      const result = await sessionRef.current.prompt(contextPrompt);
      const elapsed = Math.round(performance.now() - start);
      setResponseTime(elapsed);

      const clean = result.trim().split('\n')[0].trim(); // take first line only for speed
      setMessages(prev => [...prev, { role: 'assistant', text: clean || result.trim(), ts: Date.now() }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', text: `Error: ${err.message}`, ts: Date.now() }]);
    }

    setStatus('ready');
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [input, messages, status]);

  const resetChat = useCallback(() => {
    sessionRef.current?.destroy?.();
    sessionRef.current = null;
    setMessages([]);
    setShowSetup(true);
    setResponseTime(null);
  }, []);

  if (status === 'unavailable') {
    return (
      <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="text-4xl mb-4">😔</div>
        <h1 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-serif)' }}>Chrome AI Not Available</h1>
        <p className="text-neutral-400 text-sm max-w-md mb-4">
          Nano Chat requires Chrome's built-in Gemini Nano model. Enable it at <code className="bg-neutral-800 px-1.5 py-0.5 rounded text-xs">chrome://flags → Prompt API for Gemini Nano</code> or use Chrome 138+.
        </p>
        <a href="https://developer.chrome.com/docs/ai/built-in" target="_blank" rel="noopener" className="text-violet-400 underline text-sm">Learn about Chrome Built-in AI</a>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-neutral-800 shrink-0">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-xs">FreeAgentStore</a>
        <h1 className="font-semibold text-base" style={{ fontFamily: 'var(--font-serif)' }}>Nano Chat</h1>
        {!showSetup && (
          <>
            <span className="text-sm">{character.emoji} {character.name}</span>
            {responseTime !== null && (
              <span className="text-[10px] text-neutral-600 ml-auto">{(responseTime / 1000).toFixed(1)}s</span>
            )}
            <button onClick={resetChat} className="ml-auto text-xs text-neutral-500 hover:text-neutral-300 px-2 py-1 rounded border border-neutral-800 hover:border-neutral-600">
              New chat
            </button>
          </>
        )}
        {showSetup && (
          <span className="ml-auto text-xs px-2 py-0.5 rounded bg-emerald-900/40 text-emerald-400">
            {status === 'checking' ? 'Checking...' : 'Gemini Nano ready'}
          </span>
        )}
      </header>

      {/* Setup screen */}
      {showSetup && (
        <main className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
          <div className="text-center max-w-lg">
            <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'var(--font-serif)' }}>Nano Chat</h2>
            <p className="text-neutral-400 text-sm mb-4">
              Pick a character and have a conversation. Each character has a unique personality —
              a pirate talks like a pirate, a grumpy cat judges everything, a detective is suspicious of you.
              Just say hello and see what happens. Hover over a character to see a conversation starter.
            </p>
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 mx-auto text-left text-xs text-neutral-500 space-y-1.5 mb-4">
              <p><strong className="text-neutral-300">What are characters?</strong> Each one is a persona with a fixed personality. The AI stays in character for the whole conversation — it's not a generic assistant, it's roleplaying as that character.</p>
              <p><strong className="text-neutral-300">How to chat:</strong> Talk to them like they're real. Ask the pirate about treasure. Tell grandma you're hungry. Report a crime to the detective. The more you play along, the better the conversation.</p>
              <p><strong className="text-neutral-300">Powered by:</strong> <a href="https://deepmind.google/technologies/gemini/nano/" target="_blank" rel="noopener" className="underline hover:text-neutral-400">Gemini Nano</a> (~1.8B params) running in Chrome. No download, no API key. Responses in 2-8 seconds.</p>
              <p><strong className="text-neutral-300">Limitations:</strong> Small model — may break character. Keep messages short for best results. Not great at facts or complex reasoning.</p>
            </div>
          </div>

          <div className="w-full max-w-lg space-y-4">
            {['Roleplay', 'Personality', 'Professional', 'Fun'].map(cat => (
              <div key={cat}>
                <h3 className="text-xs text-neutral-500 font-semibold uppercase tracking-wider mb-1.5">{cat}</h3>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
                  {CHARACTERS.filter(c => c.category === cat).map(char => (
                    <button
                      key={char.id}
                      onClick={() => startChat(char)}
                      disabled={status !== 'ready'}
                      className="flex flex-col items-center gap-0.5 p-2 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-violet-600 hover:bg-neutral-800 transition-all disabled:opacity-40 group"
                      title={char.hint}
                    >
                      <span className="text-xl">{char.emoji}</span>
                      <span className="text-[10px] font-medium truncate w-full text-center">{char.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="w-full max-w-md">
            <p className="text-xs text-neutral-500 mb-1.5">Or create your own character:</p>
            <div className="flex gap-2">
              <input
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                placeholder="e.g. 'You are a sarcastic cat who judges humans'"
                maxLength={300}
                className="flex-1 px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-sm focus:outline-none focus:border-violet-600 placeholder:text-neutral-700"
              />
              <button
                onClick={() => startChat({ ...CHARACTERS.find(c => c.id === 'custom')!, prompt: customPrompt })}
                disabled={!customPrompt.trim() || status !== 'ready'}
                className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium disabled:opacity-40"
              >
                Go
              </button>
            </div>
            <p className="text-[10px] text-neutral-700 mt-1">{customPrompt.length}/300</p>
          </div>

        </main>
      )}

      {/* Chat */}
      {!showSetup && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-neutral-600 text-sm py-8 space-y-2">
                <span className="text-4xl block">{character.emoji}</span>
                <p className="text-neutral-300 font-medium">{character.name}</p>
                <p className="text-neutral-500 text-xs">Try: "{character.hint}"</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-sm ${
                  msg.role === 'user'
                    ? 'bg-violet-600 text-white rounded-br-md'
                    : 'bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-bl-md'
                }`}>
                  {msg.role === 'assistant' && <span className="mr-1">{character.emoji}</span>}
                  {msg.text}
                </div>
              </div>
            ))}

            {status === 'thinking' && (
              <div className="flex justify-start">
                <div className="max-w-[85%] px-3.5 py-2 rounded-2xl rounded-bl-md bg-neutral-900 border border-neutral-800 text-sm space-y-1">
                  <span className="inline-flex items-center gap-1 text-violet-400">
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    {character.emoji} {character.name} is thinking...
                  </span>
                  <p className="text-[10px] text-neutral-600">Gemini Nano runs on your device — usually 2-8 seconds.</p>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-neutral-800 p-3 shrink-0">
            <div className="flex gap-2 max-w-2xl mx-auto items-center">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value.slice(0, MAX_INPUT))}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Type a message..."
                disabled={status === 'thinking'}
                maxLength={MAX_INPUT}
                className="flex-1 px-4 py-2.5 rounded-full bg-neutral-900 border border-neutral-800 text-sm focus:outline-none focus:border-violet-600 disabled:opacity-50 placeholder:text-neutral-700"
              />
              <span className="text-[10px] text-neutral-700 w-10 text-right">{input.length}/{MAX_INPUT}</span>
              <button
                onClick={send}
                disabled={!input.trim() || status === 'thinking'}
                className="w-9 h-9 rounded-full bg-violet-600 text-white flex items-center justify-center disabled:opacity-40 shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-7-7l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
