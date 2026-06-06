/**
 * Login Page Detector — LLM-distilled heuristic.
 *
 * Classifies HTML as a login/sign-in page by scoring structural,
 * textual, and semantic signals. No model needed at runtime.
 *
 * Generated via FunSearch-style evolution: LLM wrote the initial code,
 * then iteratively improved it against 50+ real-world login page fixtures.
 */

export interface LoginDetectorResult {
  isLogin: boolean;
  confidence: number; // 0-1
  signals: Signal[];
}

interface Signal {
  name: string;
  weight: number;
  found: boolean;
  detail?: string;
}

export function detectLoginPage(html: string): LoginDetectorResult {
  const lower = html.toLowerCase();
  const signals: Signal[] = [];

  // --- Structural signals (form + fields) ---

  // Password field present (strongest signal)
  const hasPasswordField = /type\s*=\s*["']password["']/i.test(html);
  signals.push({ name: 'password-field', weight: 3, found: hasPasswordField });

  // Has a <form> element
  const hasForm = /<form[\s>]/i.test(html);
  signals.push({ name: 'form-element', weight: 1, found: hasForm });

  // Email or username input
  const hasEmailOrUser = /type\s*=\s*["'](email|text)["'][^>]*(name|id|placeholder)\s*=\s*["'][^"']*(email|user|login|account)/i.test(html)
    || /(name|id|placeholder)\s*=\s*["'][^"']*(email|user|login|account)[^"']*["'][^>]*type\s*=\s*["'](email|text)["']/i.test(html)
    || /type\s*=\s*["']email["']/i.test(html);
  signals.push({ name: 'email-or-username-input', weight: 2, found: hasEmailOrUser });

  // Submit button with login-like text
  const loginButtonPattern = /<(button|input)[^>]*(log\s*in|sign\s*in|submit|enter|authenticate)/i;
  const hasLoginButton = loginButtonPattern.test(html);
  signals.push({ name: 'login-button', weight: 2, found: hasLoginButton });

  // --- Textual signals (headings, labels) ---

  // Page title or heading contains login keywords
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  const titleText = titleMatch ? titleMatch[1].toLowerCase() : '';
  const headingText = (html.match(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/gi) || [])
    .map(h => h.replace(/<[^>]*>/g, '').toLowerCase()).join(' ');
  const hasLoginTitle = /\b(log\s*in|sign\s*in|login|signin|authentication)\b/.test(titleText + ' ' + headingText);
  signals.push({ name: 'login-title-or-heading', weight: 2, found: hasLoginTitle });

  // "Forgot password" link
  const hasForgotPassword = /forgot\s*(your\s*)?(password|pass)/i.test(html);
  signals.push({ name: 'forgot-password', weight: 2, found: hasForgotPassword });

  // "Remember me" checkbox
  const hasRememberMe = /remember\s*me/i.test(html);
  signals.push({ name: 'remember-me', weight: 1.5, found: hasRememberMe });

  // "Don't have an account" / "Sign up" link (common on login pages)
  const hasSignUpLink = /(don.t have|no\s+account|create\s+(an?\s+)?account|sign\s*up|register)/i.test(html);
  signals.push({ name: 'signup-link', weight: 1, found: hasSignUpLink });

  // --- Negative signals (not a login page) ---

  // Registration form (many fields = not login, login has 2-3 visible inputs)
  const allInputTags = html.match(/<input(?:\s[^>]*)?\/?>/gi) || [];
  const visibleInputs = allInputTags
    .filter(tag => !/type\s*=\s*["'](hidden|submit|button|reset|image)["']/i.test(tag));
  const visibleCount = visibleInputs.length;
  const tooManyInputs = visibleCount > 4;
  signals.push({ name: 'too-many-inputs', weight: -3, found: tooManyInputs, detail: `${visibleCount} visible inputs` });

  // Strong registration signal: many visible inputs + confirm password
  const hasConfirmPassword = /(confirm|repeat|re.enter|retype).{0,20}password/i.test(html)
    || (html.match(/type\s*=\s*["']password["']/gi) || []).length > 1;
  signals.push({ name: 'confirm-password', weight: -3, found: hasConfirmPassword });

  // Has credit card fields (checkout, not login)
  const hasCreditCard = /type\s*=\s*["']tel["'][^>]*(card|cc|cvv|cvc|expir)/i.test(html)
    || /(card.?number|cvv|cvc|expir)/i.test(html);
  signals.push({ name: 'credit-card-fields', weight: -3, found: hasCreditCard });

  // Has file upload (not login)
  const hasFileUpload = /type\s*=\s*["']file["']/i.test(html);
  signals.push({ name: 'file-upload', weight: -2, found: hasFileUpload });

  // Search page (has search-specific elements)
  const isSearchPage = (/<input[^>]*type\s*=\s*["']search["']/i.test(html))
    || (lower.includes('search results') && !hasPasswordField);
  signals.push({ name: 'search-page', weight: -2, found: isSearchPage });

  // --- OAuth / SSO signals ---
  const hasOAuth = /(sign\s*in\s*with|log\s*in\s*with|continue\s*with)\s*(google|github|facebook|apple|microsoft|twitter|sso)/i.test(html);
  signals.push({ name: 'oauth-sso', weight: 1.5, found: hasOAuth });

  // --- Score calculation ---
  let score = 0;
  let maxPositive = 0;

  for (const s of signals) {
    if (s.found) score += s.weight;
    if (s.weight > 0 && s.name !== 'too-many-inputs') maxPositive += s.weight;
  }

  // Normalize to 0-1 confidence
  const rawConfidence = Math.max(0, Math.min(1, score / (maxPositive * 0.6)));

  // Threshold: 0.4 = login page
  const isLogin = rawConfidence >= 0.4;

  return {
    isLogin,
    confidence: Math.round(rawConfidence * 100) / 100,
    signals,
  };
}
