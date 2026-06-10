import type { Tool } from './agent-loop';

const notesStore = new Map<string, string>();

export const AGENT_TOOLS: Tool[] = [
  {
    name: 'web_search',
    description:
      'Search the web for a topic using DuckDuckGo Instant Answer API. Returns abstract, related topics, and links.',
    parameters: {
      query: { type: 'string', description: 'The search query' },
    },
    execute: async (params) => {
      const query = String(params.query ?? '');
      if (!query) return 'Error: query is required.';

      try {
        const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
        const res = await fetch(url);
        if (!res.ok) return `Search failed with status ${res.status}.`;

        const data = await res.json();
        const parts: string[] = [];

        if (data.Abstract) {
          parts.push(`Abstract: ${data.Abstract}`);
          if (data.AbstractURL) parts.push(`Source: ${data.AbstractURL}`);
        }

        if (data.RelatedTopics?.length) {
          parts.push('\nRelated Topics:');
          for (const topic of data.RelatedTopics.slice(0, 8)) {
            if (topic.Text && topic.FirstURL) {
              parts.push(`- ${topic.Text}\n  URL: ${topic.FirstURL}`);
            } else if (topic.Topics) {
              for (const sub of topic.Topics.slice(0, 3)) {
                if (sub.Text && sub.FirstURL) {
                  parts.push(`- ${sub.Text}\n  URL: ${sub.FirstURL}`);
                }
              }
            }
          }
        }

        if (data.Results?.length) {
          parts.push('\nDirect Results:');
          for (const r of data.Results.slice(0, 4)) {
            parts.push(`- ${r.Text}\n  URL: ${r.FirstURL}`);
          }
        }

        if (parts.length === 0) {
          return `No instant answers found for "${query}". Try fetch_page on a specific URL, or refine the query.`;
        }

        return parts.join('\n');
      } catch (err: any) {
        return `Search error: ${err.message}`;
      }
    },
  },
  {
    name: 'fetch_page',
    description:
      'Fetch a web page and extract its text content. Returns the first 3000 characters of clean text.',
    parameters: {
      url: { type: 'string', description: 'The URL to fetch' },
    },
    execute: async (params) => {
      const url = String(params.url ?? '');
      if (!url) return 'Error: url is required.';

      try {
        const res = await fetch(url);
        if (!res.ok) return `Fetch failed with status ${res.status}.`;

        const html = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Remove script, style, nav, footer, header elements
        for (const tag of ['script', 'style', 'nav', 'footer', 'header', 'noscript', 'svg']) {
          doc.querySelectorAll(tag).forEach((el) => el.remove());
        }

        const text = (doc.body?.textContent ?? '')
          .replace(/\s+/g, ' ')
          .trim();

        if (!text) return 'Page returned no text content.';
        return text.slice(0, 3000);
      } catch (err: any) {
        if (err.message?.includes('Failed to fetch') || err.name === 'TypeError') {
          return `CORS blocked for ${url} — the server does not allow cross-origin requests. Try a different URL or use the search results directly.`;
        }
        return `Fetch error: ${err.message}`;
      }
    },
  },
  {
    name: 'take_notes',
    description:
      'Store research notes on a topic. Use this to accumulate findings as you research.',
    parameters: {
      topic: { type: 'string', description: 'The topic or heading for these notes' },
      notes: { type: 'string', description: 'The notes to store' },
    },
    execute: async (params) => {
      const topic = String(params.topic ?? '');
      const notes = String(params.notes ?? '');
      if (!topic || !notes) return 'Error: both topic and notes are required.';

      const existing = notesStore.get(topic);
      if (existing) {
        notesStore.set(topic, existing + '\n' + notes);
      } else {
        notesStore.set(topic, notes);
      }
      return `Notes saved under "${topic}". Total topics tracked: ${notesStore.size}.`;
    },
  },
  {
    name: 'get_notes',
    description: 'Retrieve all accumulated research notes.',
    parameters: {},
    execute: async () => {
      if (notesStore.size === 0) return 'No notes recorded yet.';

      const parts: string[] = [];
      for (const [topic, notes] of notesStore) {
        parts.push(`## ${topic}\n${notes}`);
      }
      return parts.join('\n\n');
    },
  },
  {
    name: 'compile_report',
    description:
      'Compile a structured report from sections. Pass a title and a JSON array of section objects with "heading" and "content" fields.',
    parameters: {
      title: { type: 'string', description: 'The report title' },
      sections: {
        type: 'string',
        description:
          'JSON string: array of objects with "heading" and "content" fields, e.g. [{"heading":"Intro","content":"..."}]',
      },
    },
    execute: async (params) => {
      const title = String(params.title ?? '');
      const sectionsRaw = String(params.sections ?? '[]');

      if (!title) return 'Error: title is required.';

      let sections: Array<{ heading: string; content: string }>;
      try {
        sections = JSON.parse(sectionsRaw);
      } catch {
        return 'Error: sections must be a valid JSON array of {heading, content} objects.';
      }

      if (!Array.isArray(sections) || sections.length === 0) {
        return 'Error: sections must be a non-empty array.';
      }

      const lines: string[] = [`# ${title}`, ''];
      for (const s of sections) {
        lines.push(`## ${s.heading}`, '', s.content, '');
      }
      lines.push(`---`, `Report compiled at ${new Date().toISOString()}`);

      return lines.join('\n');
    },
  },
];
