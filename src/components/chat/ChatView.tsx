import { useCallback, useEffect, useRef, useState } from 'react';
import { Menu, Download, Sparkles, Bot } from 'lucide-react';
import { ChatInput, type PendingFile } from './ChatInput';
import { MessageBubble } from './MessageBubble';
import { WelcomeScreen } from './WelcomeScreen';
import { ModelSelector } from '@/components/ui/ModelSelector';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DailyUsageTracker } from './DailyUsageTracker';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { streamChatCompletion, toApiMessages } from '@/lib/ai';
import {
  addMessage,
  createChat,
  fetchMessages,
  setChatModel,
  seedFirstUserMessage,
  updateMessageContent,
} from '@/lib/chats';
import { uploadAttachment, validateFile, classifyFile } from '@/lib/attachments';
import { loadUsage, incrementUsage, checkUsage, type UsageState, LIMITS } from '@/lib/usage';
import type { Chat, Message, Provider, Attachment, AttachmentType } from '@/lib/database.types';
import { getModel } from '@/lib/models';
import {
  downloadFile,
  exportChatAsJson,
  exportChatAsMarkdown,
  exportChatAsText,
  slugify,
} from '@/lib/utils';
import { clsx } from '@/lib/clsx';

interface ChatViewProps {
  chat: Chat | null;
  onOpenSidebar: () => void;
  onChatCreated: (chat: Chat) => void;
  onChatUpdated: (chat: Chat) => void;
  onOpenDocuments: () => void;
  onNavigateChat: (id: string) => void;
}

const GEMINI_MODEL = 'gemini/gemini-2.5-flash';

export function ChatView({
  chat,
  onOpenSidebar,
  onChatCreated,
  onChatUpdated,
  onOpenDocuments,
}: ChatViewProps) {
  const { preferences } = useAuth();
  const toast = useToast();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [model, setModel] = useState(chat?.model ?? preferences?.default_model ?? 'groq/llama-3.3-70b-versatile');
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

  // Load messages whenever the chat changes.
  useEffect(() => {
    if (!chat) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoadingMessages(true);
    fetchMessages(chat.id)
      .then((rows) => {
        if (!cancelled) setMessages(rows);
      })
      .catch(() => toast.error('Could not load this conversation.'))
      .finally(() => !cancelled && setLoadingMessages(false));
    return () => {
      cancelled = true;
    };
  }, [chat?.id, toast]);

  // Keep local model in sync with the active chat.
  useEffect(() => {
    if (chat) setModel(chat.model);
  }, [chat?.id, chat?.model]);

  // Auto-scroll to bottom as content grows.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, streamingContent, streaming]);

  // Check if current model supports multimodal
  const modelSupportsMultimodal = model.startsWith('gemini/');

  const onModelChange = useCallback(
    async (id: string) => {
      setModel(id);
      const opt = getModel(id);
      if (chat && opt) {
        try {
          await setChatModel(chat.id, opt.provider as Provider, id);
          onChatUpdated({ ...chat, provider: opt.provider as Provider, model: id });
        } catch {
          /* non-fatal */
        }
      }
    },
    [chat, onChatUpdated],
  );

  /** Handle file selection from drag-drop or file picker */
  const handleUploadFiles = useCallback(async (files: File[]) => {
    const newPending: PendingFile[] = files.map((file) => {
      const type = classifyFile(file);
      const id = `pf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return {
        id,
        file,
        type: type ?? 'image',
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
        status: 'uploading' as const,
      };
    });

    setPendingFiles((prev) => [...prev, ...newPending]);

    // Upload each file
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
        const attachment = await uploadAttachment(pf.file, pf.type);
        setPendingFiles((prev) =>
          prev.map((p) => (p.id === pf.id ? { ...p, status: 'done', attachment } : p)),
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : `Failed to upload ${pf.file.name}`;
        setPendingFiles((prev) =>
          prev.map((p) => (p.id === pf.id ? { ...p, status: 'error', error: msg } : p)),
        );
        toast.error(msg);
      }
    }
  }, [toast]);

  const handleRemovePendingFile = useCallback((id: string) => {
    setPendingFiles((prev) => {
      const pf = prev.find((p) => p.id === id);
      if (pf?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(pf.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  /** Run a completion stream and persist the assistant message. */
  const runCompletion = useCallback(
    async (chatId: string, history: Message[], assistantMsg: Message, pendingAttachments?: Record<string, Attachment[]>) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setStreaming(true);
      setStreamingId(assistantMsg.id);
      setStreamingContent('');

      const opt = getModel(model);
      const provider = (opt?.provider ?? 'groq') as Provider;
      const apiMessages = toApiMessages(history, pendingAttachments);

      let acc = '';
      try {
        for await (const delta of streamChatCompletion({
          messages: apiMessages,
          model,
          temperature: preferences?.temperature ?? 0.7,
          systemPrompt: agentMode
            ? AGENT_SYSTEM_PROMPT + (preferences?.system_prompt ? `\n\nAdditional instructions: ${preferences.system_prompt}` : '')
            : preferences?.system_prompt || undefined,
          signal: controller.signal,
        })) {
          acc += delta;
          setStreamingContent(acc);
        }

        // Persist final content.
        const finalContent = acc || '(no response)';
        await updateMessageContent(assistantMsg.id, finalContent);
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: finalContent } : m)),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Generation failed.';
        const aborted = msg.toLowerCase().includes('abort');
        const fallback = aborted ? '_(stopped)_' : `⚠️ ${msg}`;
        await updateMessageContent(assistantMsg.id, fallback);
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: fallback } : m)),
        );
        if (!aborted) toast.error('The AI response failed.', msg);
      } finally {
        setStreaming(false);
        setStreamingId(null);
        setStreamingContent('');
        abortRef.current = null;
      }
    },
    [model, preferences?.temperature, preferences?.system_prompt, agentMode, toast],
  );

  /** Send a new user message; creates a chat if none active. */
  const onSend = useCallback(
    async (text: string, attachments?: Attachment[]) => {
      if (streaming) return;

      // Check usage limits before sending
      const attachmentTypes = (attachments ?? []).map((a) => a.type);
      const currentUsage = usage ?? await loadUsage();
      const blockReason = checkUsage(currentUsage, attachmentTypes);
      if (blockReason) {
        toast.error('Limit reached', blockReason);
        return;
      }

      let activeChat = chat;
      let history = messages;

      // Create a chat lazily on first message.
      if (!activeChat) {
        try {
          const opt = getModel(model);
          activeChat = await createChat({
            provider: (opt?.provider ?? 'groq') as Provider,
            model,
          });
          onChatCreated(activeChat);
        } catch {
          toast.error('Could not start a new chat.');
          return;
        }
      }

      // Insert user message (and auto-title if first).
      const userAttachments = attachments ?? null;
      try {
        const isFirst = messages.length === 0;
        const userMsg = isFirst
          ? await seedFirstUserMessage(activeChat.id, text, userAttachments)
          : await addMessage({ chat_id: activeChat.id, role: 'user', content: text, attachments: userAttachments });
        history = [...messages, userMsg];
        setMessages(history);
        if (isFirst) onChatUpdated({ ...activeChat, title: text.slice(0, 40) || 'Attached media' });
      } catch {
        toast.error('Could not save your message.');
        return;
      }

      // Increment usage counters
      const updatedUsage = await incrementUsage(attachmentTypes);
      setUsage(updatedUsage);

      // Optimistic assistant placeholder.
      const placeholder: Message = {
        id: `tmp-${Date.now()}`,
        chat_id: activeChat.id,
        user_id: '',
        role: 'assistant',
        content: '',
        provider: getModel(model)?.provider ?? 'groq',
        model,
        tokens: null,
        attachments: null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, placeholder]);

      // Build pendingAttachments map for the user message we just sent
      const lastUserMsg = history[history.length - 1];
      const pendingAttachments: Record<string, Attachment[]> | undefined =
        userAttachments && userAttachments.length > 0
          ? { [lastUserMsg.id]: userAttachments }
          : undefined;

      // Persist the assistant row (empty) then stream into it.
      try {
        const persisted = await addMessage({
          chat_id: activeChat.id,
          role: 'assistant',
          content: '',
          provider: (getModel(model)?.provider ?? 'groq') as Provider,
          model,
        });
        setMessages((prev) =>
          prev.map((m) => (m.id === placeholder.id ? persisted : m)),
        );
        await runCompletion(activeChat.id, history, persisted, pendingAttachments);
      } catch {
        toast.error('Could not reach the AI service.');
        setMessages((prev) => prev.filter((m) => m.id !== placeholder.id));
      }
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
    await updateMessageContent(assistantMsg.id, '');
    setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: '' } : m)));
    await runCompletion(chat.id, history, assistantMsg);
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

// Small wrapper to render markdown for the live streaming preview without
// re-importing react-markdown in this file's top scope (kept here for clarity).
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
function ReactMarkdownSync({ content }: { content: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>;
}

const AGENT_SYSTEM_PROMPT = `You are an autonomous AI agent. When given a complex task, break it down into clear steps and work through them methodically.

Format your response:
1. Start with a brief plan (bullet points) of how you'll approach the task.
2. Work through each step, showing your reasoning.
3. End with a clear, structured final answer.

Use markdown headers (##) to separate steps, and always explain your thinking before giving the answer. If the task involves research, analysis, or multi-part questions, tackle each part systematically.`;
