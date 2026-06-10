import type { Tool } from './agent-loop';

let dirHandle: FileSystemDirectoryHandle | null = null;
let fileTree: string[] = [];

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build']);

async function walkDirectory(
  handle: FileSystemDirectoryHandle,
  prefix: string,
  files: string[],
  limit: number,
): Promise<void> {
  for await (const entry of handle.values()) {
    if (files.length >= limit) return;
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.kind === 'directory') {
      if (SKIP_DIRS.has(entry.name)) continue;
      const subHandle = await handle.getDirectoryHandle(entry.name);
      await walkDirectory(subHandle, path, files, limit);
    } else {
      files.push(path);
    }
  }
}

async function resolveFile(path: string): Promise<File> {
  if (!dirHandle) throw new Error('No folder opened. Use open_folder first.');
  const segments = path.split('/').filter(Boolean);
  let current: FileSystemDirectoryHandle = dirHandle;
  for (let i = 0; i < segments.length - 1; i++) {
    current = await current.getDirectoryHandle(segments[i]);
  }
  const fileHandle = await current.getFileHandle(segments[segments.length - 1]);
  return fileHandle.getFile();
}

export const AGENT_TOOLS: Tool[] = [
  {
    name: 'open_folder',
    description: 'Open a directory picker to select a code folder. Recursively lists all files (up to 200), skipping node_modules, .git, dist, build.',
    parameters: {},
    execute: async () => {
      try {
        dirHandle = await window.showDirectoryPicker();
      } catch {
        return 'User cancelled folder selection.';
      }

      fileTree = [];
      await walkDirectory(dirHandle, '', fileTree, 200);
      fileTree.sort();

      return `Opened "${dirHandle.name}" — ${fileTree.length} files found.\n\n${fileTree.join('\n')}`;
    },
  },
  {
    name: 'read_file',
    description: 'Read a file from the opened folder. Returns the first 5000 characters.',
    parameters: {
      path: { type: 'string', description: 'Relative path to the file within the opened folder' },
    },
    execute: async (params) => {
      if (!dirHandle) return 'No folder opened. Use open_folder first.';

      const path = params.path as string;
      try {
        const file = await resolveFile(path);
        const text = await file.text();
        const content = text.slice(0, 5000);
        const truncated = text.length > 5000 ? `\n\n... (truncated, ${text.length} total chars)` : '';
        return `File: ${path} (${text.length} chars)\n\n${content}${truncated}`;
      } catch (err: any) {
        return `Error reading "${path}": ${err.message}`;
      }
    },
  },
  {
    name: 'list_files',
    description: 'Filter the file tree by a simple pattern like "*.ts" or "src/**".',
    parameters: {
      pattern: { type: 'string', description: 'Simple glob pattern, e.g. "*.ts" or "src/**"' },
    },
    execute: async (params) => {
      if (fileTree.length === 0) return 'No folder opened. Use open_folder first.';

      const pattern = params.pattern as string;
      let matches: string[];

      if (pattern.includes('**')) {
        const prefix = pattern.replace('/**', '').replace('**/', '');
        matches = fileTree.filter((f) => f.startsWith(prefix) || f.includes(`/${prefix}`));
      } else if (pattern.startsWith('*.')) {
        const ext = pattern.slice(1);
        matches = fileTree.filter((f) => f.endsWith(ext));
      } else {
        matches = fileTree.filter((f) => f.includes(pattern));
      }

      if (matches.length === 0) return `No files match "${pattern}".`;
      return `${matches.length} files match "${pattern}":\n\n${matches.join('\n')}`;
    },
  },
  {
    name: 'analyze_code',
    description: 'Read a file and return a structural summary: language, line count, exports, imports, functions, classes.',
    parameters: {
      path: { type: 'string', description: 'Relative path to the file to analyze' },
    },
    execute: async (params) => {
      if (!dirHandle) return 'No folder opened. Use open_folder first.';

      const path = params.path as string;
      try {
        const file = await resolveFile(path);
        const text = await file.text();
        const lines = text.split('\n');

        const ext = path.split('.').pop() ?? '';
        const langMap: Record<string, string> = {
          ts: 'TypeScript', tsx: 'TypeScript (JSX)', js: 'JavaScript', jsx: 'JavaScript (JSX)',
          py: 'Python', rs: 'Rust', go: 'Go', java: 'Java', json: 'JSON', md: 'Markdown',
          css: 'CSS', html: 'HTML', yml: 'YAML', yaml: 'YAML',
        };
        const language = langMap[ext] ?? ext;

        const exports = lines.filter((l) => /^export\s/.test(l)).map((l) => l.trim().slice(0, 80));
        const imports = lines.filter((l) => /^import\s/.test(l)).map((l) => l.trim().slice(0, 80));
        const functions = lines
          .filter((l) => /(?:^|\s)(?:function\s+\w|(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\()/.test(l))
          .map((l) => l.trim().slice(0, 80));
        const classes = lines.filter((l) => /^(?:export\s+)?(?:abstract\s+)?class\s/.test(l)).map((l) => l.trim().slice(0, 80));
        const interfaces = lines.filter((l) => /^(?:export\s+)?interface\s/.test(l)).map((l) => l.trim().slice(0, 80));

        const parts = [
          `File: ${path}`,
          `Language: ${language}`,
          `Lines: ${lines.length}`,
        ];

        if (imports.length > 0) parts.push(`\nImports (${imports.length}):\n${imports.join('\n')}`);
        if (exports.length > 0) parts.push(`\nExports (${exports.length}):\n${exports.join('\n')}`);
        if (functions.length > 0) parts.push(`\nFunctions (${functions.length}):\n${functions.join('\n')}`);
        if (classes.length > 0) parts.push(`\nClasses (${classes.length}):\n${classes.join('\n')}`);
        if (interfaces.length > 0) parts.push(`\nInterfaces (${interfaces.length}):\n${interfaces.join('\n')}`);

        return parts.join('\n');
      } catch (err: any) {
        return `Error analyzing "${path}": ${err.message}`;
      }
    },
  },
  {
    name: 'write_doc',
    description: 'Create a documentation file in the opened folder (or a docs/ subfolder).',
    parameters: {
      filename: { type: 'string', description: 'Filename to create, e.g. "README.md" or "docs/API.md"' },
      content: { type: 'string', description: 'The documentation content to write' },
    },
    execute: async (params) => {
      if (!dirHandle) return 'No folder opened. Use open_folder first.';

      const filename = params.filename as string;
      const content = params.content as string;
      const segments = filename.split('/').filter(Boolean);

      try {
        let current: FileSystemDirectoryHandle = dirHandle;
        for (let i = 0; i < segments.length - 1; i++) {
          current = await current.getDirectoryHandle(segments[i], { create: true });
        }

        const fileHandle = await current.getFileHandle(segments[segments.length - 1], { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();

        return `Created "${filename}" (${content.length} chars) in ${dirHandle.name}/.`;
      } catch (err: any) {
        return `Error writing "${filename}": ${err.message}`;
      }
    },
  },
  {
    name: 'get_file_tree',
    description: 'Return the cached file tree from the last open_folder call.',
    parameters: {},
    execute: async () => {
      if (fileTree.length === 0) return 'No folder opened. Use open_folder first.';
      return `${fileTree.length} files:\n\n${fileTree.join('\n')}`;
    },
  },
];
