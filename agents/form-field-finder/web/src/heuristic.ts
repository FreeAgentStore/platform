/**
 * Form Field Finder — LLM-distilled heuristic.
 *
 * Given HTML, finds and classifies form fields (email, password, username,
 * phone, name, search, etc.) by analyzing attributes, labels, and context.
 * No model needed at runtime.
 *
 * Generated via FunSearch-style evolution against 40+ real-world form fixtures.
 */

export type FieldRole =
  | 'email'
  | 'password'
  | 'username'
  | 'phone'
  | 'first-name'
  | 'last-name'
  | 'full-name'
  | 'search'
  | 'url'
  | 'company'
  | 'address'
  | 'city'
  | 'zip'
  | 'card-number'
  | 'cvv'
  | 'expiry'
  | 'otp'
  | 'unknown';

export interface FoundField {
  role: FieldRole;
  confidence: number; // 0-1
  selector: string;   // CSS selector to find it
  evidence: string[];  // why we classified it this way
}

export interface FormFieldResult {
  fields: FoundField[];
  formCount: number;
  hasLoginForm: boolean;
  hasRegistrationForm: boolean;
}

// Role detection rules: [attributePattern, role, confidence]
const ATTR_RULES: [RegExp, FieldRole, number][] = [
  // Email
  [/type\s*=\s*["']email["']/i, 'email', 0.95],
  [/(name|id)\s*=\s*["'][^"']*(email|e-mail|mail)(?!.*card)[^"']*["']/i, 'email', 0.85],
  [/placeholder\s*=\s*["'][^"']*(email|e-mail)[^"']*["']/i, 'email', 0.8],
  [/autocomplete\s*=\s*["']email["']/i, 'email', 0.95],

  // Password
  [/type\s*=\s*["']password["']/i, 'password', 0.95],
  [/autocomplete\s*=\s*["'](current-password|new-password)["']/i, 'password', 0.95],

  // Username
  [/(name|id)\s*=\s*["'][^"']*(username|user_name|user-name|userid|user_id|loginid|login_name)[^"']*["']/i, 'username', 0.9],
  [/placeholder\s*=\s*["'][^"']*(username|user\s*name)[^"']*["']/i, 'username', 0.85],
  [/autocomplete\s*=\s*["']username["']/i, 'username', 0.95],

  // Phone
  [/type\s*=\s*["']tel["']/i, 'phone', 0.7], // tel could be card too
  [/(name|id)\s*=\s*["'][^"']*(phone|mobile|tel|cellphone)[^"']*["']/i, 'phone', 0.85],
  [/autocomplete\s*=\s*["']tel["']/i, 'phone', 0.9],

  // Name fields
  [/autocomplete\s*=\s*["']given-name["']/i, 'first-name', 0.95],
  [/autocomplete\s*=\s*["']family-name["']/i, 'last-name', 0.95],
  [/autocomplete\s*=\s*["']name["']/i, 'full-name', 0.9],
  [/(name|id)\s*=\s*["'][^"']*(first.?name|fname|given.?name)[^"']*["']/i, 'first-name', 0.85],
  [/(name|id)\s*=\s*["'][^"']*(last.?name|lname|surname|family.?name)[^"']*["']/i, 'last-name', 0.85],
  [/(name|id)\s*=\s*["'][^"']*(full.?name|display.?name|your.?name)[^"']*["']/i, 'full-name', 0.8],

  // Search
  [/type\s*=\s*["']search["']/i, 'search', 0.95],
  [/(name|id)\s*=\s*["'][^"']*(search|query|q\b)[^"']*["']/i, 'search', 0.8],
  [/role\s*=\s*["']searchbox["']/i, 'search', 0.95],

  // URL
  [/type\s*=\s*["']url["']/i, 'url', 0.95],
  [/(name|id)\s*=\s*["'][^"']*(website|url|homepage|site)[^"']*["']/i, 'url', 0.8],

  // Company
  [/(name|id)\s*=\s*["'][^"']*(company|org|organization|business)[^"']*["']/i, 'company', 0.85],
  [/autocomplete\s*=\s*["']organization["']/i, 'company', 0.95],

  // Address fields
  [/autocomplete\s*=\s*["']street-address["']/i, 'address', 0.95],
  [/(name|id)\s*=\s*["'][^"']*(address|street|addr)[^"']*["']/i, 'address', 0.8],
  [/autocomplete\s*=\s*["']address-level2["']/i, 'city', 0.95],
  [/(name|id)\s*=\s*["'][^"']*(city|town)[^"']*["']/i, 'city', 0.85],
  [/autocomplete\s*=\s*["']postal-code["']/i, 'zip', 0.95],
  [/(name|id)\s*=\s*["'][^"']*(zip|postal|postcode)[^"']*["']/i, 'zip', 0.85],

  // Payment fields
  [/autocomplete\s*=\s*["']cc-number["']/i, 'card-number', 0.95],
  [/(name|id)\s*=\s*["'][^"']*(card.?num|cc.?num|cardnumber)[^"']*["']/i, 'card-number', 0.9],
  [/(name|id)\s*=\s*["'][^"']*(cvv|cvc|security.?code)[^"']*["']/i, 'cvv', 0.9],
  [/autocomplete\s*=\s*["']cc-csc["']/i, 'cvv', 0.95],
  [/(name|id)\s*=\s*["'][^"']*(expir|exp.?date|cc.?exp)[^"']*["']/i, 'expiry', 0.9],
  [/autocomplete\s*=\s*["']cc-exp["']/i, 'expiry', 0.95],

  // OTP / verification code
  [/(name|id)\s*=\s*["'][^"']*(otp|verification|verify|code|token|pin)[^"']*["']/i, 'otp', 0.75],
  [/autocomplete\s*=\s*["']one-time-code["']/i, 'otp', 0.95],
  [/inputmode\s*=\s*["']numeric["'][^>]*maxlength\s*=\s*["'](4|6|8)["']/i, 'otp', 0.7],
];

/**
 * Extract input elements from HTML string.
 * Returns array of [fullTag, index] for each <input>, <textarea>, <select>.
 */
function extractInputs(html: string): { tag: string; index: number }[] {
  const inputs: { tag: string; index: number }[] = [];
  const pattern = /<(input|textarea|select)(?:\s[^>]*)?>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    // Skip hidden inputs
    if (/type\s*=\s*["']hidden["']/i.test(match[0])) continue;
    // Skip submit/button/reset/image inputs
    if (/type\s*=\s*["'](submit|button|reset|image)["']/i.test(match[0])) continue;
    inputs.push({ tag: match[0], index: match.index });
  }
  return inputs;
}

/**
 * Build a CSS selector for an input element from its attributes.
 */
function buildSelector(tag: string): string {
  const id = tag.match(/id\s*=\s*["']([^"']+)["']/i);
  if (id) return `#${id[1]}`;

  const name = tag.match(/name\s*=\s*["']([^"']+)["']/i);
  const type = tag.match(/type\s*=\s*["']([^"']+)["']/i);
  const tagName = tag.match(/^<(\w+)/)?.[1] || 'input';

  if (name && type) return `${tagName}[type="${type[1]}"][name="${name[1]}"]`;
  if (name) return `${tagName}[name="${name[1]}"]`;
  if (type) return `${tagName}[type="${type[1]}"]`;
  return tagName;
}

/**
 * Look for a <label> associated with this input in nearby HTML context.
 */
function findLabelText(html: string, tag: string, tagIndex: number): string {
  // Check for id → label[for=id]
  const id = tag.match(/id\s*=\s*["']([^"']+)["']/i);
  if (id) {
    const escapedId = id[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const labelMatch = html.match(new RegExp(`<label[^>]*for\\s*=\\s*["']${escapedId}["'][^>]*>(.*?)</label>`, 'i'));
    if (labelMatch) return labelMatch[1].replace(/<[^>]*>/g, '').trim().toLowerCase();
  }

  // Check nearby context (200 chars before the tag)
  const before = html.slice(Math.max(0, tagIndex - 200), tagIndex).toLowerCase();
  const labelInContext = before.match(/<label[^>]*>(.*?)<\/label>\s*$/i);
  if (labelInContext) return labelInContext[1].replace(/<[^>]*>/g, '').trim();

  return '';
}

export function findFormFields(html: string): FormFieldResult {
  const inputs = extractInputs(html);
  const fields: FoundField[] = [];

  for (const { tag, index } of inputs) {
    let bestRole: FieldRole = 'unknown';
    let bestConfidence = 0;
    const evidence: string[] = [];

    // Phase 1: Match against attribute rules
    for (const [pattern, role, confidence] of ATTR_RULES) {
      if (pattern.test(tag)) {
        if (confidence > bestConfidence) {
          bestRole = role;
          bestConfidence = confidence;
        }
        evidence.push(`attr:${role}`);
      }
    }

    // Phase 2: Check label text for additional signal
    const labelText = findLabelText(html, tag, index);
    if (labelText) {
      const labelRoles: [RegExp, FieldRole][] = [
        [/\b(email|e-mail)\b/, 'email'],
        [/\bpassword\b/, 'password'],
        [/\b(username|user\s*name)\b/, 'username'],
        [/\b(phone|mobile|telephone)\b/, 'phone'],
        [/\b(first\s*name|given\s*name)\b/, 'first-name'],
        [/\b(last\s*name|surname|family\s*name)\b/, 'last-name'],
        [/\bfull\s*name\b/, 'full-name'],
        [/\bcompany\b/, 'company'],
        [/\bsearch\b/, 'search'],
      ];
      for (const [pat, role] of labelRoles) {
        if (pat.test(labelText)) {
          if (bestConfidence < 0.8) {
            bestRole = role;
            bestConfidence = Math.max(bestConfidence, 0.75);
          }
          evidence.push(`label:"${labelText}"`);
          break;
        }
      }
    }

    // Phase 3: Placeholder text as fallback
    const placeholder = tag.match(/placeholder\s*=\s*["']([^"']+)["']/i);
    if (placeholder && bestRole === 'unknown') {
      const ph = placeholder[1].toLowerCase();
      const phRoles: [RegExp, FieldRole][] = [
        [/email/, 'email'],
        [/password/, 'password'],
        [/username|user\s*name/, 'username'],
        [/phone|mobile/, 'phone'],
        [/first\s*name/, 'first-name'],
        [/last\s*name|surname/, 'last-name'],
        [/name/, 'full-name'],
        [/search/, 'search'],
        [/company|org/, 'company'],
        [/city|town/, 'city'],
        [/zip|postal/, 'zip'],
      ];
      for (const [pat, role] of phRoles) {
        if (pat.test(ph)) {
          bestRole = role;
          bestConfidence = 0.65;
          evidence.push(`placeholder:"${placeholder[1]}"`);
          break;
        }
      }
    }

    // Disambiguate: tel input near card patterns → card, not phone
    if (bestRole === 'phone') {
      const nearby = html.slice(Math.max(0, index - 300), Math.min(html.length, index + 300)).toLowerCase();
      if (/card|credit|payment|checkout|billing/i.test(nearby)) {
        bestRole = 'card-number';
        bestConfidence = 0.7;
        evidence.push('context:payment-nearby');
      }
    }

    if (bestRole !== 'unknown' || evidence.length > 0) {
      fields.push({
        role: bestRole,
        confidence: Math.round(bestConfidence * 100) / 100,
        selector: buildSelector(tag),
        evidence,
      });
    }
  }

  // Classify form type
  const roles = new Set(fields.map(f => f.role));
  const formCount = (html.match(/<form[\s>]/gi) || []).length;
  const hasLoginForm = roles.has('password') && fields.length <= 5 && (roles.has('email') || roles.has('username'));
  const hasRegistrationForm = fields.length > 4 && roles.has('password') && (roles.has('first-name') || roles.has('last-name') || roles.has('phone'));

  return { fields, formCount, hasLoginForm, hasRegistrationForm };
}
