import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

export function applyRuntimeMetadata(html, agent) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(agent.id) || !agent.name?.trim() || !agent.description?.trim()) {
    throw new Error('Published runtime metadata requires an id, name and description');
  }
  if (/AGENTNAME/.test(agent.name + agent.description)) throw new Error('Template identity in registry');
  const url = `https://freeagentstore.online/a/${agent.id}/`;
  const title = `${escapeHtml(agent.name)} — FreeAgentStore`;
  const description = escapeHtml(agent.description);
  let heads = 0;
  const output = html.replace(/(<head\b[^>]*>)([\s\S]*?)(<\/head>)/gi, (_, start, head, end) => {
    heads++;
    const clean = head.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
      .replace(/<(meta|link)\b[^>]*>/gi, (tag, type) => {
        const attrs = Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)]
          .map((match) => [match[1].toLowerCase(), match[2]]));
        const owned = type.toLowerCase() === 'link' ? attrs.rel?.toLowerCase() === 'canonical' :
          /^(description|twitter:title|twitter:description)$/i.test(attrs.name ?? '') ||
          /^og:(title|description|url)$/i.test(attrs.property ?? '');
        return owned ? '' : tag;
      });
    // Runnable tools and descriptive catalogue pages are distinct public pages.
    // Each keeps its own canonical; neither is canonicalized to the store homepage.
    return `${start}${clean.trimEnd()}\n<title>${title}</title>\n` +
      `<meta name="description" content="${description}">\n` +
      `<link rel="canonical" href="${url}">\n` +
      `<meta property="og:title" content="${title}">\n` +
      `<meta property="og:description" content="${description}">\n` +
      `<meta property="og:url" content="${url}">\n` +
      `<meta name="twitter:title" content="${title}">\n` +
      `<meta name="twitter:description" content="${description}">\n${end}`;
  });
  if (heads !== 1) throw new Error('Runtime HTML must have exactly one head');
  validateRuntimeMetadata(output, agent);
  return output;
}

export function validateRuntimeMetadata(html, agent) {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? '';
  const title = `<title>${escapeHtml(agent.name)} — FreeAgentStore</title>`;
  const canonical = `<link rel="canonical" href="https://freeagentstore.online/a/${agent.id}/">`;
  if (!head.includes(title) || !head.includes(canonical) || /AGENTNAME/.test(head) ||
      (head.match(/<title\b/gi) ?? []).length !== 1 ||
      (head.match(/\brel=["']canonical["']/gi) ?? []).length !== 1 ||
      !head.includes(`<meta name="description" content="${escapeHtml(agent.description)}">`)) {
    throw new Error(`Built runtime metadata does not match published identity: ${agent.id}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [id, file] = process.argv.slice(2);
  if (!id || !file) throw new Error('Usage: node store/runtime-metadata.js <slug> <built-index.html>');
  const registry = JSON.parse(fs.readFileSync(path.join(directory, 'registry.json'), 'utf8'));
  const agent = registry.agents.find((item) => item.id === id);
  if (!agent) {
    console.log(`No public catalogue metadata applied to unlisted runtime: ${id}`);
  } else {
    const output = applyRuntimeMetadata(fs.readFileSync(file, 'utf8'), agent);
    fs.writeFileSync(file, output);
    console.log(`Validated built runtime identity: ${id}`);
  }
}
