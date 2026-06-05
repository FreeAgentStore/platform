/**
 * JSON Formatter — format, minify, validate, query, diff, type generation.
 * Pure JS, no dependencies.
 */

export function formatJson(input: string, indent = 2): { result: string; error?: string } {
  try {
    const parsed = JSON.parse(input);
    return { result: JSON.stringify(parsed, null, indent) };
  } catch (e) {
    return { result: input, error: (e as Error).message };
  }
}

export function minifyJson(input: string): { result: string; error?: string } {
  try {
    const parsed = JSON.parse(input);
    return { result: JSON.stringify(parsed) };
  } catch (e) {
    return { result: input, error: (e as Error).message };
  }
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  line?: number;
  col?: number;
}

export function validateJson(input: string): ValidationResult {
  try {
    JSON.parse(input);
    return { valid: true };
  } catch (e) {
    const msg = (e as Error).message;
    // Try to extract position from error message
    // Common format: "... at position 123" or "... at line X column Y"
    const posMatch = msg.match(/position\s+(\d+)/i);
    if (posMatch) {
      const pos = parseInt(posMatch[1]);
      const before = input.slice(0, pos);
      const lines = before.split('\n');
      return {
        valid: false,
        error: msg,
        line: lines.length,
        col: (lines[lines.length - 1]?.length ?? 0) + 1,
      };
    }
    return { valid: false, error: msg };
  }
}

export function queryJson(data: any, path: string): any {
  if (!path.trim()) return data;

  const tokens: string[] = [];
  let current = '';
  let inBracket = false;

  for (const ch of path) {
    if (ch === '.' && !inBracket) {
      if (current) tokens.push(current);
      current = '';
    } else if (ch === '[') {
      if (current) tokens.push(current);
      current = '';
      inBracket = true;
    } else if (ch === ']') {
      if (current) tokens.push(current);
      current = '';
      inBracket = false;
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);

  let result = data;
  for (const token of tokens) {
    if (result == null) return undefined;

    // Try as array index
    const idx = parseInt(token);
    if (!isNaN(idx) && Array.isArray(result)) {
      result = result[idx];
    } else {
      // Strip quotes
      const key = token.replace(/^["']|["']$/g, '');
      result = result[key];
    }
  }
  return result;
}

export interface DiffLine {
  type: 'equal' | 'added' | 'removed';
  text: string;
  lineA?: number;
  lineB?: number;
}

export function diffJson(a: string, b: string): DiffLine[] {
  // Format both for consistent comparison
  let linesA: string[];
  let linesB: string[];
  try {
    linesA = JSON.stringify(JSON.parse(a), null, 2).split('\n');
  } catch {
    linesA = a.split('\n');
  }
  try {
    linesB = JSON.stringify(JSON.parse(b), null, 2).split('\n');
  } catch {
    linesB = b.split('\n');
  }

  // Simple LCS-based diff
  const m = linesA.length;
  const n = linesB.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (linesA[i - 1] === linesB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack
  const result: DiffLine[] = [];
  let i = m, j = n;
  const stack: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      stack.push({ type: 'equal', text: linesA[i - 1], lineA: i, lineB: j });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ type: 'added', text: linesB[j - 1], lineB: j });
      j--;
    } else {
      stack.push({ type: 'removed', text: linesA[i - 1], lineA: i });
      i--;
    }
  }

  stack.reverse();
  result.push(...stack);
  return result;
}

export function jsonToTypes(data: any, name = 'Root'): string {
  const seen = new Map<string, string>();
  let counter = 0;

  function generateType(value: any, typeName: string, indent = ''): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';

    switch (typeof value) {
      case 'string': return 'string';
      case 'number': return 'number';
      case 'boolean': return 'boolean';
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return 'unknown[]';

      // Check if all elements have the same type
      const types = new Set(value.map(v => typeof v));
      if (types.size === 1) {
        const first = value[0];
        if (typeof first === 'object' && first !== null && !Array.isArray(first)) {
          // Merge all object shapes
          const merged: Record<string, any> = {};
          for (const item of value) {
            if (typeof item === 'object' && item !== null) {
              for (const [k, v] of Object.entries(item)) {
                if (!(k in merged)) merged[k] = v;
              }
            }
          }
          const itemName = typeName + 'Item';
          const itemType = generateInterface(merged, itemName, indent);
          return itemType ? `${itemName}[]` : 'Record<string, unknown>[]';
        }
        return `${generateType(first, typeName + 'Item', indent)}[]`;
      }
      // Mixed types
      const uniqueTypes = [...new Set(value.map(v => generateType(v, typeName + 'Item', indent)))];
      return `(${uniqueTypes.join(' | ')})[]`;
    }

    if (typeof value === 'object') {
      const itemName = typeName;
      const generated = generateInterface(value, itemName, indent);
      return generated ? itemName : 'Record<string, unknown>';
    }

    return 'unknown';
  }

  function generateInterface(obj: Record<string, any>, typeName: string, indent = ''): boolean {
    const key = JSON.stringify(Object.keys(obj).sort());
    if (seen.has(key)) return true;

    const lines: string[] = [];
    lines.push(`${indent}interface ${typeName} {`);

    for (const [k, v] of Object.entries(obj)) {
      const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : `"${k}"`;
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        const childName = typeName + capitalize(k);
        const childGenerated = generateInterface(v, childName, indent);
        lines.push(`${indent}  ${safeKey}: ${childGenerated ? childName : 'Record<string, unknown>'};`);
      } else {
        lines.push(`${indent}  ${safeKey}: ${generateType(v, typeName + capitalize(k), indent)};`);
      }
    }

    lines.push(`${indent}}`);
    seen.set(key + '_' + counter++, lines.join('\n'));
    return true;
  }

  function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1).replace(/[^a-zA-Z0-9]/g, '');
  }

  generateType(data, name);
  return [...seen.values()].join('\n\n');
}

// ── Stats ────────────────────────────────────────────────────────────

export interface JsonStats {
  size: number;
  minifiedSize: number;
  keys: number;
  depth: number;
  type: string;
}

export function getJsonStats(input: string): JsonStats | null {
  try {
    const parsed = JSON.parse(input);
    const minified = JSON.stringify(parsed);
    return {
      size: new Blob([input]).size,
      minifiedSize: new Blob([minified]).size,
      keys: countKeys(parsed),
      depth: getDepth(parsed),
      type: getType(parsed),
    };
  } catch {
    return null;
  }
}

function countKeys(value: any): number {
  if (value === null || typeof value !== 'object') return 0;
  if (Array.isArray(value)) {
    return value.reduce((sum, v) => sum + countKeys(v), 0);
  }
  const own = Object.keys(value).length;
  return own + Object.values(value).reduce((sum: number, v) => sum + countKeys(v), 0);
}

function getDepth(value: any, current = 0): number {
  if (value === null || typeof value !== 'object') return current;
  if (Array.isArray(value)) {
    if (value.length === 0) return current + 1;
    return Math.max(...value.map(v => getDepth(v, current + 1)));
  }
  const vals = Object.values(value);
  if (vals.length === 0) return current + 1;
  return Math.max(...vals.map(v => getDepth(v, current + 1)));
}

function getType(value: any): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `Array[${value.length}]`;
  if (typeof value === 'object') return `Object{${Object.keys(value).length}}`;
  return typeof value;
}

// ── Syntax highlighting ──────────────────────────────────────────────

export interface HighlightToken {
  type: 'key' | 'string' | 'number' | 'boolean' | 'null' | 'brace' | 'bracket' | 'comma' | 'colon' | 'whitespace';
  text: string;
}

export function highlightJson(json: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  let i = 0;
  let expectKey = false;
  const braceStack: string[] = [];

  while (i < json.length) {
    const ch = json[i];

    // Whitespace
    if (/\s/.test(ch)) {
      let ws = '';
      while (i < json.length && /\s/.test(json[i])) { ws += json[i]; i++; }
      tokens.push({ type: 'whitespace', text: ws });
      continue;
    }

    // Braces / Brackets
    if (ch === '{') {
      tokens.push({ type: 'brace', text: '{' });
      braceStack.push('{');
      expectKey = true;
      i++;
      continue;
    }
    if (ch === '}') {
      tokens.push({ type: 'brace', text: '}' });
      braceStack.pop();
      expectKey = false;
      i++;
      continue;
    }
    if (ch === '[') {
      tokens.push({ type: 'bracket', text: '[' });
      braceStack.push('[');
      expectKey = false;
      i++;
      continue;
    }
    if (ch === ']') {
      tokens.push({ type: 'bracket', text: ']' });
      braceStack.pop();
      expectKey = false;
      i++;
      continue;
    }

    // Comma
    if (ch === ',') {
      tokens.push({ type: 'comma', text: ',' });
      expectKey = braceStack[braceStack.length - 1] === '{';
      i++;
      continue;
    }

    // Colon
    if (ch === ':') {
      tokens.push({ type: 'colon', text: ':' });
      expectKey = false;
      i++;
      continue;
    }

    // String
    if (ch === '"') {
      let str = '"';
      i++;
      while (i < json.length) {
        if (json[i] === '\\') {
          str += json[i] + (json[i + 1] ?? '');
          i += 2;
        } else if (json[i] === '"') {
          str += '"';
          i++;
          break;
        } else {
          str += json[i];
          i++;
        }
      }
      tokens.push({ type: expectKey ? 'key' : 'string', text: str });
      expectKey = false;
      continue;
    }

    // Number
    if (/[-0-9]/.test(ch)) {
      let num = '';
      while (i < json.length && /[-0-9.eE+]/.test(json[i])) { num += json[i]; i++; }
      tokens.push({ type: 'number', text: num });
      continue;
    }

    // true, false, null
    if (json.startsWith('true', i)) {
      tokens.push({ type: 'boolean', text: 'true' });
      i += 4;
      continue;
    }
    if (json.startsWith('false', i)) {
      tokens.push({ type: 'boolean', text: 'false' });
      i += 5;
      continue;
    }
    if (json.startsWith('null', i)) {
      tokens.push({ type: 'null', text: 'null' });
      i += 4;
      continue;
    }

    // Unknown character — skip
    tokens.push({ type: 'whitespace', text: ch });
    i++;
  }

  return tokens;
}
