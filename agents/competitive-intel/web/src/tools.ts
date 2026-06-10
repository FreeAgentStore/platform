import type { Tool } from './agent-loop';

const notesStore = new Map<string, string>();

interface Competitor {
  name: string;
  url: string;
  features: string[];
  pricing: string;
  strengths: string;
  weaknesses: string;
}

const competitors: Competitor[] = [];

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
    name: 'add_competitor',
    description:
      'Add a competitor to the analysis. Store structured data about a competitor for later comparison.',
    parameters: {
      name: { type: 'string', description: 'Competitor company/product name' },
      url: { type: 'string', description: 'Competitor website URL' },
      features: { type: 'string', description: 'Comma-separated list of key features' },
      pricing: { type: 'string', description: 'Pricing summary (e.g. "Free tier + $10/mo pro")' },
      strengths: { type: 'string', description: 'Key strengths' },
      weaknesses: { type: 'string', description: 'Key weaknesses' },
    },
    execute: async (params) => {
      const name = String(params.name ?? '');
      if (!name) return 'Error: name is required.';

      const entry: Competitor = {
        name,
        url: String(params.url ?? ''),
        features: String(params.features ?? '')
          .split(',')
          .map((f) => f.trim())
          .filter(Boolean),
        pricing: String(params.pricing ?? 'Unknown'),
        strengths: String(params.strengths ?? ''),
        weaknesses: String(params.weaknesses ?? ''),
      };

      const existing = competitors.findIndex((c) => c.name.toLowerCase() === name.toLowerCase());
      if (existing >= 0) {
        competitors[existing] = entry;
        return `Updated competitor "${name}". Total competitors: ${competitors.length}.`;
      }

      competitors.push(entry);
      return `Added competitor "${name}". Total competitors: ${competitors.length}.`;
    },
  },
  {
    name: 'get_competitors',
    description: 'Retrieve all stored competitors with their details.',
    parameters: {},
    execute: async () => {
      if (competitors.length === 0) return 'No competitors added yet. Use add_competitor first.';

      return competitors
        .map(
          (c, i) =>
            `### ${i + 1}. ${c.name}\n` +
            `URL: ${c.url}\n` +
            `Features: ${c.features.join(', ')}\n` +
            `Pricing: ${c.pricing}\n` +
            `Strengths: ${c.strengths}\n` +
            `Weaknesses: ${c.weaknesses}`,
        )
        .join('\n\n');
    },
  },
  {
    name: 'build_matrix',
    description:
      'Generate a markdown comparison table from all stored competitors. Call add_competitor for each competitor first.',
    parameters: {},
    execute: async () => {
      if (competitors.length === 0)
        return 'No competitors to compare. Use add_competitor to add at least 2 competitors first.';

      // Collect all unique features
      const allFeatures = new Set<string>();
      for (const c of competitors) {
        for (const f of c.features) allFeatures.add(f);
      }
      const featureList = [...allFeatures].sort();

      // Build markdown table
      const header = `| Feature | ${competitors.map((c) => c.name).join(' | ')} |`;
      const separator = `|---|${competitors.map(() => '---').join('|')}|`;

      const rows: string[] = [];

      // Pricing row
      rows.push(`| **Pricing** | ${competitors.map((c) => c.pricing).join(' | ')} |`);

      // Feature rows
      for (const feature of featureList) {
        const cells = competitors.map((c) =>
          c.features.some((f) => f.toLowerCase() === feature.toLowerCase()) ? 'Yes' : '-',
        );
        rows.push(`| ${feature} | ${cells.join(' | ')} |`);
      }

      // Strengths row
      rows.push(`| **Strengths** | ${competitors.map((c) => c.strengths).join(' | ')} |`);

      // Weaknesses row
      rows.push(`| **Weaknesses** | ${competitors.map((c) => c.weaknesses).join(' | ')} |`);

      return `# Competitive Comparison Matrix\n\n${header}\n${separator}\n${rows.join('\n')}\n\n_${competitors.length} competitors analyzed._`;
    },
  },
];
