import type { Chat, Message } from './database.types';

/** Copy text to clipboard with a non-secure fallback for older browsers. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

/** Format an ISO timestamp into a short relative label (Today / Yesterday / date). */
export function formatChatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86_400_000);
  if (dayDiff <= 0) return 'Today';
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff < 7) return `${dayDiff} days ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Build a markdown export of a chat session for download/copy. */
export function exportChatAsMarkdown(chat: Chat, messages: Message[]): string {
  const header = `# ${chat.title}\n\n*Exported from Nexus AI • ${new Date().toLocaleString()}*\n*Model: ${chat.provider} / ${chat.model}*\n\n---\n\n`;
  const body = messages
    .filter((m) => m.role !== 'system')
    .map((m) => {
      const who = m.role === 'user' ? '🧑 You' : '🤖 Nexus AI';
      return `### ${who}\n\n${m.content}\n`;
    })
    .join('\n---\n\n');
  return `${header}${body}`;
}

/** Build a plain-text export for .txt download. */
export function exportChatAsText(chat: Chat, messages: Message[]): string {
  const header = `${chat.title}\nExported from Nexus AI • ${new Date().toLocaleString()}\nModel: ${chat.provider} / ${chat.model}\n${'='.repeat(60)}\n\n`;
  const body = messages
    .filter((m) => m.role !== 'system')
    .map((m) => {
      const who = m.role === 'user' ? 'You' : 'Nexus AI';
      return `${who}:\n${m.content}\n`;
    })
    .join('\n' + '-'.repeat(60) + '\n\n');
  return `${header}${body}`;
}

/** Build a JSON export including all metadata. */
export function exportChatAsJson(chat: Chat, messages: Message[]): string {
  return JSON.stringify(
    {
      id: chat.id,
      title: chat.title,
      provider: chat.provider,
      model: chat.model,
      created_at: chat.created_at,
      updated_at: chat.updated_at,
      messages: messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role, content: m.content, created_at: m.created_at })),
    },
    null,
    2,
  );
}

/** Trigger a client-side file download with the given content + filename. */
export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Make a filesystem-safe slug from a chat title. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'chat';
}

/** Generate a short chat title from the first user message. */
export function deriveChatTitle(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'New chat';
  const words = cleaned.split(' ').slice(0, 7).join(' ');
  return words.length < cleaned.length ? `${words}…` : words;
}

/** Clamp a number between min and max. */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

/** Debounce a function by `wait` ms. Returns a cancelable wrapper. */
export function debounce<T extends (...args: never[]) => void>(fn: T, wait = 250) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const wrapped = (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  wrapped.cancel = () => timer && clearTimeout(timer);
  return wrapped;
}

/** Tiny id generator for client-only optimistic rows. */
export function tempId(): string {
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
