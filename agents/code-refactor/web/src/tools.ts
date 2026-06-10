import type { Tool } from './agent-loop';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.cache']);
const MAX_FILES = 300;

let dirHandle: FileSystemDirectoryHandle | null = null;
let fileTree: string[] = [];

async function walkDir(handle: FileSystemDirectoryHandle, prefix: string): Promise<void> {
  for await (const entry of (handle as any).values()) {
    if (fileTree.length >= MAX_FILES) return;
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.kind === 'directory') {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walkDir(entry, path);
    } else {
      fileTree.push(path);
    }
  }
}

async function getFileHandle(path: string): Promise<FileSystemFileHandle> {
  if (!dirHandle) throw new Error('No folder opened. Use open_folder first.');
  const segments = path.split('/');
  let current: FileSystemDirectoryHandle = dirHandle;
  for (let i = 0; i < segments.length - 1; i++) {
    current = await current.getDirectoryHandle(segments[i]);
  }
  return current.getFileHandle(segments[segments.length - 1]);
}

async function readFileContent(path: string): Promise<string> {
  const handle = await getFileHandle(path);
  const file = await handle.getFile();
  return file.text();
}

async function writeFileContent(path: string, content: string): Promise<void> {
  if (!dirHandle) throw new Error('No folder opened. Use open_folder first.');
  const segments = path.split('/');
  let current: FileSystemDirectoryHandle = dirHandle;
  for (let i = 0; i < segments.length - 1; i++) {
    current = await current.getDirectoryHandle(segments[i], { create: true });
  }
  const fileHandle = await current.getFileHandle(segments[segments.length - 1], { create: true });
  const writable = await (fileHandle as any).createWritable();
  await writable.write(content);
  await writable.close();
}

export const AGENT_TOOLS: Tool[] = [
  {
    name: 'open_folder',
    description: 'Open a local folder using the file picker. Recursively lists files (up to 300), skipping node_modules, .git, dist, build, coverage.',
    parameters: {},
    execute: async () => {
      dirHandle = await (window as any).showDirectoryPicker();
      fileTree = [];
      await walkDir(dirHandle!, '');
      fileTree.sort();
      return `Opened folder: ${dirHandle!.name}\n${fileTree.length} files found:\n${fileTree.join('\n')}`;
    },
  },
  {
    name: 'read_file',
    description: 'Read the contents of a file (first 8000 chars).',
    parameters: {
      path: { type: 'string', description: 'Relative path to the file' },
    },
    execute: async (params) => {
      const path = String(params.path);
      const content = await readFileContent(path);
      if (content.length > 8000) {
        return content.slice(0, 8000) + `\n\n... (truncated, ${content.length} total chars)`;
      }
      return content;
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file. Creates directories if needed.',
    parameters: {
      path: { type: 'string', description: 'Relative path to the file' },
      content: { type: 'string', description: 'The full file content to write' },
    },
    execute: async (params) => {
      const path = String(params.path);
      const content = String(params.content);
      await writeFileContent(path, content);
      return `Wrote ${new Blob([content]).size} bytes to ${path}`;
    },
  },
  {
    name: 'find_replace',
    description: 'Find and replace in a file using regex.',
    parameters: {
      path: { type: 'string', description: 'Relative path to the file' },
      find: { type: 'string', description: 'Regex pattern to find' },
      replace: { type: 'string', description: 'Replacement string' },
      flags: { type: 'string', description: 'Regex flags (default: "g")', required: false },
    },
    execute: async (params) => {
      const path = String(params.path);
      const find = String(params.find);
      const replace = String(params.replace);
      const flags = String(params.flags ?? 'g');

      const original = await readFileContent(path);
      const regex = new RegExp(find, flags);
      let count = 0;
      const changed: string[] = [];

      const updated = original.replace(regex, (...args) => {
        count++;
        const result = replace.replace(/\$(\d+)/g, (_, n) => args[Number(n)] ?? '');
        if (changed.length < 3) {
          changed.push(`  - "${args[0]}" -> "${result}"`);
        }
        return args[0].replace(regex, replace);
      });

      // Re-do the replacement properly (the above was just for counting)
      const finalContent = original.replace(regex, replace);
      await writeFileContent(path, finalContent);

      return `${count} replacement(s) in ${path}\n${changed.join('\n')}`;
    },
  },
  {
    name: 'search_files',
    description: 'Search all files for a regex pattern. Returns matching file paths and line numbers (max 20 results).',
    parameters: {
      pattern: { type: 'string', description: 'Regex pattern to search for' },
      glob: { type: 'string', description: 'File extension filter, e.g. ".ts" (optional)', required: false },
    },
    execute: async (params) => {
      if (!dirHandle) throw new Error('No folder opened. Use open_folder first.');
      const pattern = String(params.pattern);
      const glob = params.glob ? String(params.glob) : '';
      const regex = new RegExp(pattern, 'gi');
      const results: string[] = [];

      const filtered = glob
        ? fileTree.filter((f) => f.endsWith(glob))
        : fileTree;

      for (const filePath of filtered) {
        if (results.length >= 20) break;
        try {
          const content = await readFileContent(filePath);
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
              results.push(`${filePath}:${i + 1}: ${lines[i].trim().slice(0, 100)}`);
              if (results.length >= 20) break;
            }
            regex.lastIndex = 0;
          }
        } catch {
          // skip unreadable files
        }
      }

      return results.length > 0
        ? `${results.length} match(es):\n${results.join('\n')}`
        : 'No matches found.';
    },
  },
  {
    name: 'list_files',
    description: 'List files in the opened folder, optionally filtered by a simple glob pattern like "*.ts".',
    parameters: {
      pattern: { type: 'string', description: 'Simple glob filter, e.g. "*.ts" (optional)', required: false },
    },
    execute: async (params) => {
      if (!dirHandle) throw new Error('No folder opened. Use open_folder first.');
      const pattern = params.pattern ? String(params.pattern) : '';
      let files = fileTree;
      if (pattern) {
        const ext = pattern.startsWith('*') ? pattern.slice(1) : pattern;
        files = fileTree.filter((f) => f.endsWith(ext));
      }
      return `${files.length} file(s):\n${files.join('\n')}`;
    },
  },
  {
    name: 'get_file_tree',
    description: 'Return the cached file tree from the last open_folder call.',
    parameters: {},
    execute: async () => {
      if (!dirHandle) throw new Error('No folder opened. Use open_folder first.');
      return `${fileTree.length} file(s) in ${dirHandle.name}:\n${fileTree.join('\n')}`;
    },
  },
];
