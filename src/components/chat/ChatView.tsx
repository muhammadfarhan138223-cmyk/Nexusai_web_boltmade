import { useCallback, useEffect, useRef, useState } from 'react';
import { Menu, Download, Sparkles, Bot } from 'lucide-react';
import { ChatInput, type PendingFile } from './ChatInput';
import { MessageBubble } from './MessageBubble';
import { WelcomeScreen } from './WelcomeScreen';
import { ModelSelector } from '@/components/ui/ModelSelector';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DailyUsageTracker } from './DailyUsageTracker';
import { loadUsage, incrementUsage, checkUsage, LIMITS, type UsageState } from '@/lib/usage';
import { useToast } from '@/context/ToastContext';
import {
  downloadFile,
  exportChatAsJson,
  exportChatAsMarkdown,
  exportChatAsText,
  slugify,
} from '@/lib/utils';
import { clsx } from '@/lib/clsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/* ============================================================================
 * LOCAL TYPES
 * These replace the Supabase-generated types that used to live in
 * '@/lib/database.types'. If other files (Sidebar, App, ChatInput,
 * MessageBubble) previously imported Chat / Message / Attachment / Provider
 * from that module, point them at these exports instead.
 * ==========================================================================*/

export type AttachmentType = 'image' | 'document';

export interface Attachment {
  id: string;
  type: AttachmentType;
  name: string;
  mimeType: string;
  /** data: URL — safe to use directly as an <img src> or download href. */
  url: string;
  /** raw base64 payload (no "data:...;base64," prefix) — used for Gemini inlineData parts. */
  base64: string;
}

export interface Chat {
  id: string;
  title: string;
  model: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments: Attachment[] | null;
  model?: string;
  created_at: string;
}

interface ChatViewProps {
  chat: Chat | null;
  onOpenSidebar: () => void;
  onChatCreated: (chat: Chat) => void;
  onChatUpdated: (chat: Chat) => void;
  onOpenDocuments: () => void;
  onNavigateChat: (id: string) => void;
}

/* ============================================================================
 * LOCAL STORAGE PERSISTENCE
 * Replaces '@/lib/chats' (Supabase database calls).
 * ==========================================================================*/

const CHATS_KEY = 'nexus_chats';
const MESSAGES_KEY = 'nexus_messages';
const PREFS_KEY = 'nexus_preferences';

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / unavailable — non-fatal */
  }
}

export function genId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function loadChats(): Chat[] {
  return readJSON<Chat[]>(CHATS_KEY, []);
}

export function saveChats(chats: Chat[]) {
  writeJSON(CHATS_KEY, chats);
}

export function loadAllMessages(): Record<string, Message[]> {
  return readJSON<Record<string, Message[]>>(MESSAGES_KEY, {});
}

export function saveAllMessages(map: Record<string, Message[]>) {
  writeJSON(MESSAGES_KEY, map);
}

export function loadMessagesForChat(chatId: string): Message[] {
  const all = loadAllMessages();
  return all[chatId] ?? [];
}

export function saveMessagesForChat(chatId: string, msgs: Message[]) {
  const all = loadAllMessages();
  all[chatId] = msgs;
  saveAllMessages(all);
}

export function deleteChatLocal(chatId: string) {
  const chats = loadChats().filter((c) => c.id !== chatId);
  saveChats(chats);
  const all = loadAllMessages();
  delete all[chatId];
  saveAllMessages(all);
}

export function renameChatLocal(chatId: string, title: string) {
  const chats = loadChats().map((c) =>
    c.id === chatId ? { ...c, title, updated_at: new Date().toISOString() } : c,
  );
  saveChats(chats);
}

/* ============================================================================
 * LOCAL PREFERENCES
 * Replaces the Supabase-backed `useAuth().preferences`.
 * ==========================================================================*/

interface LocalPreferences {
  default_model: string;
  temperature: number;
  system_prompt: string;
}

const DEFAULT_MODEL = 'gemini-1.5-flash';

const DEFAULT_PREFERENCES: LocalPreferences = {
  default_model: DEFAULT_MODEL,
  temperature: 0.7,
  system_prompt: '',
};

function loadPreferences(): LocalPreferences {
  return { ...DEFAULT_PREFERENCES, ...readJSON<Partial<LocalPreferences>>(PREFS_KEY, {}) };
}

/* ============================================================================
 * USAGE TRACKING (client-side only, resets daily)
 * Kept self-contained so DailyUsageTracker keeps working without a backend.
 * ==========================================================================*/

interface UsageState {
  requestsToday: number;
  remainingRequests: number;
  dailyLimit: number;
  imagesToday: number;
  docsToday: number;
  rpmExceeded: boolean;
  resetsAt: string;
}

const LIMITS = {
  DAILY_REQUESTS: 50,
  RPM: 10,
  DAILY_IMAGES: 20,
  DAILY_DOCS: 20,
};

interface RawUsage {
  date: string;
  requests: number;
  images: number;
  docs: number;
  rpm: number[];
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function loadUsageRaw(): RawUsage {
  return readJSON<RawUsage>(USAGE_KEY, { date: todayKey(), requests: 0, images: 0, docs: 0, rpm: [] });
}

function toUsageState(raw: RawUsage): UsageState {
  const now = Date.now();
  const rpmWindow = raw.rpm.filter((t) => now - t < 60_000);
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  return {
    requestsToday: raw.requests,
    remainingRequests: Math.max(0, LIMITS.DAILY_REQUESTS - raw.requests),
    dailyLimit: LIMITS.DAILY_REQUESTS,
    imagesToday: raw.images,
    docsToday: raw.docs,
    rpmExceeded: rpmWindow.length >= LIMITS.RPM,
    resetsAt: midnight.toISOString(),
  };
}

async function loadUsage(): Promise<UsageState> {
  let raw = loadUsageRaw();
  if (raw.date !== todayKey()) {
    raw = { date: todayKey(), requests: 0, images: 0, docs: 0, rpm: [] };
    writeJSON(USAGE_KEY, raw);
  }
  return toUsageState(raw);
}

function checkUsage(usage: UsageState, attachmentTypes: AttachmentType[]): string | null {
  if (usage.remainingRequests <= 0) {
    return `Daily limit reached (${LIMITS.DAILY_REQUESTS} requests/day). Try again tomorrow.`;
  }
  if (usage.rpmExceeded) {
    return `You're sending messages too quickly. Please wait a moment.`;
  }
  const imageCount = attachmentTypes.filter((t) => t === 'image').length;
  if (imageCount > 0 && usage.imagesToday + imageCount > LIMITS.DAILY_IMAGES) {
    return `Daily image limit reached (${LIMITS.DAILY_IMAGES}/day).`;
  }
  const docCount = attachmentTypes.filter((t) => t === 'document').length;
  if (docCount > 0 && usage.docsToday + docCount > LIMITS.DAILY_DOCS) {
    return `Daily document limit reached (${LIMITS.DAILY_DOCS}/day).`;
  }
  return null;
}

async function incrementUsage(attachmentTypes: AttachmentType[]): Promise<UsageState> {
  let raw = loadUsageRaw();
  if (raw.date !== todayKey()) {
    raw = { date: todayKey(), requests: 0, images: 0, docs: 0, rpm: [] };
  }
  raw.requests += 1;
  raw.images += attachmentTypes.filter((t) => t === 'image').length;
  raw.docs += attachmentTypes.filter((t) => t === 'document').length;
  const now = Date.now();
  raw.rpm = [...raw.rpm.filter((t) => now - t < 60_000), now];
  writeJSON(USAGE_KEY, raw);
  return toUsageState(raw);
}

/* ============================================================================
 * ATTACHMENTS (local, no upload — everything stays base64 in the browser)
 * Replaces '@/lib/attachments'.
 * ==========================================================================*/

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_DOC_BYTES = 10 * 1024 * 1024; // 10MB

function classifyFile(file: File): AttachmentType {
  return file.type.startsWith('image/') ? 'image' : 'document';
}

function validateFile(file: File): { error?: string } {
  const type = classifyFile(file);
  if (type === 'image' && file.size > MAX_IMAGE_BYTES) {
    return { error: `${file.name} is too large (max 5MB for images).` };
  }
  if (type === 'document' && file.size > MAX_DOC_BYTES) {
    return { error: `${file.name} is too large (max 10MB for documents).` };
  }
  return {};
}

function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const commaIdx = result.indexOf(',');
      const prefix = result.slice(0, commaIdx);
      const data = result.slice(commaIdx + 1);
      const mimeMatch = /data:(.*);base64/.exec(prefix);
      resolve({ base64: data, mimeType: mimeMatch?.[1] ?? file.type });
    };
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

async function localizeAttachment(file: File, type: AttachmentType): Promise<Attachment> {
  const { base64, mimeType } = await fileToBase64(file);
  return {
    id: genId('att'),
    type,
    name: file.name,
    mimeType,
    url: `data:${mimeType};base64,${base64}`,
    base64,
  };
}

/* ============================================================================
 * GEMINI API (direct call, replaces the Supabase Edge Function proxy)
 * ==========================================================================*/

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

function toGeminiContents(history: Message[]): GeminiContent[] {
  return history
    .map((m): GeminiContent => {
      const parts: GeminiPart[] = [];
      if (m.content) parts.push({ text: m.content });
      if (m.attachments) {
        for (const att of m.attachments) {
          if (att.type === 'image') {
            parts.push({ inlineData: { mimeType: att.mimeType, data: att.base64 } });
          }
        }
      }
      return { role: m.role === 'assistant' ? 'model' : 'user', parts };
    })
    .filter((c) => c.parts.length > 0);
}

async function callGemini({
  model,
  history,
  systemPrompt,
  temperature,
  signal,
}: {
  model: string;
  history: Message[];
  systemPrompt?: string;
  temperature: number;
  signal: AbortSignal;
}): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) {
    throw new Error('Missing VITE_GEMINI_API_KEY environment variable.');
  }

  const modelId = model.replace(/^gemini\//, '') || DEFAULT_MODEL;
  const url = `${GEMINI_API_BASE}/${modelId}:generateContent?key=${apiKey}`;

  const body: {
    contents: GeminiContent[];
    generationConfig: { temperature: number };
    systemInstruction?: { parts: { text: string }[] };
  } = {
    contents: toGeminiContents(history),
    generationConfig: { temperature },
  };
  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    let message = errText || res.statusText;
    try {
      const parsed = JSON.parse(errText);
      message = parsed?.error?.message ?? message;
    } catch {
      /* not JSON, keep raw text */
    }
    throw new Error(`Gemini API error (${res.status}): ${message}`);
  }

  const data = await res.json();
  const candidate = data?.candidates?.[0];
  const text: string =
    candidate?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';

  if (!text) {
    const blockReason = data?.promptFeedback?.blockReason;
    if (blockReason) throw new Error(`Response blocked by Gemini safety filters: ${blockReason}`);
    const finishReason = candidate?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
      throw new Error(`Gemini stopped early (${finishReason}).`);
    }
  }

  return text;
}

/* ============================================================================
 * COMPONENT
 * ==========================================================================*/

const AGENT_SYSTEM_PROMPT = `You are an autonomous AI agent. When given a complex task, break it down into clear steps and work through them methodically.

Format your response:
1. Start with a brief plan (bullet points) of how you'll approach the task.
2. Work through each step, showing your reasoning.
3. End with a clear, structured final answer.

Use markdown headers (##) to separate steps, and always explain your thinking before giving the answer. If the task involves research, analysis, or multi-part questions, tackle each part systematically.`;

export function ChatView({
  chat,
  onOpenSidebar,
  onChatCreated,
  onChatUpdated,
  onOpenDocuments,
}: ChatViewProps) {
  const toast = useToast();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [model, setModel] = useState(chat?.model ?? loadPreferences().default_model ?? DEFAULT_MODEL);
  const [exportOpen, setExportOpen] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [agentMode, setAgentMode] = useState(false);
  const [usage, setUsage] = useState<UsageState | null>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [usagePopoverOpen, setUsagePopoverOpen] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load usage on mount + periodically refresh (every 30s for countdown + RPM)
  useEffect(() => {
    loadUsage().then(setUsage).catch(() => {});
    const interval = setInterval(() => {
      loadUsage().then(setUsage).catch(() => {});
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Load messages whenever the chat changes (from localStorage now).
  useEffect(() => {
    if (!chat) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    try {
      const rows = loadMessagesForChat(chat.id);
      setMessages(rows);
    } catch {
      toast.error('Could not load this conversation.');
    } finally {
      setLoadingMessages(false);
    }
  }, [chat?.id, toast]);

  // Keep local model in sync with the active chat.
  useEffect(() => {
    if (chat) setModel(chat.model);
  }, [chat?.id, chat?.model]);

  // Auto-scroll to bottom as content grows.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, streamingContent, streaming]);

  // All supported models are Gemini models and support multimodal input.
  const modelSupportsMultimodal = true;

  const onModelChange = useCallback(
    (id: string) => {
      setModel(id);
      if (chat) {
        const updated: Chat = { ...chat, model: id, updated_at: new Date().toISOString() };
        const chats = loadChats().map((c) => (c.id === chat.id ? updated : c));
        saveChats(chats);
        onChatUpdated(updated);
      }
    },
    [chat, onChatUpdated],
  );

  /** Handle file selection from drag-drop or file picker */
  const handleUploadFiles = useCallback(
    async (files: File[]) => {
      const newPending: PendingFile[] = files.map((file) => {
        const type = classifyFile(file);
        const id = genId('pf');
        return {
          id,
          file,
          type,
          previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
          status: 'uploading' as const,
        };
      });

      setPendingFiles((prev) => [...prev, ...newPending]);

      for (const pf of newPending) {
        try {
          const { error } = validateFile(pf.file);
          if (error) {
            setPendingFiles((prev) =>
              prev.map((p) => (p.id === pf.id ? { ...p, status: 'error', error } : p)),
            );
            toast.error(error);
            continue;
          }
          const attachment = await localizeAttachment(pf.file, pf.type);
          setPendingFiles((prev) =>
            prev.map((p) => (p.id === pf.id ? { ...p, status: 'done', attachment } : p)),
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : `Failed to process ${pf.file.name}`;
          setPendingFiles((prev) =>
            prev.map((p) => (p.id === pf.id ? { ...p, status: 'error', error: msg } : p)),
          );
          toast.error(msg);
        }
      }
    },
    [toast],
  );

  const handleRemovePendingFile = useCallback((id: string) => {
    setPendingFiles((prev) => {
      const pf = prev.find((p) => p.id === id);
      if (pf?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(pf.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  /** Run a Gemini completion and persist the assistant message to localStorage. */
  const runCompletion = useCallback(
    async (chatId: string, history: Message[], assistantMsg: Message) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setStreaming(true);
      setStreamingId(assistantMsg.id);
      setStreamingContent('');

      const prefs = loadPreferences();
      const systemPrompt = agentMode
        ? AGENT_SYSTEM_PROMPT +
          (prefs.system_prompt ? `\n\nAdditional instructions: ${prefs.system_prompt}` : '')
        : prefs.system_prompt || undefined;

      const persist = (updated: Message) => {
        setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? updated : m)));
        const msgs = loadMessagesForChat(chatId).map((m) => (m.id === assistantMsg.id ? updated : m));
        saveMessagesForChat(chatId, msgs);
      };

      try {
        const text = await callGemini({
          model,
          history,
          systemPrompt,
          temperature: prefs.temperature,
          signal: controller.signal,
        });

        const finalContent = text || '(no response)';

        // The Gemini generateContent endpoint is non-streaming, so we simulate
        // a progressive reveal here to keep the existing streaming UI/caret working.
        const chunkSize = Math.max(4, Math.ceil(finalContent.length / 60));
        for (let i = 0; i < finalContent.length; i += chunkSize) {
          if (controller.signal.aborted) break;
          await new Promise((r) => setTimeout(r, 12));
          setStreamingContent(finalContent.slice(0, i + chunkSize));
        }

        const persistedContent = controller.signal.aborted ? '_(stopped)_' : finalContent;
        persist({ ...assistantMsg, content: persistedContent });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Generation failed.';
        const aborted = controller.signal.aborted || msg.toLowerCase().includes('abort');
        const fallback = aborted ? '_(stopped)_' : `⚠️ ${msg}`;
        persist({ ...assistantMsg, content: fallback });
        if (!aborted) toast.error('The AI response failed.', msg);
      } finally {
        setStreaming(false);
        setStreamingId(null);
        setStreamingContent('');
        abortRef.current = null;
      }
    },
    [model, agentMode, toast],
  );

  /** Send a new user message; creates a chat if none active. */
  const onSend = useCallback(
    async (text: string, attachments?: Attachment[]) => {
      if (streaming) return;

      // Check usage limits before sending
      const attachmentTypes = (attachments ?? []).map((a) => a.type);
      const currentUsage = usage ?? (await loadUsage());
      const blockReason = checkUsage(currentUsage, attachmentTypes);
      if (blockReason) {
        toast.error('Limit reached', blockReason);
        return;
      }

      let activeChat = chat;
      let history = messages;

      // Create a chat lazily on first message.
      if (!activeChat) {
        const now = new Date().toISOString();
        activeChat = {
          id: genId('chat'),
          title: text.slice(0, 40) || 'Attached media',
          model,
          created_at: now,
          updated_at: now,
        };
        saveChats([activeChat, ...loadChats()]);
        onChatCreated(activeChat);
      }

      // Insert user message (and auto-title if first).
      const isFirst = messages.length === 0;
      const userMsg: Message = {
        id: genId('msg'),
        chat_id: activeChat.id,
        role: 'user',
        content: text,
        attachments: attachments ?? null,
        created_at: new Date().toISOString(),
      };
      history = [...messages, userMsg];
      setMessages(history);
      saveMessagesForChat(activeChat.id, history);

      if (isFirst) {
        const newTitle = text.slice(0, 40) || 'Attached media';
        renameChatLocal(activeChat.id, newTitle);
        onChatUpdated({ ...activeChat, title: newTitle });
      }

      // Increment usage counters
      const updatedUsage = await incrementUsage(attachmentTypes);
      setUsage(updatedUsage);

      // Persist assistant placeholder (empty) then stream into it.
      const placeholder: Message = {
        id: genId('msg'),
        chat_id: activeChat.id,
        role: 'assistant',
        content: '',
        attachments: null,
        model,
        created_at: new Date().toISOString(),
      };
      const withPlaceholder = [...history, placeholder];
      setMessages(withPlaceholder);
      saveMessagesForChat(activeChat.id, withPlaceholder);

      await runCompletion(activeChat.id, history, placeholder);
    },
    [chat, messages, model, streaming, usage, onChatCreated, onChatUpdated, runCompletion, toast],
  );

  /** Regenerate the last assistant response. */
  const onRegenerate = useCallback(async () => {
    if (streaming || !chat || messages.length < 2) return;
    let lastAssistantIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        lastAssistantIdx = i;
        break;
      }
    }
    if (lastAssistantIdx === -1) return;
    const assistantMsg = messages[lastAssistantIdx];
    const history = messages.slice(0, lastAssistantIdx);
    const cleared = { ...assistantMsg, content: '' };
    setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? cleared : m)));
    saveMessagesForChat(
      chat.id,
      messages.map((m) => (m.id === assistantMsg.id ? cleared : m)),
    );
    await runCompletion(chat.id, history, cleared);
  }, [chat, messages, streaming, runCompletion]);

  const onStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const onPick = useCallback(
    (prompt: string, agent?: boolean) => {
      if (agent) setAgentMode(true);
      onSend(prompt);
    },
    [onSend],
  );

  // Check if submit should be disabled due to limits
  const isLimitReached = usage !== null && (usage.remainingRequests <= 0 || usage.rpmExceeded);
  const hasReadyFiles = pendingFiles.some((f) => f.status === 'done');

  function doExport(kind: 'md' | 'txt' | 'json') {
    if (!chat) return;
    setExportOpen(false);
    const base = slugify(chat.title);
    if (kind === 'md') {
      downloadFile(`${base}.md`, exportChatAsMarkdown(chat, messages), 'text/markdown');
    } else if (kind === 'txt') {
      downloadFile(`${base}.txt`, exportChatAsText(chat, messages), 'text/plain');
    } else {
      downloadFile(`${base}.json`, exportChatAsJson(chat, messages), 'application/json');
    }
    toast.success('Chat exported.');
  }

  async function onShareLink() {
    if (!chat) return;
    try {
      await navigator.clipboard?.writeText?.(`${window.location.origin}/app?c=${chat.id}`);
      toast.success('Chat link copied.');
    } catch {
      toast.error('Could not copy link.');
    }
  }

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-white dark:bg-surface-dark">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-surface-border px-3 backdrop-blur-md sm:px-4 dark:border-surface-dark-border">
        <button
          onClick={onOpenSidebar}
          className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 md:hidden dark:hover:bg-surface-dark-muted"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            {chat ? chat.title : 'New chat'}
          </h1>
        </div>

        <ModelSelector value={model} onChange={onModelChange} compact />

        {agentMode && (
          <span className="hidden items-center gap-1 rounded-lg bg-gradient-to-br from-brand-500/10 to-accent-500/10 px-2.5 py-1.5 text-xs font-semibold text-brand-600 sm:inline-flex dark:text-brand-300">
            <Bot className="h-3.5 w-3.5" />
            Agent
          </span>
        )}

        {/* Usage tracker badge in header */}
        {usage && (
          <div className="relative">
            <button
              onClick={() => setUsagePopoverOpen((v) => !v)}
              className={clsx(
                'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                isLimitReached
                  ? 'bg-error-50 text-error-600 dark:bg-error-900/20 dark:text-error-400'
                  : 'bg-slate-50 text-slate-500 hover:bg-slate-100 dark:bg-surface-dark-muted dark:text-slate-400 dark:hover:bg-surface-dark-border',
              )}
              aria-label="Daily usage tracker"
              title="View daily quota usage"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden tabular-nums sm:inline">
                {usage.remainingRequests}/{LIMITS.DAILY_REQUESTS}
              </span>
            </button>
            {usagePopoverOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setUsagePopoverOpen(false)} />
                <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-surface-border bg-white p-0 shadow-glow-lg animate-scale-in dark:border-surface-dark-border dark:bg-surface-dark-elevated">
                  <DailyUsageTracker usage={usage} />
                </div>
              </>
            )}
          </div>
        )}

        {chat && messages.length > 0 && (
          <div className="relative">
            <Button variant="ghost" size="icon" onClick={() => setExportOpen((v) => !v)} aria-label="Export chat">
              <Download className="h-4 w-4" />
            </Button>
            {exportOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
                <div className="absolute right-0 z-20 mt-2 w-44 rounded-xl border border-surface-border bg-white p-1 shadow-glow-lg animate-scale-in dark:border-surface-dark-border dark:bg-surface-dark-elevated">
                  <ExportItem onClick={() => doExport('md')} label="Markdown (.md)" />
                  <ExportItem onClick={() => doExport('txt')} label="Plain text (.txt)" />
                  <ExportItem onClick={() => doExport('json')} label="JSON (.json)" />
                  <div className="my-1 border-t border-surface-border dark:border-surface-dark-border" />
                  <ExportItem onClick={onShareLink} label="Copy link" />
                </div>
              </>
            )}
          </div>
        )}
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {!chat && messages.length === 0 ? (
          <WelcomeScreen onPick={onPick} onOpenDocuments={onOpenDocuments} />
        ) : loadingMessages ? (
          <div className="flex h-full items-center justify-center">
            <div className="skeleton h-4 w-48 rounded" />
          </div>
        ) : (
          <div className="mx-auto max-w-3xl pb-6">
            {messages.map((m, i) => (
              <MessageBubble
                key={m.id}
                message={m}
                streaming={streaming && m.id === streamingId}
                onRegenerate={onRegenerate}
                canRegenerate={i === messages.length - 1 && !streaming}
              />
            ))}
            {streaming && streamingContent && (
              <div className="group flex gap-3 px-4 py-5 sm:px-6 bg-slate-50/60 dark:bg-surface-dark-muted/40">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-glow">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="prose-chat stream-caret min-w-0 flex-1 text-slate-700 dark:text-slate-200">
                  <ReactMarkdownSync content={streamingContent} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSend={onSend}
        onStop={() => setConfirmStop(true)}
        streaming={streaming}
        disabled={isLimitReached}
        onAttachFile={onOpenDocuments}
        agentMode={agentMode}
        onToggleAgent={() => setAgentMode((v) => !v)}
        onUploadFiles={handleUploadFiles}
        pendingFiles={pendingFiles}
        onRemovePendingFile={handleRemovePendingFile}
        supportsMultimodal={modelSupportsMultimodal}
      />

      <ConfirmDialog
        open={confirmStop}
        title="Stop generating?"
        description="The AI will stop responding and keep what it has written so far."
        confirmLabel="Stop"
        onConfirm={() => {
          onStop();
          setConfirmStop(false);
        }}
        onCancel={() => setConfirmStop(false)}
      />
    </div>
  );
}

function ExportItem({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-surface-dark-muted"
    >
      {label}
    </button>
  );
}

function ReactMarkdownSync({ content }: { content: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>;
}
