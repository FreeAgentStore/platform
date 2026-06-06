/**
 * Local persistence for trainer state.
 * Uses localStorage — works offline, no account needed.
 */

import type { Example, EvolutionEntry, AgentSpec, AIConfig } from './evolve';

export interface TrainerProject {
  id: string;
  spec: AgentSpec;
  examples: Example[];
  currentCode: string;
  history: EvolutionEntry[];
  aiConfig: AIConfig;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'fags-trainer-projects';

export function loadProjects(): TrainerProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveProjects(projects: TrainerProject[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function createProject(spec: AgentSpec): TrainerProject {
  return {
    id: crypto.randomUUID(),
    spec,
    examples: [],
    currentCode: '',
    history: [],
    aiConfig: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function exportProject(project: TrainerProject): string {
  return JSON.stringify(project, null, 2);
}

export function importProject(json: string): TrainerProject {
  const p = JSON.parse(json);
  if (!p.spec?.name) throw new Error('Invalid project: missing spec.name');
  return p;
}

// --- Starter templates ---

export const STARTER_TEMPLATES: { name: string; spec: AgentSpec; examples: Example[] }[] = [
  {
    name: 'Login Page Detector',
    spec: {
      name: 'login-detector',
      description: 'Given HTML string, detect if it is a login/sign-in page. Return { isLogin: boolean, confidence: number }.',
      inputType: 'string (HTML)',
      outputType: '{ isLogin: boolean, confidence: number }',
    },
    examples: [
      {
        id: '1', weight: 1,
        input: JSON.stringify('<form><input type="email" /><input type="password" /><button>Sign In</button></form>'),
        expectedOutput: JSON.stringify({ isLogin: true, confidence: 0.9 }),
      },
      {
        id: '2', weight: 1,
        input: JSON.stringify('<h1>Products</h1><div class="grid"><div class="card">Widget $29</div></div>'),
        expectedOutput: JSON.stringify({ isLogin: false, confidence: 0.1 }),
      },
    ],
  },
  {
    name: 'Email Extractor',
    spec: {
      name: 'email-extractor',
      description: 'Given a block of text, extract all email addresses. Return an array of unique emails, lowercase.',
      inputType: 'string (text)',
      outputType: 'string[] (emails)',
    },
    examples: [
      {
        id: '1', weight: 1,
        input: JSON.stringify('Contact us at hello@example.com or support@example.com'),
        expectedOutput: JSON.stringify(['hello@example.com', 'support@example.com']),
      },
      {
        id: '2', weight: 1,
        input: JSON.stringify('No emails here, just text.'),
        expectedOutput: JSON.stringify([]),
      },
    ],
  },
  {
    name: 'Price Extractor',
    spec: {
      name: 'price-extractor',
      description: 'Given HTML of a product page, extract the price. Return { price: number, currency: string, raw: string } or null if no price found.',
      inputType: 'string (HTML)',
      outputType: '{ price: number, currency: string, raw: string } | null',
    },
    examples: [
      {
        id: '1', weight: 1,
        input: JSON.stringify('<span class="price">$29.99</span>'),
        expectedOutput: JSON.stringify({ price: 29.99, currency: 'USD', raw: '$29.99' }),
      },
      {
        id: '2', weight: 1,
        input: JSON.stringify('<p>This article has no price.</p>'),
        expectedOutput: JSON.stringify(null),
      },
    ],
  },
  {
    name: 'Spam Detector',
    spec: {
      name: 'spam-detector',
      description: 'Given text (email subject+body or message), classify as spam or not. Return { isSpam: boolean, confidence: number, signals: string[] }.',
      inputType: 'string (text)',
      outputType: '{ isSpam: boolean, confidence: number, signals: string[] }',
      scoreFn: `
        if (!actual || !expected) return 0;
        const a = typeof actual === 'string' ? JSON.parse(actual) : actual;
        const e = typeof expected === 'string' ? JSON.parse(expected) : expected;
        return a.isSpam === e.isSpam ? 1 : 0;
      `,
    },
    examples: [
      {
        id: '1', weight: 1,
        input: JSON.stringify('CONGRATULATIONS! You won $1,000,000! Click here to claim your prize NOW!!!'),
        expectedOutput: JSON.stringify({ isSpam: true, confidence: 0.95, signals: ['all-caps', 'money', 'urgency'] }),
      },
      {
        id: '2', weight: 1,
        input: JSON.stringify('Hey, are we still on for lunch tomorrow at noon?'),
        expectedOutput: JSON.stringify({ isSpam: false, confidence: 0.05, signals: [] }),
      },
    ],
  },
];
