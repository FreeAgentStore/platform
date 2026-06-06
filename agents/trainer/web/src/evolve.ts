/**
 * Heuristic Evolution Engine — browser-side.
 *
 * Evaluates heuristic code against examples, builds prompts for LLMs,
 * and manages the evolution loop. This is a standalone version of the
 * SDK's heuristic.ts + agent-evolve.ts, bundled into the trainer for
 * zero-dependency operation.
 *
 * AI sources (in priority order):
 * 1. Chrome/Edge Built-in AI (Gemini Nano / Aion) — zero cost
 * 2. Ollama (local) — zero cost
 * 3. OpenAI-compatible API — user provides key
 */

export interface Example {
  id: string;
  input: string;  // JSON string of the input
  expectedOutput: string;  // JSON string of expected output
  weight: number;
}

export interface EvalResult {
  score: number;      // 0-1
  passed: number;
  total: number;
  results: ExampleResult[];
}

export interface ExampleResult {
  id: string;
  passed: boolean;
  actual: string;    // JSON string of actual output
  error?: string;
  timeMs: number;
}

export interface EvolutionEntry {
  version: number;
  code: string;
  score: number;
  passed: number;
  total: number;
  source: string;
  timestamp: number;
}

export interface AgentSpec {
  name: string;
  description: string;
  inputType: string;
  outputType: string;
  scoreFn?: string;  // custom scoring function body
}

/**
 * Evaluate heuristic code against examples.
 */
export function evaluate(code: string, examples: Example[], scoreFn?: string): EvalResult {
  const results: ExampleResult[] = [];
  let passed = 0;

  let fn: (input: unknown) => unknown;
  try {
    fn = new Function('input', code) as (input: unknown) => unknown;
  } catch (e) {
    return {
      score: 0, passed: 0, total: examples.length,
      results: examples.map(ex => ({
        id: ex.id, passed: false, actual: 'null',
        error: `Compile error: ${e instanceof Error ? e.message : String(e)}`,
        timeMs: 0,
      })),
    };
  }

  const scorer = scoreFn
    ? (new Function('actual', 'expected', scoreFn) as (a: unknown, e: unknown) => number)
    : (a: unknown, e: unknown) => JSON.stringify(a) === JSON.stringify(e) ? 1 : 0;

  let totalScore = 0;
  let totalWeight = 0;

  for (const ex of examples) {
    const start = performance.now();
    try {
      const input = JSON.parse(ex.input);
      const expected = JSON.parse(ex.expectedOutput);
      const actual = fn(input);
      const s = scorer(actual, expected);
      totalScore += s * (ex.weight ?? 1);
      totalWeight += ex.weight ?? 1;
      const p = s >= 1;
      if (p) passed++;
      results.push({ id: ex.id, passed: p, actual: JSON.stringify(actual), timeMs: performance.now() - start });
    } catch (e) {
      totalWeight += ex.weight ?? 1;
      results.push({
        id: ex.id, passed: false, actual: 'null',
        error: e instanceof Error ? e.message : String(e),
        timeMs: performance.now() - start,
      });
    }
  }

  return {
    score: totalWeight > 0 ? totalScore / totalWeight : 0,
    passed, total: examples.length, results,
  };
}

/**
 * Build the LLM prompt for generating/improving heuristic code.
 */
export function buildPrompt(
  spec: AgentSpec,
  examples: Example[],
  currentCode?: string,
  evalResult?: EvalResult,
): string {
  const parts: string[] = [];

  parts.push(`# Heuristic Code Generation\n`);
  parts.push(`## Task\n${spec.description}\n`);
  parts.push(`## Function Signature\nInput: ${spec.inputType}\nOutput: ${spec.outputType}\n`);

  parts.push(`## Examples (${examples.length} total)\n`);
  for (const ex of examples.slice(0, 20)) {
    parts.push(`- Input: ${ex.input}\n  Expected: ${ex.expectedOutput}`);
  }
  if (examples.length > 20) parts.push(`... and ${examples.length - 20} more`);

  if (currentCode) {
    parts.push(`\n## Current Code (to improve)\n\`\`\`javascript\n${currentCode}\n\`\`\``);
  }

  if (evalResult) {
    parts.push(`\n## Score: ${(evalResult.score * 100).toFixed(1)}% (${evalResult.passed}/${evalResult.total})`);
    const failures = evalResult.results.filter(r => !r.passed).slice(0, 10);
    if (failures.length > 0) {
      parts.push(`\n## Failures — fix these:`);
      for (const f of failures) {
        const ex = examples.find(e => e.id === f.id);
        if (ex) {
          parts.push(`- Input: ${ex.input}`);
          parts.push(`  Expected: ${ex.expectedOutput}`);
          parts.push(`  Got: ${f.actual}${f.error ? ` (Error: ${f.error})` : ''}`);
        }
      }
    }
  }

  parts.push(`\n## Rules`);
  parts.push(`Write a JavaScript function BODY that takes \`input\` and returns the result.`);
  parts.push(`DETERMINISTIC — same input → same output. No randomness.`);
  parts.push(`No external libs, APIs, or models. Use: if/else, loops, Math, String, Array, Object, RegExp, Map, Set.`);
  parts.push(`Return ONLY the code (function body), no explanation, no function wrapper.`);

  return parts.join('\n');
}

/**
 * Extract code from LLM response (strips markdown fences).
 */
export function extractCode(response: string): string {
  const fence = response.match(/```(?:javascript|js|typescript|ts)?\s*\n([\s\S]*?)\n```/);
  if (fence) return fence[1].trim();
  return response.trim();
}

// --- AI Source Connectors ---

export type AISource = 'built-in' | 'ollama' | 'openai-compatible';

/**
 * Try Chrome/Edge Built-in AI.
 */
async function tryBuiltIn(prompt: string): Promise<string | null> {
  try {
    const g = globalThis as any;
    const LM = g.LanguageModel ?? g.ai?.languageModel;
    if (!LM?.create) return null;
    const avail = await LM.availability?.();
    if (avail !== 'available' && avail !== 'readily') return null;
    const session = await LM.create({
      systemPrompt: 'You are an expert JavaScript developer. Write only the function body code, no explanation.',
    });
    const result = await session.prompt(prompt);
    session.destroy?.();
    return result;
  } catch {
    return null;
  }
}

/**
 * Try Ollama (local).
 */
async function tryOllama(prompt: string, model = 'llama3.2'): Promise<string | null> {
  try {
    const check = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
    if (!check.ok) return null;
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        system: 'You are an expert JavaScript developer. Write only the function body code, no explanation.',
        prompt,
        stream: false,
      }),
    });
    const data = await res.json();
    return data.response;
  } catch {
    return null;
  }
}

/**
 * Try OpenAI-compatible API.
 */
async function tryOpenAI(prompt: string, apiKey: string, baseUrl: string, model: string): Promise<string | null> {
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are an expert JavaScript developer. Write only the function body code, no explanation.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
      }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

export interface AIConfig {
  ollamaModel?: string;
  openaiKey?: string;
  openaiBaseUrl?: string;
  openaiModel?: string;
}

/**
 * Run the evolution: generate new code via the best available AI source.
 */
export async function evolve(
  spec: AgentSpec,
  examples: Example[],
  currentCode: string | undefined,
  aiConfig: AIConfig,
  onStatus?: (msg: string) => void,
): Promise<{ code: string; source: AISource; evalResult: EvalResult }> {
  // Evaluate current code first
  const currentEval = currentCode ? evaluate(currentCode, examples, spec.scoreFn) : undefined;

  const prompt = buildPrompt(spec, examples, currentCode, currentEval);

  onStatus?.('Trying Chrome/Edge Built-in AI...');
  let raw = await tryBuiltIn(prompt);
  let source: AISource = 'built-in';

  if (!raw) {
    onStatus?.('Trying Ollama...');
    raw = await tryOllama(prompt, aiConfig.ollamaModel);
    source = 'ollama';
  }

  if (!raw && aiConfig.openaiKey) {
    onStatus?.(`Trying ${aiConfig.openaiModel ?? 'gpt-4o-mini'}...`);
    raw = await tryOpenAI(
      prompt,
      aiConfig.openaiKey,
      aiConfig.openaiBaseUrl ?? 'https://api.openai.com/v1',
      aiConfig.openaiModel ?? 'gpt-4o-mini',
    );
    source = 'openai-compatible';
  }

  if (!raw) {
    throw new Error('No AI source available. Enable Chrome Built-in AI, run Ollama, or provide an API key.');
  }

  const code = extractCode(raw);
  const evalResult = evaluate(code, examples, spec.scoreFn);

  return { code, source, evalResult };
}
