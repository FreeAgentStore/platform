import { useState, useEffect, useRef, useCallback } from 'react';
import { classifyEmail, type EmailCategory, type ClassificationResult } from './classifier';

const CATEGORY_COLORS: Record<EmailCategory, string> = {
  transactional: '#3b82f6',
  promotional: '#f97316',
  personal: '#22c55e',
  notification: '#8b5cf6',
  newsletter: '#14b8a6',
  spam: '#ef4444',
};

const CATEGORY_ICONS: Record<EmailCategory, string> = {
  transactional: '\u2709',  // envelope
  promotional: '\u2605',    // star
  personal: '\u263A',       // smiley
  notification: '\uD83D\uDD14', // bell
  newsletter: '\uD83D\uDCF0',   // newspaper
  spam: '\u26A0',           // warning
};

const CATEGORY_LABELS: Record<EmailCategory, string> = {
  transactional: 'Transactional',
  promotional: 'Promotional',
  personal: 'Personal',
  notification: 'Notification',
  newsletter: 'Newsletter',
  spam: 'Spam',
};

interface Example {
  label: string;
  subject: string;
  body: string;
}

const EXAMPLES: Example[] = [
  {
    label: 'Order Confirmation',
    subject: 'Your order has been confirmed - Order #78234',
    body: `Thank you for your order!

Order #78234
Items ordered:
  1x Wireless Headphones - $79.99
  1x USB-C Cable - $12.99

Subtotal: $92.98
Shipping: Free
Total: $92.98

Ship to: 123 Main Street, Apt 4B
Payment method: Visa ending in 4242
Estimated delivery: June 10-12

Manage your order at https://shop.example.com/orders/78234`,
  },
  {
    label: 'Sale Email',
    subject: "Flash Sale! 50% off everything - don't miss out!",
    body: `LIMITED TIME OFFER

Shop now and save up to 50% on our entire collection!

Use code SUMMER50 at checkout.

Best sellers:
- Classic Tee: was $40, now $20
- Premium Hoodie: was $80, now $40
- Running Shoes: was $120, now $60

Free shipping on orders over $50.

Shop Now: https://store.example.com/sale

While supplies last. Offer ends Sunday.

Unsubscribe | View in browser | Privacy Policy`,
  },
  {
    label: "Friend's Email",
    subject: 'Re: Lunch tomorrow?',
    body: `Hey!

Yeah, lunch tomorrow sounds great. How about that new Thai place on 5th?

I've been wanting to try it. Let me know if 12:30 works for you.

Also, did you see the game last night? Incredible ending.

Talk soon!
Sarah`,
  },
  {
    label: 'GitHub Notification',
    subject: '[github] Review requested: Fix auth middleware (#342)',
    body: `@alice requested your review on pull request #342 in acme/backend.

Fix auth middleware to handle expired tokens gracefully

+42 -8 files changed

View on GitHub: https://github.com/acme/backend/pull/342

You are receiving this because you were assigned.
Manage notifications: https://github.com/settings/notifications

Reply to this email directly or view it on GitHub.
Do not reply to this noreply address.`,
  },
  {
    label: 'Weekly Newsletter',
    subject: 'The Weekly Digest - Issue #147: This Week in Tech',
    body: `Dear subscriber,

Welcome to Issue #147 of The Weekly Digest.

In this issue:
1. The Future of AI Regulation
2. New Frameworks That Developers Love
3. Community Spotlight: Open Source Projects

Featured Article: The Future of AI Regulation
The debate over AI regulation continues to heat up as governments worldwide...
Read more: https://digest.example.com/147/ai-regulation

Editor's Pick: New Frameworks
This week we're looking at three frameworks that are gaining traction...
Continue reading: https://digest.example.com/147/frameworks

Community Spotlight
We're highlighting five open-source projects that made an impact this month...
Read more: https://digest.example.com/147/community

Upcoming events:
- Tech Meetup, June 15th
- Open Source Summit, July 2-4

Curated by the editorial team.
Forward to a friend | Past issues | Unsubscribe

You are receiving this because you subscribed at digest.example.com.`,
  },
  {
    label: 'Phishing Attempt',
    subject: 'URGENT: Your account has been SUSPENDED!!! Act NOW',
    body: `Dear Customer,

We have detected suspicious activity on your account. Your account has been SUSPENDED for security reasons.

You MUST verify your identity immediately or your account will be permanently deleted within 24 hours.

Click immediately to verify: http://totally-not-suspicious.xyz/verify

You have been selected for account review. Provide your:
- Full name
- Social security number
- Credit card number
- Bank account details

This is URGENT. Act now to avoid permanent suspension.

If you do not respond within 24 hours, your account and all funds will be forfeited.

Security Department
AccountVerify Team`,
  },
];

const ALL_CATEGORIES: EmailCategory[] = ['transactional', 'promotional', 'personal', 'notification', 'newsletter', 'spam'];

export default function App() {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [result, setResult] = useState<ClassificationResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const classify = useCallback((subj: string, bod: string) => {
    if (!subj.trim() && !bod.trim()) {
      setResult(null);
      return;
    }
    setResult(classifyEmail(subj, bod));
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => classify(subject, body), 200);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [subject, body, classify]);

  const handleExample = (ex: Example) => {
    setSubject(ex.subject);
    setBody(ex.body);
  };

  const maxScore = result ? Math.max(...Object.values(result.scores), 0.01) : 1;

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">
          FreeAgentStore
        </a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
          Email Classifier
        </h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
          Evolved — 3000 emails
        </span>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 gap-4">
        {/* Subject input */}
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject line..."
          className="w-full p-3 rounded-lg bg-neutral-900 border border-neutral-800 focus:outline-none focus:border-neutral-600 text-neutral-100 placeholder:text-neutral-600"
        />

        {/* Body textarea */}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Email body..."
          className="w-full h-48 p-4 rounded-lg bg-neutral-900 border border-neutral-800 resize-none focus:outline-none focus:border-neutral-600 text-neutral-100 placeholder:text-neutral-600"
        />

        {/* Quick examples */}
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              onClick={() => handleExample(ex)}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 transition-colors"
            >
              {ex.label}
            </button>
          ))}
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Category label */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl" role="img" aria-label={result.category}>
                  {CATEGORY_ICONS[result.category]}
                </span>
                <div>
                  <span
                    className="text-2xl font-bold"
                    style={{ color: CATEGORY_COLORS[result.category] }}
                  >
                    {CATEGORY_LABELS[result.category]}
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-neutral-500">Confidence</span>
                    <div className="w-32 h-2 bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${result.confidence * 100}%`,
                          backgroundColor: CATEGORY_COLORS[result.category],
                        }}
                      />
                    </div>
                    <span className="text-xs font-mono text-neutral-400">
                      {(result.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Score breakdown */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-2">
              <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">
                Score Breakdown
              </h3>
              {ALL_CATEGORIES.map((cat) => (
                <div key={cat} className="flex items-center gap-3">
                  <span
                    className="text-xs w-28 text-right font-medium"
                    style={{ color: CATEGORY_COLORS[cat] }}
                  >
                    {CATEGORY_LABELS[cat]}
                  </span>
                  <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${(result.scores[cat] / maxScore) * 100}%`,
                        backgroundColor: CATEGORY_COLORS[cat],
                        opacity: result.category === cat ? 1 : 0.5,
                      }}
                    />
                  </div>
                  <span className="text-xs font-mono text-neutral-500 w-12 text-right">
                    {(result.scores[cat] * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>

            {/* Matched signals */}
            {result.signals.length > 0 && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">
                  Matched Signals ({result.signals.length})
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {result.signals.map((signal, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded text-xs font-mono bg-neutral-800 text-neutral-400"
                    >
                      {signal}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-neutral-600">
          This agent uses heuristic code — no AI model, no download, instant results.
          The classification code was generated by an LLM and evolved through iterative testing on 3000 email examples.
        </p>
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Classify emails with 200+ signal patterns. Runs in your browser — zero model, zero inference, zero cost.
        <a href="https://github.com/FreeAgentStore/platform/blob/main/agents/email-classifier/web/src/classifier.ts" className="underline ml-1">View source</a>
      </footer>
    </div>
  );
}
