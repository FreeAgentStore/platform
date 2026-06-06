import { useState } from 'react';
import { findFormFields, type FormFieldResult, type FieldRole } from './heuristic';

const ROLE_COLORS: Partial<Record<FieldRole, string>> = {
  email: 'text-blue-400',
  password: 'text-red-400',
  username: 'text-violet-400',
  phone: 'text-amber-400',
  'first-name': 'text-emerald-400',
  'last-name': 'text-emerald-400',
  'full-name': 'text-emerald-400',
  search: 'text-cyan-400',
  'card-number': 'text-orange-400',
  cvv: 'text-orange-400',
  expiry: 'text-orange-400',
  otp: 'text-pink-400',
  url: 'text-sky-400',
  company: 'text-teal-400',
  address: 'text-lime-400',
  city: 'text-lime-400',
  zip: 'text-lime-400',
};

const SAMPLE_LOGIN = `<form action="/login" method="POST">
  <label for="email">Email</label>
  <input type="email" id="email" name="email" placeholder="you@example.com" />
  <label for="pass">Password</label>
  <input type="password" id="pass" name="password" />
  <label><input type="checkbox" name="remember" /> Remember me</label>
  <button type="submit">Sign In</button>
</form>`;

const SAMPLE_REGISTRATION = `<form action="/register">
  <input type="text" name="first_name" placeholder="First Name" autocomplete="given-name" />
  <input type="text" name="last_name" placeholder="Last Name" autocomplete="family-name" />
  <input type="email" name="email" placeholder="Email" />
  <input type="tel" name="phone" placeholder="Phone Number" />
  <input type="password" name="password" placeholder="Password" />
  <input type="password" name="confirm_password" placeholder="Confirm Password" />
  <input type="text" name="company" placeholder="Company (optional)" />
  <button type="submit">Create Account</button>
</form>`;

const SAMPLE_CHECKOUT = `<form>
  <input type="email" name="email" placeholder="Email for receipt" />
  <h3>Shipping</h3>
  <input type="text" name="full_name" placeholder="Full Name" autocomplete="name" />
  <input type="text" name="address" placeholder="Street Address" autocomplete="street-address" />
  <input type="text" name="city" placeholder="City" autocomplete="address-level2" />
  <input type="text" name="zip" placeholder="ZIP Code" autocomplete="postal-code" />
  <h3>Payment</h3>
  <input type="text" name="card_number" autocomplete="cc-number" placeholder="Card Number" />
  <input type="text" name="expiry" autocomplete="cc-exp" placeholder="MM/YY" />
  <input type="text" name="cvv" autocomplete="cc-csc" placeholder="CVV" />
  <button>Pay $29.99</button>
</form>`;

export default function App() {
  const [html, setHtml] = useState('');
  const [result, setResult] = useState<FormFieldResult | null>(null);

  const analyze = (input?: string) => {
    const text = input ?? html;
    if (input !== undefined) setHtml(text);
    setResult(text.trim() ? findFormFields(text) : null);
  };

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">FreeAgentStore</a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>Form Field Finder</h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">Heuristic — trainable</span>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row max-w-6xl mx-auto w-full p-4 gap-4">
        {/* Input */}
        <div className="flex-1 flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-neutral-500">Samples:</span>
            <button onClick={() => analyze(SAMPLE_LOGIN)} className="text-xs px-2 py-1 rounded bg-neutral-800 text-neutral-400 hover:text-neutral-200">Login</button>
            <button onClick={() => analyze(SAMPLE_REGISTRATION)} className="text-xs px-2 py-1 rounded bg-neutral-800 text-neutral-400 hover:text-neutral-200">Registration</button>
            <button onClick={() => analyze(SAMPLE_CHECKOUT)} className="text-xs px-2 py-1 rounded bg-neutral-800 text-neutral-400 hover:text-neutral-200">Checkout</button>
          </div>

          <textarea
            value={html}
            onChange={(e) => { setHtml(e.target.value); setResult(e.target.value.trim() ? findFormFields(e.target.value) : null); }}
            placeholder="Paste HTML with form fields..."
            className="flex-1 min-h-[300px] p-4 rounded-lg bg-neutral-900 border border-neutral-800 font-mono text-sm resize-y focus:outline-none focus:border-neutral-600 text-neutral-100 placeholder:text-neutral-600"
            spellCheck={false}
          />
        </div>

        {/* Results */}
        <div className="flex-1 flex flex-col gap-3">
          {result && (
            <>
              {/* Summary */}
              <div className="flex gap-3">
                <div className="flex-1 p-3 rounded-lg bg-neutral-900 border border-neutral-800">
                  <span className="text-xs text-neutral-500 block">Fields Found</span>
                  <span className="text-2xl font-bold text-neutral-100">{result.fields.length}</span>
                </div>
                <div className="flex-1 p-3 rounded-lg bg-neutral-900 border border-neutral-800">
                  <span className="text-xs text-neutral-500 block">Forms</span>
                  <span className="text-2xl font-bold text-neutral-100">{result.formCount}</span>
                </div>
                <div className="flex-1 p-3 rounded-lg bg-neutral-900 border border-neutral-800">
                  <span className="text-xs text-neutral-500 block">Type</span>
                  <span className="text-sm font-semibold mt-1 block">
                    {result.hasLoginForm ? <span className="text-emerald-400">Login</span>
                      : result.hasRegistrationForm ? <span className="text-violet-400">Registration</span>
                      : <span className="text-neutral-400">Other</span>}
                  </span>
                </div>
              </div>

              {/* Fields */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg divide-y divide-neutral-800">
                {result.fields.map((f, i) => (
                  <div key={i} className="p-3 flex items-start gap-3">
                    <span className={`font-semibold text-sm w-28 shrink-0 ${ROLE_COLORS[f.role] ?? 'text-neutral-400'}`}>
                      {f.role}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs text-neutral-400 truncate">{f.selector}</div>
                      <div className="text-xs text-neutral-600 mt-0.5">{f.evidence.join(', ')}</div>
                    </div>
                    <div className="shrink-0">
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${
                            f.confidence > 0.8 ? 'bg-emerald-500' : f.confidence > 0.6 ? 'bg-amber-500' : 'bg-neutral-500'
                          }`} style={{ width: `${f.confidence * 100}%` }} />
                        </div>
                        <span className="text-xs font-mono text-neutral-500">{(f.confidence * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
                {result.fields.length === 0 && (
                  <div className="p-4 text-center text-neutral-600 text-sm">No form fields found</div>
                )}
              </div>
            </>
          )}

          {!result && (
            <div className="flex-1 flex items-center justify-center text-neutral-600 text-sm">
              Paste HTML to analyze form fields
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
