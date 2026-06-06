import { openDB, type IDBPDatabase } from 'idb';

export interface Document {
  id: string;
  title: string;
  content: string;
  source: 'paste' | 'url' | 'file';
  addedAt: number;
  size: number;
}

export interface Message {
  id?: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface AgentConfig {
  provider: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  responseStyle: 'concise' | 'detailed' | 'professional' | 'casual';
  agentName: string;
}

export const DEFAULT_CONFIG: AgentConfig = {
  provider: 'built-in-ai',
  model: 'gemini-nano',
  temperature: 0.7,
  systemPrompt: 'You are a document Q&A assistant. The user has uploaded documents which are included below. ALWAYS answer based on the document content. If the user asks "what is this about" or similar, summarize the documents. If the answer is not in the documents, say "I could not find that in your documents." Never ask the user for clarification about what "it" refers to — "it" always means the uploaded documents.',
  responseStyle: 'concise',
  agentName: 'Document Chatbot',
};

const DB_NAME = 'chatbot';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('documents')) {
          db.createObjectStore('documents', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('messages')) {
          db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('config')) {
          db.createObjectStore('config', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

export async function addDocument(doc: Omit<Document, 'id' | 'addedAt' | 'size'>): Promise<Document> {
  const db = await getDB();
  const full: Document = {
    ...doc,
    id: crypto.randomUUID(),
    addedAt: Date.now(),
    size: new Blob([doc.content]).size,
  };
  await db.put('documents', full);
  return full;
}

export async function getDocuments(): Promise<Document[]> {
  const db = await getDB();
  const docs = await db.getAll('documents');
  return docs.sort((a, b) => b.addedAt - a.addedAt);
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('documents', id);
}

const MAX_CONTEXT_BYTES = 30_000;

export async function getDocContext(): Promise<string> {
  const docs = await getDocuments();
  if (docs.length === 0) return '';

  let context = '';
  for (const doc of docs) {
    const section = `--- ${doc.title} ---\n${doc.content}\n\n`;
    if (new Blob([context + section]).size > MAX_CONTEXT_BYTES) break;
    context += section;
  }
  return context;
}

export async function addMessage(msg: Omit<Message, 'id' | 'timestamp'>): Promise<Message> {
  const db = await getDB();
  const full: Message = { ...msg, timestamp: Date.now() };
  const id = await db.add('messages', full);
  return { ...full, id: id as number };
}

export async function getMessages(limit = 100): Promise<Message[]> {
  const db = await getDB();
  const all = await db.getAll('messages');
  return all.slice(-limit);
}

export async function clearMessages(): Promise<void> {
  const db = await getDB();
  await db.clear('messages');
}

export async function getConfig(): Promise<AgentConfig> {
  const db = await getDB();
  const row = await db.get('config', 'agent');
  return row?.value ?? { ...DEFAULT_CONFIG };
}

export async function saveConfig(config: Partial<AgentConfig>): Promise<AgentConfig> {
  const db = await getDB();
  const current = await getConfig();
  const merged = { ...current, ...config };
  await db.put('config', { key: 'agent', value: merged });
  return merged;
}
