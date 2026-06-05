import { useState, useCallback, useEffect, useRef } from 'react';
import {
  sha256, sha512, md5, hmacSha256,
  base64Encode, base64Decode, urlEncode, urlDecode,
  generateUuid, generatePassword, passwordStrength,
  decodeJwt, generateTotp,
  type PasswordOptions,
} from './crypto';

type Tab = 'hash' | 'uuid' | 'password' | 'encode' | 'jwt' | 'totp';

export default function App() {
  const [tab, setTab] = useState<Tab>('hash');

  const TABS: { key: Tab; label: string }[] = [
    { key: 'hash', label: 'Hash' },
    { key: 'uuid', label: 'UUID' },
    { key: 'password', label: 'Password' },
    { key: 'encode', label: 'Encode/Decode' },
    { key: 'jwt', label: 'JWT' },
    { key: 'totp', label: 'TOTP' },
  ];

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">
          FreeAgentStore
        </a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
          Hash Generator
        </h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
          Heuristic
        </span>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 gap-4">
        {/* Tabs */}
        <div className="flex gap-1 bg-neutral-900 rounded-lg p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 px-2 rounded-md text-xs font-medium transition-colors ${
                tab === t.key ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'hash' && <HashTab />}
        {tab === 'uuid' && <UuidTab />}
        {tab === 'password' && <PasswordTab />}
        {tab === 'encode' && <EncodeTab />}
        {tab === 'jwt' && <JwtTab />}
        {tab === 'totp' && <TotpTab />}
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Generate hashes, UUIDs, passwords, and encodings. Uses Web Crypto API. Runs in your browser.
      </footer>
    </div>
  );
}

// ── Hash Tab ─────────────────────────────────────────────────────────

function HashTab() {
  const [input, setInput] = useState('');
  const [algo, setAlgo] = useState<'SHA-256' | 'SHA-512' | 'MD5'>('SHA-256');
  const [useHmac, setUseHmac] = useState(false);
  const [hmacKey, setHmacKey] = useState('');
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!input) { setOutput(''); return; }

    let cancelled = false;
    (async () => {
      let result: string;
      if (useHmac && hmacKey) {
        result = await hmacSha256(hmacKey, input);
      } else if (algo === 'SHA-256') {
        result = await sha256(input);
      } else if (algo === 'SHA-512') {
        result = await sha512(input);
      } else {
        result = md5(input);
      }
      if (!cancelled) setOutput(result);
    })();
    return () => { cancelled = true; };
  }, [input, algo, useHmac, hmacKey]);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [output]);

  return (
    <div className="space-y-4">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Enter text to hash..."
        rows={4}
        className="w-full px-4 py-3 rounded-lg bg-neutral-900 border border-neutral-800 focus:outline-none focus:border-neutral-600 text-neutral-100 placeholder:text-neutral-600 font-mono text-sm resize-y"
      />

      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-xs text-neutral-500">Algorithm:</span>
        {(['SHA-256', 'SHA-512', 'MD5'] as const).map((a) => (
          <button
            key={a}
            onClick={() => setAlgo(a)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              algo === a ? 'bg-violet-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={useHmac}
            onChange={(e) => setUseHmac(e.target.checked)}
            className="rounded border-neutral-700 bg-neutral-900 text-violet-600"
          />
          <span className="text-xs text-neutral-400">HMAC-SHA256</span>
        </label>
        {useHmac && (
          <input
            type="text"
            value={hmacKey}
            onChange={(e) => setHmacKey(e.target.value)}
            placeholder="HMAC key"
            className="flex-1 px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 focus:outline-none focus:border-neutral-600 text-neutral-100 placeholder:text-neutral-600 font-mono text-sm"
          />
        )}
      </div>

      {output && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-neutral-500">{useHmac ? 'HMAC-SHA256' : algo} Hash</span>
            <button
              onClick={copy}
              className="text-xs px-2 py-1 rounded bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="font-mono text-sm text-emerald-400 break-all">{output}</p>
        </div>
      )}
    </div>
  );
}

// ── UUID Tab ─────────────────────────────────────────────────────────

function UuidTab() {
  const [uuids, setUuids] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const generate = useCallback((count: number) => {
    const newUuids = Array.from({ length: count }, () => generateUuid());
    setUuids(newUuids);
  }, []);

  const copy = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => generate(1)} className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium text-sm transition-colors">
          Generate 1
        </button>
        <button onClick={() => generate(5)} className="px-4 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-neutral-100 text-sm transition-colors">
          Generate 5
        </button>
        <button onClick={() => generate(10)} className="px-4 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-neutral-100 text-sm transition-colors">
          Generate 10
        </button>
        {uuids.length > 1 && (
          <button
            onClick={() => copy(uuids.join('\n'), 'all')}
            className="ml-auto px-3 py-2 rounded text-xs bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            {copied === 'all' ? 'Copied!' : 'Copy All'}
          </button>
        )}
      </div>

      {uuids.length > 0 && (
        <div className="space-y-2">
          {uuids.map((uuid, i) => (
            <div key={i} className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2">
              <p className="font-mono text-sm text-emerald-400 flex-1">{uuid}</p>
              <button
                onClick={() => copy(uuid, uuid)}
                className="text-xs px-2 py-1 rounded bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors shrink-0"
              >
                {copied === uuid ? 'Copied!' : 'Copy'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Password Tab ─────────────────────────────────────────────────────

function PasswordTab() {
  const [length, setLength] = useState(16);
  const [options, setOptions] = useState<PasswordOptions>({
    uppercase: true, lowercase: true, digits: true, symbols: true,
  });
  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState(false);

  const doGenerate = useCallback(() => {
    setPassword(generatePassword(length, options));
  }, [length, options]);

  useEffect(() => { doGenerate(); }, [doGenerate]);

  const strength = password ? passwordStrength(password) : null;

  return (
    <div className="space-y-4">
      {/* Length slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-500">Length: {length}</span>
          <span className="text-xs text-neutral-600">(8-128)</span>
        </div>
        <input
          type="range"
          min={8}
          max={128}
          value={length}
          onChange={(e) => setLength(parseInt(e.target.value))}
          className="w-full accent-violet-600"
        />
      </div>

      {/* Character options */}
      <div className="flex gap-4 flex-wrap">
        {([
          ['uppercase', 'A-Z'],
          ['lowercase', 'a-z'],
          ['digits', '0-9'],
          ['symbols', '!@#$'],
        ] as const).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={options[key]}
              onChange={(e) => setOptions(prev => ({ ...prev, [key]: e.target.checked }))}
              className="rounded border-neutral-700 bg-neutral-900 text-violet-600"
            />
            <span className="text-xs text-neutral-400">{label}</span>
          </label>
        ))}
      </div>

      {/* Generated password */}
      {password && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-mono text-sm text-emerald-400 break-all flex-1 mr-3">{password}</p>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => { navigator.clipboard.writeText(password); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                className="text-xs px-2 py-1 rounded bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={doGenerate}
                className="text-xs px-2 py-1 rounded bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                Regenerate
              </button>
            </div>
          </div>

          {/* Strength meter */}
          {strength && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500">Strength</span>
                <span className="text-xs text-neutral-400">{strength.label}</span>
              </div>
              <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${strength.color}`}
                  style={{ width: `${(strength.score / 7) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Encode/Decode Tab ────────────────────────────────────────────────

function EncodeTab() {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'base64' | 'url'>('base64');
  const [direction, setDirection] = useState<'encode' | 'decode'>('encode');
  const [copied, setCopied] = useState(false);

  let output = '';
  try {
    if (mode === 'base64') {
      output = direction === 'encode' ? base64Encode(input) : base64Decode(input);
    } else {
      output = direction === 'encode' ? urlEncode(input) : urlDecode(input);
    }
  } catch {
    output = 'Error: invalid input';
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex gap-1 bg-neutral-900 rounded-lg p-1">
          <button
            onClick={() => setMode('base64')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              mode === 'base64' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >Base64</button>
          <button
            onClick={() => setMode('url')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              mode === 'url' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >URL</button>
        </div>
        <button
          onClick={() => setDirection(d => d === 'encode' ? 'decode' : 'encode')}
          className="px-3 py-1.5 rounded text-xs font-medium bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-neutral-100 transition-colors"
        >
          {direction === 'encode' ? 'Encode' : 'Decode'}
        </button>
      </div>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={direction === 'encode' ? 'Enter text to encode...' : 'Enter encoded text to decode...'}
        rows={4}
        className="w-full px-4 py-3 rounded-lg bg-neutral-900 border border-neutral-800 focus:outline-none focus:border-neutral-600 text-neutral-100 placeholder:text-neutral-600 font-mono text-sm resize-y"
      />

      {input && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-neutral-500">{direction === 'encode' ? 'Encoded' : 'Decoded'}</span>
            <button
              onClick={() => { navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="text-xs px-2 py-1 rounded bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="font-mono text-sm text-emerald-400 break-all whitespace-pre-wrap">{output}</p>
        </div>
      )}
    </div>
  );
}

// ── JWT Tab ──────────────────────────────────────────────────────────

function JwtTab() {
  const [token, setToken] = useState('');
  const decoded = token.trim() ? decodeJwt(token) : null;

  return (
    <div className="space-y-4">
      <textarea
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="Paste a JWT token (eyJ...)..."
        rows={4}
        className="w-full px-4 py-3 rounded-lg bg-neutral-900 border border-neutral-800 focus:outline-none focus:border-neutral-600 text-neutral-100 placeholder:text-neutral-600 font-mono text-sm resize-y"
      />

      {token.trim() && !decoded && (
        <div className="bg-red-950/40 border border-red-900 rounded-lg px-4 py-2 text-sm text-red-400">
          Invalid JWT token
        </div>
      )}

      {decoded && (
        <div className="space-y-3">
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
            <p className="text-xs text-neutral-500 mb-2">Header</p>
            <pre className="font-mono text-sm text-violet-400 whitespace-pre-wrap">
              {JSON.stringify(decoded.header, null, 2)}
            </pre>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
            <p className="text-xs text-neutral-500 mb-2">Payload</p>
            <pre className="font-mono text-sm text-emerald-400 whitespace-pre-wrap">
              {JSON.stringify(decoded.payload, null, 2)}
            </pre>
            {decoded.payload.exp && (
              <p className="text-xs text-neutral-500 mt-2">
                Expires: {new Date(decoded.payload.exp * 1000).toLocaleString()}
                {decoded.payload.exp * 1000 < Date.now() && (
                  <span className="text-red-400 ml-2">(expired)</span>
                )}
              </p>
            )}
            {decoded.payload.iat && (
              <p className="text-xs text-neutral-500">
                Issued: {new Date(decoded.payload.iat * 1000).toLocaleString()}
              </p>
            )}
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
            <p className="text-xs text-neutral-500 mb-2">Signature</p>
            <p className="font-mono text-xs text-amber-400 break-all">{decoded.signature}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── TOTP Tab ─────────────────────────────────────────────────────────

function TotpTab() {
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [remaining, setRemaining] = useState(30);
  const [error, setError] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const doGenerate = useCallback(async () => {
    if (!secret.trim()) return;
    try {
      const result = await generateTotp(secret.trim());
      setCode(result.code);
      setRemaining(result.remaining);
      setError('');
    } catch {
      setCode('');
      setError('Invalid secret. Must be a valid Base32 string.');
    }
  }, [secret]);

  useEffect(() => {
    if (!secret.trim()) return;
    doGenerate();
    intervalRef.current = setInterval(doGenerate, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [secret, doGenerate]);

  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        placeholder="Enter TOTP secret (Base32, e.g. JBSWY3DPEHPK3PXP)"
        className="w-full px-4 py-3 rounded-lg bg-neutral-900 border border-neutral-800 focus:outline-none focus:border-neutral-600 text-neutral-100 placeholder:text-neutral-600 font-mono text-sm"
      />

      {error && (
        <div className="bg-red-950/40 border border-red-900 rounded-lg px-4 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {code && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <p className="font-mono text-4xl tracking-[0.3em] text-emerald-400 font-bold">
              {code.slice(0, 3)} {code.slice(3)}
            </p>
            <button
              onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="text-xs px-2 py-1 rounded bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {/* Countdown */}
          <div className="space-y-1">
            <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  remaining <= 5 ? 'bg-red-500' : remaining <= 10 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${(remaining / 30) * 100}%` }}
              />
            </div>
            <p className="text-xs text-neutral-500">{remaining}s remaining</p>
          </div>
        </div>
      )}
    </div>
  );
}
