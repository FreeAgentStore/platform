import type { Tool } from './agent-loop';

const PLATFORM = 'https://freeagentstore.online';
const notesStore = new Map<string, string>();

export const AGENT_TOOLS: Tool[] = [
  {
    name: 'web_search',
    description: 'Search the web. Returns up to 10 results with title, URL, and snippet.',
    parameters: {
      query: { type: 'string', description: 'The search query' },
    },
    execute: async (params) => {
      const query = String(params.query ?? '');
      if (!query) return 'Error: query is required.';

      const res = await fetch(`${PLATFORM}/v1/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) return `Search failed (${res.status}): ${await res.text().catch(() => '')}`;

      const data = await res.json() as { results: Array<{ title: string; url: string; snippet: string }>; count: number };
      if (data.count === 0) return `No results found for "${query}".`;

      return data.results
        .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`)
        .join('\n\n');
    },
  },
  {
    name: 'read_page',
    description: 'Fetch a web page and extract its text content. Returns title and cleaned text (up to 8KB).',
    parameters: {
      url: { type: 'string', description: 'The URL to fetch' },
    },
    execute: async (params) => {
      const url = String(params.url ?? '');
      if (!url) return 'Error: url is required.';

      const res = await fetch(`${PLATFORM}/v1/fetch?url=${encodeURIComponent(url)}`);
      if (!res.ok) return `Fetch failed (${res.status}): ${await res.text().catch(() => '')}`;

      const data = await res.json() as { title: string; content: string; length: number; truncated: boolean };
      let out = '';
      if (data.title) out += `Title: ${data.title}\n\n`;
      out += data.content;
      if (data.truncated) out += `\n\n[Truncated — ${data.length} chars total]`;
      return out;
    },
  },
  {
    name: 'take_notes',
    description: 'Save research notes on a topic. Appends to existing notes for that topic.',
    parameters: {
      topic: { type: 'string', description: 'Topic heading' },
      notes: { type: 'string', description: 'Notes to save' },
    },
    execute: async (params) => {
      const topic = String(params.topic ?? '');
      const notes = String(params.notes ?? '');
      if (!topic || !notes) return 'Error: topic and notes are required.';

      const existing = notesStore.get(topic) ?? '';
      notesStore.set(topic, existing ? `${existing}\n\n${notes}` : notes);
      return `Notes saved under "${topic}" (${notesStore.size} topics total).`;
    },
  },
  {
    name: 'get_notes',
    description: 'Retrieve all notes taken so far, organized by topic.',
    parameters: {},
    execute: async () => {
      if (notesStore.size === 0) return 'No notes taken yet.';
      return [...notesStore.entries()]
        .map(([topic, notes]) => `## ${topic}\n${notes}`)
        .join('\n\n---\n\n');
    },
  },
  {
    name: 'compile_report',
    description: 'Compile a final report from a title and sections JSON array.',
    parameters: {
      title: { type: 'string', description: 'Report title' },
      sections: { type: 'string', description: 'JSON array of {heading, content} objects' },
    },
    execute: async (params) => {
      const title = String(params.title ?? 'Research Report');
      let sections: Array<{ heading: string; content: string }> = [];
      try {
        sections = JSON.parse(String(params.sections ?? '[]'));
      } catch {
        return 'Error: sections must be valid JSON array of {heading, content}.';
      }
      return [
        `# ${title}`,
        `*Generated ${new Date().toISOString().split('T')[0]}*`,
        '',
        ...sections.map((s) => `## ${s.heading}\n\n${s.content}`),
      ].join('\n\n');
    },
  },
];
