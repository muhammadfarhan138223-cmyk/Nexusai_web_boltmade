// src/lib/documents.ts
import type { DocumentRow } from './database.types';

// Documents are stored locally. The PDF's extracted text is kept only in
// sessionStorage (as before) — just the metadata + summary persist here.
const KEY = 'nexus-local-documents';

function read(): DocumentRow[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

function write(rows: DocumentRow[]) {
  localStorage.setItem(KEY, JSON.stringify(rows));
}

export async function fetchDocuments(): Promise<DocumentRow[]> {
  return read().sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function createDocument(params: {
  filename: string;
  charCount: number;
}): Promise<DocumentRow> {
  const doc: DocumentRow = {
    id: crypto.randomUUID(),
    user_id: 'local-nexus-user',
    filename: params.filename,
    storage_path: '',
    char_count: params.charCount,
    summary: null,
    key_points: null,
    status: 'ready',
    created_at: new Date().toISOString(),
  };
  write([doc, ...read()]);
  return doc;
}

export async function updateDocument(
  id: string,
  updates: { summary?: string | null; key_points?: string[] | null; status?: DocumentRow['status'] },
): Promise<void> {
  write(read().map((d) => (d.id === id ? { ...d, ...updates } : d)));
}

export async function deleteDocument(id: string): Promise<void> {
  write(read().filter((d) => d.id !== id));
}
