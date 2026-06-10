import type { Tool } from './agent-loop';

let rows: Record<string, string>[] = [];
let filename = '';

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim());
    const obj: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]] = values[i] ?? '';
    }
    return obj;
  });
}

export const AGENT_TOOLS: Tool[] = [
  {
    name: 'load_file',
    description: 'Open a file picker to load a CSV or JSON file. Parses the data and returns a summary.',
    parameters: {},
    execute: async () => {
      let fileHandles: FileSystemFileHandle[];
      try {
        fileHandles = await window.showOpenFilePicker({
          types: [
            {
              description: 'Data files',
              accept: { 'text/csv': ['.csv'], 'application/json': ['.json'] },
            },
          ],
          multiple: false,
        });
      } catch {
        return 'User cancelled file selection.';
      }

      const file = await fileHandles[0].getFile();
      filename = file.name;
      const text = await file.text();

      if (file.name.endsWith('.json')) {
        const parsed = JSON.parse(text);
        rows = Array.isArray(parsed) ? parsed : [parsed];
      } else {
        rows = parseCSV(text);
      }

      if (rows.length === 0) {
        return 'File loaded but contains no data rows.';
      }

      const columns = Object.keys(rows[0]);
      const sample = rows.slice(0, 3).map((r) => JSON.stringify(r)).join('\n');
      return `Loaded "${filename}": ${rows.length} rows, ${columns.length} columns.\nColumns: ${columns.join(', ')}\n\nFirst 3 rows:\n${sample}`;
    },
  },
  {
    name: 'describe_data',
    description: 'Show column statistics: type, unique count, null count, sample values.',
    parameters: {},
    execute: async () => {
      if (rows.length === 0) return 'No data loaded. Use load_file first.';

      const columns = Object.keys(rows[0]);
      const stats = columns.map((col) => {
        const values = rows.map((r) => r[col]);
        const nonNull = values.filter((v) => v !== '' && v !== undefined && v !== null);
        const unique = new Set(nonNull);
        const nullCount = values.length - nonNull.length;
        const isNumber = nonNull.length > 0 && nonNull.every((v) => !isNaN(Number(v)));
        const isDate = nonNull.length > 0 && nonNull.every((v) => !isNaN(Date.parse(v)));
        const type = isNumber ? 'number' : isDate ? 'date' : 'string';
        const samples = [...unique].slice(0, 3).join(', ');
        return `  ${col}: type=${type}, unique=${unique.size}, nulls=${nullCount}, samples=[${samples}]`;
      });

      return `Data: ${rows.length} rows, ${columns.length} columns\n${stats.join('\n')}`;
    },
  },
  {
    name: 'query_data',
    description: 'Filter rows using a JS expression. Returns matching count and first 5 matches.',
    parameters: {
      filter: { type: 'string', description: 'JS expression using "row", e.g. row.age > 18' },
    },
    execute: async (params) => {
      if (rows.length === 0) return 'No data loaded. Use load_file first.';

      const filterExpr = params.filter as string;
      const fn = new Function('row', `return (${filterExpr})`);
      const matches = rows.filter((row) => {
        try {
          return fn(row);
        } catch {
          return false;
        }
      });

      const sample = matches.slice(0, 5).map((r) => JSON.stringify(r)).join('\n');
      return `${matches.length} of ${rows.length} rows match.\n\nFirst 5:\n${sample}`;
    },
  },
  {
    name: 'transform_data',
    description: 'Apply a transformation to a column: trim, lowercase, uppercase, replace, extract, or default.',
    parameters: {
      column: { type: 'string', description: 'Column name to transform' },
      operation: { type: 'string', description: 'Operation: trim, lowercase, uppercase, replace, extract, default' },
      params: { type: 'string', description: 'JSON string with operation args, e.g. {"from":"old","to":"new"} for replace', required: false },
    },
    execute: async (params) => {
      if (rows.length === 0) return 'No data loaded. Use load_file first.';

      const col = params.column as string;
      const op = params.operation as string;
      const opParams = params.params ? JSON.parse(params.params as string) : {};
      let modified = 0;

      for (const row of rows) {
        const original = row[col] ?? '';
        let value = original;

        switch (op) {
          case 'trim':
            value = original.trim();
            break;
          case 'lowercase':
            value = original.toLowerCase();
            break;
          case 'uppercase':
            value = original.toUpperCase();
            break;
          case 'replace':
            value = original.replaceAll(opParams.from ?? '', opParams.to ?? '');
            break;
          case 'extract': {
            const match = original.match(new RegExp(opParams.pattern ?? ''));
            value = match ? (match[1] ?? match[0]) : '';
            break;
          }
          case 'default':
            value = original === '' ? (opParams.value ?? '') : original;
            break;
        }

        if (value !== original) modified++;
        row[col] = value;
      }

      const sample = rows.slice(0, 3).map((r) => `${col}: "${r[col]}"`).join(', ');
      return `Transformed ${modified} of ${rows.length} rows (${op} on "${col}").\nSample: ${sample}`;
    },
  },
  {
    name: 'deduplicate',
    description: 'Remove duplicate rows based on a column.',
    parameters: {
      column: { type: 'string', description: 'Column to deduplicate by' },
    },
    execute: async (params) => {
      if (rows.length === 0) return 'No data loaded. Use load_file first.';

      const col = params.column as string;
      const before = rows.length;
      const seen = new Set<string>();
      rows = rows.filter((row) => {
        const val = row[col] ?? '';
        if (seen.has(val)) return false;
        seen.add(val);
        return true;
      });

      return `Removed ${before - rows.length} duplicates (by "${col}"). ${rows.length} rows remaining.`;
    },
  },
  {
    name: 'add_column',
    description: 'Add a computed column using a JS expression.',
    parameters: {
      name: { type: 'string', description: 'New column name' },
      expression: { type: 'string', description: 'JS expression using "row", e.g. row.first + " " + row.last' },
    },
    execute: async (params) => {
      if (rows.length === 0) return 'No data loaded. Use load_file first.';

      const colName = params.name as string;
      const expr = params.expression as string;
      const fn = new Function('row', `return (${expr})`);

      for (const row of rows) {
        try {
          row[colName] = String(fn(row));
        } catch {
          row[colName] = '';
        }
      }

      const sample = rows.slice(0, 3).map((r) => `${colName}: "${r[colName]}"`).join(', ');
      return `Added column "${colName}" to ${rows.length} rows.\nSample: ${sample}`;
    },
  },
  {
    name: 'export_data',
    description: 'Export the current data as CSV or JSON and trigger a download.',
    parameters: {
      format: { type: 'string', description: 'Export format: csv or json' },
    },
    execute: async (params) => {
      if (rows.length === 0) return 'No data loaded. Use load_file first.';

      const format = params.format as string;
      let content: string;
      let mime: string;
      let ext: string;

      if (format === 'json') {
        content = JSON.stringify(rows, null, 2);
        mime = 'application/json';
        ext = '.json';
      } else {
        const columns = Object.keys(rows[0]);
        const header = columns.join(',');
        const lines = rows.map((r) => columns.map((c) => r[c] ?? '').join(','));
        content = [header, ...lines].join('\n');
        mime = 'text/csv';
        ext = '.csv';
      }

      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const baseName = filename.replace(/\.[^.]+$/, '') || 'data';
      a.href = url;
      a.download = `${baseName}-processed${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return `Downloaded "${baseName}-processed${ext}" (${format.toUpperCase()}, ${rows.length} rows, ${content.length} bytes).`;
    },
  },
];
