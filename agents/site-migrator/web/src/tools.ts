import type { Tool } from './agent-loop';

// Module-level state
const pages = new Map<string, { title: string; markdown: string; url: string }>();
const crawled = new Set<string>();

export const AGENT_TOOLS: Tool[] = [
  {
    name: 'fetch_page',
    description: 'Fetches a URL and extracts structured content: title, meta description, main content text, internal links, and image URLs. Strips nav/footer/script/style tags.',
    parameters: {
      url: { type: 'string', description: 'The URL to fetch' },
    },
    execute: async (params) => {
      const url = String(params.url);
      crawled.add(url);

      try {
        const response = await fetch(url);
        if (!response.ok) {
          return `Error: HTTP ${response.status} fetching ${url}`;
        }
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Extract title
        const title = doc.querySelector('title')?.textContent?.trim() ?? '';

        // Extract meta description
        const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute('content') ?? '';

        // Remove unwanted elements
        const removeSelectors = ['nav', 'footer', 'script', 'style', 'header', 'aside', '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]'];
        for (const sel of removeSelectors) {
          doc.querySelectorAll(sel).forEach((el) => el.remove());
        }

        // Extract main content text
        const mainEl = doc.querySelector('main') ?? doc.querySelector('article') ?? doc.body;
        const contentText = mainEl?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 3000) ?? '';

        // Extract internal links
        const baseUrl = new URL(url);
        const links: string[] = [];
        doc.querySelectorAll('a[href]').forEach((a) => {
          const href = a.getAttribute('href');
          if (!href) return;
          try {
            const resolved = new URL(href, url);
            if (resolved.hostname === baseUrl.hostname && !links.includes(resolved.href)) {
              links.push(resolved.href);
            }
          } catch {}
        });

        // Extract image URLs
        const images: string[] = [];
        doc.querySelectorAll('img[src]').forEach((img) => {
          const src = img.getAttribute('src');
          if (!src) return;
          try {
            const resolved = new URL(src, url).href;
            if (!images.includes(resolved)) {
              images.push(resolved);
            }
          } catch {}
        });

        return JSON.stringify({
          url,
          title,
          metaDescription: metaDesc,
          contentPreview: contentText.slice(0, 1500),
          internalLinks: links.slice(0, 50),
          images: images.slice(0, 30),
          contentLength: contentText.length,
        }, null, 2);
      } catch (err: any) {
        return `Error fetching ${url}: ${err.message}. This may be a CORS issue \u2014 the site may not allow cross-origin requests from the browser.`;
      }
    },
  },

  {
    name: 'extract_links',
    description: 'Parses HTML to find all same-domain <a> tags. Returns a deduplicated list of internal URLs.',
    parameters: {
      url: { type: 'string', description: 'The base URL (for resolving relative links and filtering same-domain)' },
      html: { type: 'string', description: 'The HTML string to parse' },
    },
    execute: async (params) => {
      const url = String(params.url);
      const html = String(params.html);

      try {
        const baseUrl = new URL(url);
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const links = new Set<string>();
        doc.querySelectorAll('a[href]').forEach((a) => {
          const href = a.getAttribute('href');
          if (!href) return;
          try {
            const resolved = new URL(href, url);
            if (resolved.hostname === baseUrl.hostname) {
              resolved.hash = '';
              links.add(resolved.href);
            }
          } catch {}
        });

        const deduplicated = Array.from(links);
        return JSON.stringify({
          baseUrl: url,
          linkCount: deduplicated.length,
          links: deduplicated,
        }, null, 2);
      } catch (err: any) {
        return `Error extracting links: ${err.message}`;
      }
    },
  },

  {
    name: 'html_to_markdown',
    description: 'Converts an HTML string to markdown using simple conversion rules for headings, paragraphs, links, images, bold, italic, lists, code, and pre blocks. Strips all other tags.',
    parameters: {
      html: { type: 'string', description: 'The HTML string to convert to markdown' },
    },
    execute: async (params) => {
      const html = String(params.html);

      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Remove script, style, nav, footer
        doc.querySelectorAll('script, style, nav, footer').forEach((el) => el.remove());

        function convertNode(node: Node): string {
          if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent?.replace(/\s+/g, ' ') ?? '';
          }

          if (node.nodeType !== Node.ELEMENT_NODE) return '';

          const el = node as Element;
          const tag = el.tagName.toLowerCase();
          const children = Array.from(el.childNodes).map(convertNode).join('');

          switch (tag) {
            case 'h1': return `\n\n# ${children.trim()}\n\n`;
            case 'h2': return `\n\n## ${children.trim()}\n\n`;
            case 'h3': return `\n\n### ${children.trim()}\n\n`;
            case 'h4': return `\n\n#### ${children.trim()}\n\n`;
            case 'h5': return `\n\n##### ${children.trim()}\n\n`;
            case 'h6': return `\n\n###### ${children.trim()}\n\n`;
            case 'p': return `\n\n${children.trim()}\n\n`;
            case 'br': return '\n';
            case 'a': {
              const href = el.getAttribute('href') ?? '';
              const text = children.trim();
              return text ? `[${text}](${href})` : '';
            }
            case 'img': {
              const src = el.getAttribute('src') ?? '';
              const alt = el.getAttribute('alt') ?? '';
              return `![${alt}](${src})`;
            }
            case 'strong':
            case 'b':
              return `**${children.trim()}**`;
            case 'em':
            case 'i':
              return `*${children.trim()}*`;
            case 'code':
              return `\`${children.trim()}\``;
            case 'pre': {
              const codeContent = el.querySelector('code')?.textContent ?? children.trim();
              return `\n\n\`\`\`\n${codeContent}\n\`\`\`\n\n`;
            }
            case 'ul':
            case 'ol':
              return `\n\n${children}\n\n`;
            case 'li':
              return `- ${children.trim()}\n`;
            case 'blockquote':
              return `\n\n> ${children.trim()}\n\n`;
            case 'hr':
              return '\n\n---\n\n';
            case 'div':
            case 'section':
            case 'article':
            case 'main':
              return children;
            default:
              return children;
          }
        }

        const body = doc.querySelector('main') ?? doc.querySelector('article') ?? doc.body;
        let markdown = convertNode(body);

        // Clean up excessive whitespace
        markdown = markdown.replace(/\n{3,}/g, '\n\n').trim();

        return markdown;
      } catch (err: any) {
        return `Error converting HTML to markdown: ${err.message}`;
      }
    },
  },

  {
    name: 'add_page',
    description: 'Stores a migrated page (URL, title, markdown content) in the internal pages map. Returns confirmation with total page count.',
    parameters: {
      url: { type: 'string', description: 'The original URL of the page' },
      title: { type: 'string', description: 'The page title' },
      markdown: { type: 'string', description: 'The markdown content of the page' },
    },
    execute: async (params) => {
      const url = String(params.url);
      const title = String(params.title);
      const markdown = String(params.markdown);

      pages.set(url, { title, markdown, url });

      return `Page stored: "${title}" (${url}). Total pages: ${pages.size}. Crawled URLs: ${crawled.size}.`;
    },
  },

  {
    name: 'get_sitemap',
    description: 'Returns all stored pages as a formatted sitemap showing title and URL for each page.',
    parameters: {},
    execute: async () => {
      if (pages.size === 0) {
        return 'No pages stored yet. Use fetch_page and add_page to build the sitemap.';
      }

      const entries = Array.from(pages.values());
      const sitemap = entries
        .map((p, i) => `${i + 1}. ${p.title}\n   ${p.url}`)
        .join('\n');

      return `Sitemap (${pages.size} pages):\n\n${sitemap}\n\nCrawled URLs: ${crawled.size}`;
    },
  },

  {
    name: 'export_site',
    description: 'Compiles all stored pages into a downloadable JSON file containing the full migrated site. Triggers a browser download.',
    parameters: {},
    execute: async () => {
      if (pages.size === 0) {
        return 'No pages to export. Add pages first using add_page.';
      }

      const entries = Array.from(pages.values());
      const exportData = {
        exportedAt: new Date().toISOString(),
        pageCount: entries.length,
        crawledUrls: Array.from(crawled),
        pages: entries.map((p) => ({
          url: p.url,
          title: p.title,
          filename: p.url
            .replace(/https?:\/\//, '')
            .replace(/[^a-zA-Z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '') + '.md',
          markdown: p.markdown,
        })),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `site-migration-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const summary = entries.map((p) => `- ${p.title} (${p.markdown.length} chars)`).join('\n');

      return `Exported ${entries.length} pages as JSON download.\n\nPages:\n${summary}`;
    },
  },
];
