import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type DragEvent, type ChangeEvent } from 'react';
import { ArrowUp, Square, Paperclip, Sparkles, Bot, X, ImageIcon, Music, Video, FileWarning } from 'lucide-react';
import { clsx } from '@/lib/clsx';
import type { Attachment, AttachmentType } from '@/lib/database.types';

interface PendingFile {
  id: string;
  file: File;
  type: AttachmentType;
  previewUrl: string;
  status: 'uploading' | 'done' | 'error';
  attachment?: Attachment;
  error?: string;
}

interface ChatInputProps {
  onSend: (text: string, attachments?: Attachment[]) => void;
  onStop?: () => void;
  streaming?: boolean;
  disabled?: boolean;
  placeholder?: string;
  onAttachFile?: () => void;
  agentMode?: boolean;
  onToggleAgent?: () => void;
  onUploadFiles?: (files: File[]) => void;
  pendingFiles?: PendingFile[];
  onRemovePendingFile?: (id: string) => void;
  supportsMultimodal?: boolean;
}

export function ChatInput({
  onSend,
  onStop,
  streaming,
  disabled,
  placeholder = 'Message Nexus AI…',
  onAttachFile,
  agentMode = false,
  onToggleAgent,
  onUploadFiles,
  pendingFiles = [],
  onRemovePendingFile,
  supportsMultimodal = true,
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  // Auto-resize the textarea up to a max height.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [value]);

  // Cleanup object URLs when pending files change
  useEffect(() => {
    return () => {
      pendingFiles.forEach((f) => {
        if (f.previewUrl.startsWith('blob:')) URL.revokeObjectURL(f.previewUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit() {
    const text = value.trim();
    const readyFiles = pendingFiles.filter((f) => f.status === 'done' && f.attachment);
    if (!text && readyFiles.length === 0) return;
    if (disabled || streaming) return;
    const attachments = readyFiles.map((f) => f.attachment!);
    onSend(text || ' ', attachments.length > 0 ? attachments : undefined);
    setValue('');
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submit();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0 && onUploadFiles) {
      onUploadFiles(files);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleDragEnter(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);
    if (!supportsMultimodal || !onUploadFiles) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onUploadFiles(files);
  }

  function triggerFilePicker() {
    fileInputRef.current?.click();
  }

  const hasReadyFiles = pendingFiles.some((f) => f.status === 'done');
  const canSubmit = (value.trim() || hasReadyFiles) && !disabled;

  return (
    <div className="border-t border-surface-border bg-white/80 px-3 py-3 backdrop-blur-md sm:px-6 dark:border-surface-dark-border dark:bg-surface-dark/80">
      <form onSubmit={onSubmit} className="mx-auto max-w-3xl">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,video/mp4,video/webm,video/quicktime,.png,.jpg,.jpeg,.webp,.gif,.mp3,.wav,.ogg,.mp4,.webm,.mov"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Pending attachments preview */}
        {pendingFiles.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {pendingFiles.map((pf) => (
              <AttachmentPreview
                key={pf.id}
                file={pf}
                onRemove={() => onRemovePendingFile?.(pf.id)}
              />
            ))}
          </div>
        )}

        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={clsx(
            'gradient-border relative flex items-end gap-2 rounded-2xl border bg-white p-2 shadow-card transition-all focus-within:border-brand-300 focus-within:shadow-glow',
            isDragging
              ? 'border-brand-400 ring-2 ring-brand-400/40 bg-brand-50/50 dark:bg-brand-900/20'
              : 'border-surface-border',
            'dark:border-surface-dark-border dark:bg-surface-dark-elevated dark:shadow-card-dark',
          )}
        >
          {/* Multimodal attach button */}
          {supportsMultimodal && (
            <button
              type="button"
              onClick={triggerFilePicker}
              className="mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-surface-dark-muted dark:hover:text-slate-200"
              aria-label="Attach images, audio, or video"
              title="Attach images, audio, or video"
            >
              <Paperclip className="h-5 w-5" />
            </button>
          )}

          {/* Legacy PDF attach (documents view) */}
          {onAttachFile && !supportsMultimodal && (
            <button
              type="button"
              onClick={onAttachFile}
              className="mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-surface-dark-muted dark:hover:text-slate-200"
              aria-label="Attach a PDF"
              title="Attach a PDF"
            >
              <Paperclip className="h-5 w-5" />
            </button>
          )}

          {onToggleAgent && (
            <button
              type="button"
              onClick={onToggleAgent}
              className={clsx(
                'mb-0.5 flex h-9 shrink-0 items-center gap-1 rounded-xl px-2.5 text-xs font-medium transition-all',
                agentMode
                  ? 'bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-glow'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-surface-dark-muted dark:hover:text-slate-200',
              )}
              aria-label="Toggle AI Agent mode"
              title="Agent mode: multi-step reasoning"
            >
              <Bot className="h-4 w-4" />
              <span className="hidden sm:inline">Agent</span>
            </button>
          )}

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={disabled}
            placeholder={isDragging ? 'Drop files here…' : placeholder}
            rows={1}
            className="max-h-[220px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:opacity-50 dark:text-slate-100"
          />

          {streaming ? (
            <button
              type="button"
              onClick={onStop}
              className="mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-200 text-slate-600 transition-colors hover:bg-slate-300 dark:bg-surface-dark-muted dark:text-slate-200 dark:hover:bg-surface-dark-border"
              aria-label="Stop generating"
              title="Stop"
            >
              <Square className="h-4 w-4 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSubmit}
              className={clsx(
                'mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white transition-all',
                canSubmit
                  ? 'bg-gradient-to-br from-brand-500 to-accent-500 shadow-glow hover:scale-105'
                  : 'cursor-not-allowed bg-slate-200 text-slate-400 dark:bg-surface-dark-muted',
              )}
              aria-label="Send message"
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          )}

          {/* Drag overlay */}
          {isDragging && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-brand-50/90 dark:bg-brand-900/40">
              <div className="flex items-center gap-2 text-sm font-semibold text-brand-600 dark:text-brand-300">
                <ImageIcon className="h-5 w-5" />
                <span>Drop images, audio, or video here</span>
                <Video className="h-5 w-5" />
              </div>
            </div>
          )}
        </div>
        <div className="mt-2 flex items-center justify-center gap-2 text-center text-[11px] text-slate-400">
          {agentMode && (
            <span className="flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
              <Bot className="h-3 w-3" />
              Agent mode active
            </span>
          )}
          {supportsMultimodal && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300">
              <Sparkles className="h-3 w-3" />
              Multimodal: images, audio, video
            </span>
          )}
          <span className="flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            Nexus AI can make mistakes. Verify important information.
          </span>
        </div>
      </form>
    </div>
  );
}

function AttachmentPreview({
  file,
  onRemove,
}: {
  file: PendingFile;
  onRemove: () => void;
}) {
  const TypeIcon = file.type === 'image' ? ImageIcon : file.type === 'audio' ? Music : Video;

  return (
    <div className="group relative flex items-center gap-2 rounded-xl border border-surface-border bg-white p-1.5 pr-2 shadow-sm dark:border-surface-dark-border dark:bg-surface-dark-elevated">
      {/* Thumbnail or icon */}
      <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-100 dark:bg-surface-dark-muted">
        {file.type === 'image' && file.previewUrl ? (
          <img src={file.previewUrl} alt={file.file.name} className="h-full w-full object-cover" />
        ) : (
          <TypeIcon className="h-5 w-5 text-slate-400" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="max-w-[140px] truncate text-xs font-medium text-slate-700 dark:text-slate-200">
          {file.file.name}
        </p>
        <p className="text-[10px] text-slate-400">
          {file.status === 'uploading' && 'Uploading…'}
          {file.status === 'done' && `${formatSize(file.file.size)}`}
          {file.status === 'error' && (
            <span className="flex items-center gap-0.5 text-error-500">
              <FileWarning className="h-3 w-3" />
              {file.error ?? 'Failed'}
            </span>
          )}
        </p>
      </div>

      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        className="grid h-6 w-6 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-surface-dark-muted dark:hover:text-slate-200"
        aria-label="Remove attachment"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Upload spinner */}
      {file.status === 'uploading' && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/60 dark:bg-surface-dark/60">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
        </div>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type { PendingFile };
