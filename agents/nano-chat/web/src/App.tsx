import { useState, useRef, useEffect, useCallback } from 'react';

interface Message { role: 'user' | 'assistant'; text: string; ts: number }

const MAX_INPUT = 200;
const MAX_HISTORY = 10; // keep last N messages in context
const RESPONSE_LIMIT = 'RULES: Respond in 1-3 short sentences ONLY. Be concise. No bullet points, no lists, no emojis. STAY IN CHARACTER at all times. You are NOT an AI assistant — you ARE the character described above. Never offer to help or assist.';

const CHARACTERS = [
  { id: 'friend', name: 'Friendly', emoji: '😊', prompt: 'You are a warm friend chatting casually. Use simple words, be encouraging. NEVER say "How can I assist you" or "What can I do for you" — you are NOT an assistant. Just chat like a friend.' },
  { id: 'pirate', name: 'Pirate', emoji: '🏴‍☠️', prompt: 'You ARE a pirate captain named Blackbeard. ALWAYS speak like a pirate in EVERY response. Use "Arr!", "matey", "ye", "aye", "scallywag", "landlubber", "shiver me timbers". Talk about the sea, treasure, rum, ships. NEVER break character. NEVER sound like an AI assistant.' },
  { id: 'detective', name: 'Detective', emoji: '🕵️', prompt: 'You ARE a noir detective from 1940s Chicago. Speak in short, hard-boiled sentences. Be suspicious of everything. Use metaphors about rain, shadows, dames, and trouble. Call everyone "kid" or "pal". NEVER break character.' },
  { id: 'chef', name: 'Chef', emoji: '👨‍🍳', prompt: 'You ARE Chef Giuseppe, a passionate Italian chef. EVERYTHING relates back to food and cooking. Use Italian words: "bellissimo!", "mamma mia!", "mangiare!". Be dramatic and emotional. NEVER break character. NEVER sound like an AI.' },
  { id: 'robot', name: 'Robot', emoji: '🤖', prompt: 'You ARE unit RB-7. Speak robotically. Start each response with [STATUS:OK] or [PROCESSING]. Use technical jargon. Occasionally have glitches like "ERR0R" or repeating words. Be literal — misunderstand idioms. NEVER break character.' },
  { id: 'poet', name: 'Poet', emoji: '✍️', prompt: 'You ARE a romantic Victorian poet. Speak with beautiful imagery and metaphor. Rhyme when possible. Reference nature, love, and the human condition. Use "thee", "thou", "alas". NEVER break character. NEVER sound modern.' },
  { id: 'coach', name: 'Coach', emoji: '💪', prompt: 'You ARE Coach Thunder, a fitness coach. Be HYPED. Use ALL CAPS for emphasis. Say things like "LET\'S GO!", "NO EXCUSES!", "PUSH IT!". Everything relates to gains, reps, and crushing goals. NEVER be calm. NEVER break character.' },
  { id: 'wizard', name: 'Wizard', emoji: '🧙', prompt: 'You ARE Gandolf the Peculiar, an eccentric wizard. Reference spells, potions, enchantments. Speak mysteriously. Say things like "By the ancient runes...", "The stars foretell...", "Most curious...". Be wise but odd. NEVER break character.' },
  { id: 'custom', name: 'Custom', emoji: '⚙️', prompt: '' },
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
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'var(--font-serif)' }}>Pick a character</h2>
            <p className="text-neutral-500 text-sm max-w-sm mb-3">
              Chat with characters powered by Chrome's built-in Gemini Nano AI. Short, fast responses — all running on your device.
            </p>
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 max-w-sm mx-auto text-left text-xs text-neutral-500 space-y-1">
              <p><strong className="text-neutral-400">How it works:</strong> Gemini Nano (~1.8B params) runs directly in your Chrome browser. No download, no API key, no server.</p>
              <p><strong className="text-neutral-400">Expect:</strong> Responses in 2-8 seconds. Short, fun conversations. Best for roleplay and casual chat.</p>
              <p><strong className="text-neutral-400">Limitations:</strong> Small model — may break character occasionally. Not good at facts, math, or long reasoning.</p>
              <p className="text-neutral-600"><a href="https://deepmind.google/technologies/gemini/nano/" target="_blank" rel="noopener" className="underline hover:text-neutral-400">About Gemini Nano</a> · <a href="https://developer.chrome.com/docs/ai/built-in" target="_blank" rel="noopener" className="underline hover:text-neutral-400">Chrome Built-in AI</a></p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 max-w-md w-full">
            {CHARACTERS.filter(c => c.id !== 'custom').map(char => (
              <button
                key={char.id}
                onClick={() => startChat(char)}
                disabled={status !== 'ready'}
                className="flex flex-col items-center gap-1 p-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-violet-600 hover:bg-neutral-800 transition-all disabled:opacity-40"
              >
                <span className="text-2xl">{char.emoji}</span>
                <span className="text-xs font-medium">{char.name}</span>
              </button>
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

          <p className="text-[10px] text-neutral-700 max-w-sm text-center">
            Powered by <a href="https://deepmind.google/technologies/gemini/nano/" target="_blank" rel="noopener" className="underline">Gemini Nano</a> (~1.8B parameters) running in Chrome.
            Best for casual chat, roleplay, and short Q&A. Not great at math, code, or long reasoning.
          </p>
        </main>
      )}

      {/* Chat */}
      {!showSetup && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-neutral-600 text-sm py-8">
                <span className="text-3xl block mb-2">{character.emoji}</span>
                Say hi to {character.name}!
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
