import { useState } from 'react';
import { detectLoginPage, type LoginDetectorResult } from './heuristic';

const SAMPLE_LOGIN = `<html><head><title>Login - Acme App</title></head><body>
<h1>Sign In</h1>
<form action="/login" method="POST">
  <input type="email" name="email" placeholder="Email address" />
  <input type="password" name="password" placeholder="Password" />
  <label><input type="checkbox" /> Remember me</label>
  <button type="submit">Log In</button>
</form>
<a href="/forgot">Forgot password?</a>
<p>Don't have an account? <a href="/register">Sign up</a></p>
</body></html>`;

const SAMPLE_PRODUCT = `<html><head><title>Premium Widget - $29.99</title></head><body>
<nav><a href="/">Home</a> <a href="/products">Products</a></nav>
<h1>Premium Widget</h1>
<img src="widget.jpg" alt="Widget" />
<p>Price: $29.99</p>
<p>In stock. Ships in 2-3 days.</p>
<button>Add to Cart</button>
<h2>Customer Reviews</h2>
<div>Great product! 5 stars.</div>
</body></html>`;

export default function App() {
  const [html, setHtml] = useState('');
  const [result, setResult] = useState<LoginDetectorResult | null>(null);

  const analyze = (input?: string) => {
    const text = input ?? html;
    if (input !== undefined) setHtml(text);
    setResult(text.trim() ? detectLoginPage(text) : null);
  };

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">FreeAgentStore</a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>Login Detector</h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">Heuristic — trainable</span>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row max-w-6xl mx-auto w-full p-4 gap-4">
        {/* Input */}
        <div className="flex-1 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500">Paste HTML or try a sample:</span>
            <button onClick={() => analyze(SAMPLE_LOGIN)}
              className="text-xs px-2 py-1 rounded bg-neutral-800 text-neutral-400 hover:text-neutral-200">Login page</button>
            <button onClick={() => analyze(SAMPLE_PRODUCT)}
              className="text-xs px-2 py-1 rounded bg-neutral-800 text-neutral-400 hover:text-neutral-200">Product page</button>
          </div>

          <textarea
            value={html}
            onChange={(e) => { setHtml(e.target.value); setResult(e.target.value.trim() ? detectLoginPage(e.target.value) : null); }}
            placeholder="Paste HTML here..."
            className="flex-1 min-h-[300px] p-4 rounded-lg bg-neutral-900 border border-neutral-800 font-mono text-sm resize-y focus:outline-none focus:border-neutral-600 text-neutral-100 placeholder:text-neutral-600"
            spellCheck={false}
          />
        </div>

        {/* Results */}
        <div className="flex-1 flex flex-col gap-3">
          {result && (
            <>
              {/* Verdict */}
              <div className={`p-6 rounded-lg border ${result.isLogin
                ? 'bg-emerald-950/30 border-emerald-800'
                : 'bg-neutral-900 border-neutral-800'}`}>
                <div className="flex items-center gap-3">
                  <span className={`text-3xl font-bold ${result.isLogin ? 'text-emerald-400' : 'text-neutral-400'}`}>
                    {result.isLogin ? 'Login Page' : 'Not Login'}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-4">
                  <div>
                    <span className="text-xs text-neutral-500">Confidence</span>
                    <span className={`ml-2 font-mono text-lg ${
                      result.confidence > 0.7 ? 'text-emerald-400' : result.confidence > 0.4 ? 'text-amber-400' : 'text-neutral-400'
                    }`}>{(result.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${
                      result.confidence > 0.7 ? 'bg-emerald-500' : result.confidence > 0.4 ? 'bg-amber-500' : 'bg-neutral-600'
                    }`} style={{ width: `${result.confidence * 100}%` }} />
                  </div>
                </div>
              </div>

              {/* Signals */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                <h3 className="text-xs text-neutral-500 mb-3 uppercase tracking-wider">Signals</h3>
                <div className="space-y-1.5">
                  {result.signals.map((s) => (
                    <div key={s.name} className="flex items-center gap-2 text-sm">
                      <span className={`w-5 text-center ${s.found
                        ? (s.weight > 0 ? 'text-emerald-400' : 'text-red-400')
                        : 'text-neutral-700'}`}>
                        {s.found ? (s.weight > 0 ? '+' : '-') : ' '}
                      </span>
                      <span className={s.found ? 'text-neutral-200' : 'text-neutral-600'}>{s.name}</span>
                      {s.found && <span className="text-xs text-neutral-500 ml-auto font-mono">
                        {s.weight > 0 ? '+' : ''}{s.weight}
                      </span>}
                      {s.detail && <span className="text-xs text-neutral-600">({s.detail})</span>}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {!result && (
            <div className="flex-1 flex items-center justify-center text-neutral-600 text-sm">
              Paste HTML to analyze
            </div>
          )}
        </div>
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        LLM-distilled heuristic — zero model, zero inference, zero cost. Trainable via the <a href="/a/trainer/" className="underline">Training Interface</a>.
      </footer>
    </div>
  );
}
