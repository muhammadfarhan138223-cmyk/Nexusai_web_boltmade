// src/components/documents/DocumentsView.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  FileText,
  Loader2,
  Sparkles,
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileUp,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { Seo } from '@/components/ui/Seo';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { fetchDocuments, createDocument, updateDocument, deleteDocument } from '@/lib/documents';
import { extractPdfText, chunkText } from '@/lib/pdf';
import { completeOnce } from '@/lib/ai';
import { getModel } from '@/lib/models';
import { downloadFile, formatChatDate, slugify } from '@/lib/utils';
import type { DocumentRow, Provider } from '@/lib/database.types';
import { clsx } from '@/lib/clsx';

interface DocumentsViewProps {
  onBack: () => void;
}

export function DocumentsView({ onBack }: DocumentsViewProps) {
  const { user, preferences } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [summarizingId, setSummarizingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DocumentRow | null>(null);
  const [viewer, setViewer] = useState<DocumentRow | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDocuments();
      setDocs(data);
    } catch {
      toast.error('Could not load documents.');
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleFile(file: File) {
    if (!user) return;
    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error('File too large', 'Max size is 15MB.');
      return;
    }
    setUploading(true);
    try {
      const { text, pageCount, charCount } = await extractPdfText(file);
      if (!text) {
        toast.error('No selectable text found', 'This PDF may be scanned images.');
        return;
      }

      const newDoc = await createDocument({ filename: file.name, charCount });
      sessionStorage.setItem(`doc-text:${newDoc.id}`, text);
      setDocs((prev) => [newDoc, ...prev]);
      toast.success('Document uploaded', `${pageCount} page${pageCount === 1 ? '' : 's'}, ${charCount.toLocaleString()} characters.`);
    } catch (err) {
      console.error(err);
      toast.error('Upload failed', err instanceof Error ? err.message : undefined);
    } finally {
      setUploading(false);
    }
  }

  async function summarize(doc: DocumentRow) {
    const text = sessionStorage.getItem(`doc-text:${doc.id}`) ?? '';
    if (!text) {
      toast.error('Text not available', 'Re-upload the document to summarize it.');
      return;
    }
    setSummarizingId(doc.id);
    try {
      const model = preferences?.default_model ?? 'groq/openai/gpt-oss-120b';

      const chunks = chunkText(text, 12000);
      const body = chunks.length > 1 ? chunks[0] + '\n\n[...document truncated for length...]' : text;
      const prompt = `Summarize the following document. Provide:
1. A concise 3-4 sentence summary.
2. 5-7 key points as a markdown bullet list.
3. A short "Takeaway" line.

Document:
"""
${body}
"""`;

      const result = await completeOnce({
        messages: [{ role: 'user', content: prompt }],
        model,
        temperature: 0.3,
        systemPrompt: 'You are an expert at summarizing documents clearly and accurately.',
      });

      const { summary, keyPoints } = parseSummary(result);

      await updateDocument(doc.id, { summary: result, key_points: keyPoints, status: 'ready' });

      setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, summary: result, key_points: keyPoints } : d)));
      setViewer({ ...doc, summary: result, key_points: keyPoints });
      toast.success('Summary ready');
    } catch (err) {
      console.error(err);
      toast.error('Summarize failed', err instanceof Error ? err.message : undefined);
    } finally {
      setSummarizingId(null);
    }
  }

  async function onDelete() {
    if (!confirmDelete) return;
    try {
      await deleteDocument(confirmDelete.id);
      sessionStorage.removeItem(`doc-text:${confirmDelete.id}`);
      setDocs((prev) => prev.filter((d) => d.id !== confirmDelete.id));
      toast.success('Document deleted.');
    } catch {
      toast.error('Could not delete document.');
    } finally {
      setConfirmDelete(null);
    }
  }

  function exportSummary(doc: DocumentRow) {
    if (!doc.summary) return;
    downloadFile(`${slugify(doc.filename)}.md`, `# ${doc.filename}\n\n${doc.summary}`, 'text/markdown');
    toast.success('Summary exported.');
  }

  return (
    <div className="flex h-full flex-col bg-surface-subtle dark:bg-surface-dark">
      <Seo title="Documents" path="/app/documents" />
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-surface-border bg-white/80 px-4 backdrop-blur-md dark:border-surface-dark-border dark:bg-surface-dark/80">
        <button
          onClick={onBack}
          className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-surface-dark-muted"
          aria-label="Back to chat"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold text-slate-800 dark:text-slate-100">Documents</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="mx-auto max-w-3xl">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            className={clsx(
              'gradient-border mb-6 rounded-2xl border border-dashed border-surface-border bg-white p-8 text-center transition-all dark:border-surface-dark-border dark:bg-surface-dark-elevated',
              uploading && 'opacity-70',
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = '';
              }}
            />
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-glow">
              {uploading ? <Loader2 className="h-7 w-7 animate-spin" /> : <FileUp className="h-7 w-7" />}
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {uploading ? 'Extracting text…' : 'Upload a PDF to summarize'}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Drag &amp; drop or{' '}
              <button onClick={() => fileInputRef.current?.click()} className="font-medium text-brand-600 hover:underline dark:text-brand-400">
                browse files
              </button>
              . Max 15MB.
            </p>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-20 rounded-2xl" />
              ))}
            </div>
          ) : docs.length === 0 ? (
            <div className="rounded-2xl border border-surface-border bg-white p-10 text-center dark:border-surface-dark-border dark:bg-surface-dark-elevated">
              <FileText className="mx-auto mb-3 h-8 w-8 text-slate-300" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No documents yet</p>
              <p className="mt-1 text-xs text-slate-400">Upload a PDF and Nexus AI will summarize the key points.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {docs.map((doc) => (
                <DocumentRowCard
                  key={doc.id}
                  doc={doc}
                  summarizing={summarizingId === doc.id}
                  onSummarize={() => summarize(doc)}
                  onView={() => setViewer(doc)}
                  onDelete={() => setConfirmDelete(doc)}
                  onExport={() => exportSummary(doc)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={!!viewer}
        onClose={() => setViewer(null)}
        title={viewer?.filename}
        description={viewer ? `${formatChatDate(viewer.created_at)} · ${viewer.char_count.toLocaleString()} chars` : undefined}
        size="lg"
      >
        {viewer?.summary ? (
          <div className="prose-chat max-h-[60vh] overflow-y-auto text-slate-700 dark:text-slate-200">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{viewer.summary}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No summary yet. Click “Summarize” to generate one.</p>
        )}
        {viewer?.summary && (
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => exportSummary(viewer)} leftIcon={<Download className="h-4 w-4" />}>
              Export
            </Button>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete document?"
        description="The file and its summary will be permanently removed."
        confirmLabel="Delete"
        destructive
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function DocumentRowCard({
  doc,
  summarizing,
  onSummarize,
  onView,
  onDelete,
  onExport,
}: {
  doc: DocumentRow;
  summarizing: boolean;
  onSummarize: () => void;
  onView: () => void;
  onDelete: () => void;
  onExport: () => void;
}) {
  const hasSummary = !!doc.summary;
  return (
    <div className="group flex items-center gap-4 rounded-2xl border border-surface-border bg-white p-4 transition-all hover:shadow-card dark:border-surface-dark-border dark:bg-surface-dark-elevated dark:hover:shadow-card-dark">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-error-50 text-error-500 dark:bg-error-900/30 dark:text-error-400">
        <FileText className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <button onClick={onView} className="block max-w-full truncate text-left text-sm font-semibold text-slate-800 hover:text-brand-600 dark:text-slate-100 dark:hover:text-brand-300">
          {doc.filename}
        </button>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
          <span>{formatChatDate(doc.created_at)}</span>
          <span>·</span>
          <span>{doc.char_count.toLocaleString()} chars</span>
          {hasSummary ? (
            <span className="inline-flex items-center gap-1 text-success-600 dark:text-success-400">
              <CheckCircle2 className="h-3 w-3" /> Summarized
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-slate-400">
              <AlertCircle className="h-3 w-3" /> Not summarized
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {!hasSummary && (
          <Button size="sm" variant="outline" onClick={onSummarize} loading={summarizing} leftIcon={!summarizing ? <Sparkles className="h-3.5 w-3.5" /> : undefined}>
            Summarize
          </Button>
        )}
        {hasSummary && (
          <Button size="sm" variant="ghost" onClick={onView}>
            View
          </Button>
        )}
        {hasSummary && (
          <button
            onClick={onExport}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-surface-dark-muted"
            aria-label="Export summary"
          >
            <Download className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={onDelete}
          className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-900/20"
          aria-label="Delete document"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function parseSummary(md: string): { summary: string; keyPoints: string[] } {
  const lines = md.split('\n');
  const points: string[] = [];
  let summaryLines: string[] = [];
  let inPoints = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || /^\d+\.\s/.test(trimmed)) {
      inPoints = true;
      points.push(trimmed.replace(/^[-*]\s+|^\d+\.\s+/, ''));
    } else if (trimmed && !inPoints) {
      summaryLines.push(line);
    }
  }
  return {
    summary: summaryLines.join('\n').trim() || md,
    keyPoints: points.slice(0, 10),
  };
}

// keep Provider import referenced (used to type the summarize provider below)
export type { Provider };
