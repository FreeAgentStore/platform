import { addDocument } from './store';

function stripHTML(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function importFromText(title: string, text: string): Promise<void> {
  if (!text.trim()) throw new Error('Empty text');
  await addDocument({ title: title || 'Untitled', content: text.trim(), source: 'paste' });
}

export async function importFromURL(url: string): Promise<void> {
  if (!url.trim()) throw new Error('Empty URL');

  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error("Can't import this URL (CORS). Try pasting the text instead.");
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  const raw = await response.text();

  const content = contentType.includes('text/html') ? stripHTML(raw) : raw;
  if (!content.trim()) throw new Error('No content found at this URL');

  const title = url.replace(/^https?:\/\//, '').split('/')[0] || url;
  await addDocument({ title, content: content.trim(), source: 'url' });
}

export async function importFromFile(file: File): Promise<void> {
  const text = await file.text();
  if (!text.trim()) throw new Error('File is empty');
  await addDocument({ title: file.name, content: text.trim(), source: 'file' });
}
