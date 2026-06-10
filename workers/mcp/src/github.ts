// GitHub Git Data API helpers — vendored from FAS MCP.
// Fetch templates, push files as one commit, read files.

const UA = 'freeagentstore-mcp';
const TEXT_RE = /\.(ts|tsx|js|jsx|mjs|cjs|json|html|css|md|txt|svg|yml|yaml|toml)$/i;

async function gh(token: string | undefined, url: string, method = 'GET', body?: unknown): Promise<any> {
  const res = await fetch(url, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Accept: 'application/vnd.github+json',
      'User-Agent': UA,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!res.ok) json.__status = res.status;
  return json;
}

function b64ToText(b64: string): string {
  const bin = atob(b64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function textToB64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export interface RepoFile {
  content: string; // base64
  encoding: 'base64';
}

/** Fetch every file of a template repo, substituting AGENTNAME → agentId in text files. */
export async function fetchTemplateFiles(
  org: string,
  templateRepo: string,
  templatePath: string,
  token: string,
  agentId: string,
): Promise<Map<string, RepoFile>> {
  const base = `https://api.github.com/repos/${org}/${templateRepo}`;
  const ref = await gh(token, `${base}/git/ref/heads/main`);
  const headSha = ref?.object?.sha;
  if (!headSha) throw new Error(`template ${templateRepo}: no main ref (${ref.message ?? ref.__status})`);
  const tree = await gh(token, `${base}/git/trees/${headSha}?recursive=1`);
  if (!Array.isArray(tree?.tree)) throw new Error(`template tree fetch failed (${tree.message ?? tree.__status})`);

  const files = new Map<string, RepoFile>();
  const prefix = templatePath ? `${templatePath}/` : '';

  for (const item of tree.tree) {
    if (item.type !== 'blob' || item.path.startsWith('.git/')) continue;
    // Only include files under the template path
    if (prefix && !item.path.startsWith(prefix)) continue;
    // Strip the template path prefix to get the relative path
    const relPath = prefix ? item.path.slice(prefix.length) : item.path;
    if (!relPath || relPath.startsWith('node_modules/')) continue;

    const blob = await gh(token, `${base}/git/blobs/${item.sha}`);
    if (typeof blob?.content !== 'string') throw new Error(`blob ${item.path} fetch failed`);

    if (TEXT_RE.test(item.path)) {
      const text = b64ToText(blob.content).replaceAll('AGENTNAME', agentId);
      files.set(relPath, { content: textToB64(text), encoding: 'base64' });
    } else {
      files.set(relPath, { content: blob.content.replace(/\n/g, ''), encoding: 'base64' });
    }
  }
  if (files.size === 0) throw new Error('template has no files');
  return files;
}

/** Push files to org/repo main branch as one commit. Handles empty + existing repos. */
export async function pushFiles(
  org: string,
  repo: string,
  token: string,
  files: Map<string, RepoFile>,
  message: string,
): Promise<string> {
  const base = `https://api.github.com/repos/${org}/${repo}`;

  let parentSha: string | undefined;
  let baseTree: string | undefined;
  const ref = await gh(token, `${base}/git/ref/heads/main`);
  if (ref?.object?.sha) {
    parentSha = ref.object.sha;
    const parent = await gh(token, `${base}/git/commits/${parentSha}`);
    baseTree = parent?.tree?.sha;
  } else {
    const seed = await gh(token, `${base}/contents/.gitkeep`, 'PUT', {
      message: 'seed', content: textToB64(''),
    });
    if (!seed?.commit?.sha) throw new Error(`repo seed failed: ${seed.message ?? seed.__status}`);
    parentSha = seed.commit.sha;
    const parent = await gh(token, `${base}/git/commits/${parentSha}`);
    baseTree = parent?.tree?.sha;
  }

  const treeItems: Array<{ path: string; mode: string; type: string; sha: string }> = [];
  for (const [path, f] of files) {
    const blob = await gh(token, `${base}/git/blobs`, 'POST', { content: f.content, encoding: f.encoding });
    if (!blob?.sha) throw new Error(`blob create failed for ${path}: ${blob.message ?? blob.__status}`);
    treeItems.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
  }

  const tree = await gh(token, `${base}/git/trees`, 'POST', { base_tree: baseTree, tree: treeItems });
  if (!tree?.sha) throw new Error(`tree create failed: ${tree.message ?? tree.__status}`);

  const commit = await gh(token, `${base}/git/commits`, 'POST', {
    message, tree: tree.sha, parents: parentSha ? [parentSha] : [],
  });
  if (!commit?.sha) throw new Error(`commit create failed: ${commit.message ?? commit.__status}`);

  const upd = await gh(token, `${base}/git/refs/heads/main`, 'PATCH', { sha: commit.sha });
  if (!upd?.ref) throw new Error(`ref update failed: ${upd.message ?? upd.__status}`);
  return commit.sha;
}

/** List file paths in a repo (recursive). */
export async function listRepoFiles(org: string, repo: string, token?: string): Promise<string[]> {
  const base = `https://api.github.com/repos/${org}/${repo}`;
  const ref = await gh(token, `${base}/git/ref/heads/main`);
  if (!ref?.object?.sha) return [];
  const tree = await gh(token, `${base}/git/trees/${ref.object.sha}?recursive=1`);
  if (!Array.isArray(tree?.tree)) return [];
  return tree.tree.filter((i: any) => i.type === 'blob' && !i.path.startsWith('.git/')).map((i: any) => i.path);
}

/** Read one file's text content. */
export async function readRepoFile(org: string, repo: string, token: string | undefined, path: string): Promise<string | null> {
  const base = `https://api.github.com/repos/${org}/${repo}`;
  const res = await gh(token, `${base}/contents/${path.split('/').map(encodeURIComponent).join('/')}`);
  if (typeof res?.content !== 'string') return null;
  return b64ToText(res.content);
}

export { textToB64, b64ToText };
