import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Search,
  MessageSquare,
  Pin,
  PinOff,
  Trash2,
  Pencil,
  Settings,
  LogOut,
  X,
  Sparkles,
  FileText,
  Video as VideoIcon,
  ChevronRight,
  Bot,
  type LucideIcon,
} from 'lucide-react';
import { Logo, LogoMark } from '@/components/ui/Logo';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { clsx } from '@/lib/clsx';
import { formatChatDate } from '@/lib/utils';
import { deleteChat, fetchChats, renameChat, searchChats, toggleChatPin } from '@/lib/chats';
import type { Chat, AgentSession } from '@/lib/database.types';
import { getAgent } from '@/lib/agents';
import { Seo } from '@/components/ui/Seo';
import { DailyUsageTracker } from '@/components/chat/DailyUsageTracker';
import { loadUsage, type UsageState } from '@/lib/usage';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onOpenDocuments: () => void;
  onOpenVideo: () => void;
  onOpenAgents: () => void;
  onOpenAgentSession: (session: AgentSession) => void;
  chats: Chat[];
  reloadChats: () => Promise<void>;
  agentSessions: AgentSession[];
  reloadAgentSessions: () => Promise<void>;
}

export function Sidebar({
  open,
  onClose,
  activeChatId,
  onSelectChat,
  onNewChat,
  onOpenSettings,
  onOpenDocuments,
  onOpenVideo,
  onOpenAgents,
  onOpenAgentSession,
  chats,
  reloadChats,
  agentSessions,
  reloadAgentSessions,
}: SidebarProps) {
  const { user, profile, signOut } = useAuth();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Chat | null>(null);
  const [searchResults, setSearchResults] = useState<Chat[] | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const [usage, setUsage] = useState<UsageState | null>(null);

  useEffect(() => {
    if (editingId) {
      requestAnimationFrame(() => editInputRef.current?.select());
    }
  }, [editingId]);

  // Load daily usage for the tracker widget.
  useEffect(() => {
    loadUsage().then(setUsage).catch(() => {});
    const interval = setInterval(() => {
      loadUsage().then(setUsage).catch(() => {});
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Debounced search; null = not searching.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const res = await searchChats(q);
        setSearchResults(res);
      } catch {
        setSearchResults([]);
      }
    }, 220);
    return () => clearTimeout(handle);
  }, [query]);

  const displayed = searchResults ?? chats;

  const grouped = useMemo(() => {
    const pinned = displayed.filter((c) => c.pinned);
    const rest = displayed.filter((c) => !c.pinned);
    // group by relative date bucket
    const buckets = new Map<string, Chat[]>();
    for (const c of rest) {
      const key = formatChatDate(c.updated_at);
      const arr = buckets.get(key) ?? [];
      arr.push(c);
      buckets.set(key, arr);
    }
    return { pinned, buckets: Array.from(buckets.entries()) };
  }, [displayed]);

  async function commitRename(id: string) {
    const title = editTitle.trim();
    setEditingId(null);
    if (!title) return;
    try {
      await renameChat(id, title);
      await reloadChats();
    } catch {
      toast.error('Could not rename chat.');
    }
  }

  async function onPin(chat: Chat) {
    try {
      await toggleChatPin(chat.id, !chat.pinned);
      await reloadChats();
    } catch {
      toast.error('Could not update chat.');
    }
  }

  async function onDelete() {
    if (!confirmDelete) return;
    try {
      await deleteChat(confirmDelete.id);
      if (activeChatId === confirmDelete.id) onNewChat();
      await reloadChats();
      toast.success('Chat deleted.');
    } catch {
      toast.error('Could not delete chat.');
    } finally {
      setConfirmDelete(null);
    }
  }

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={clsx(
          'fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm transition-opacity md:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col border-r border-surface-border bg-surface-subtle transition-transform duration-300 ease-smooth-out md:static md:translate-x-0 dark:bg-surface-dark dark:border-surface-dark-border',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Brand + new chat */}
        <div className="flex items-center justify-between gap-2 p-3">
          <a href="/app" className="flex items-center" aria-label="Nexus AI home">
            <LogoMark size={30} />
            <span className="ml-2 font-display text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
              Nexus<span className="text-gradient"> AI</span>
            </span>
          </a>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 md:hidden dark:hover:bg-surface-dark-muted"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-3">
          <button
            onClick={onNewChat}
            className={clsx(
              'group flex w-full items-center gap-2 rounded-xl border border-surface-border bg-white px-3 py-2.5 text-sm font-medium text-slate-700',
              'transition-all hover:border-brand-300 hover:shadow-glow dark:bg-surface-dark-elevated dark:text-slate-200 dark:hover:border-brand-700',
            )}
          >
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 text-white">
              <Plus className="h-4 w-4" />
            </span>
            New chat
            <kbd className="ml-auto hidden rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400 group-hover:inline dark:bg-surface-dark-muted">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats…"
              className="w-full rounded-xl border border-surface-border bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-surface-dark-border dark:bg-surface-dark-muted dark:text-slate-100"
            />
          </div>
        </div>

        {/* Chat list */}
        <nav className="mt-3 flex-1 overflow-y-auto px-3 pb-3">
          {searchResults && displayed.length === 0 && (
            <p className="px-2 py-6 text-center text-sm text-slate-400">No chats match “{query}”.</p>
          )}
          {displayed.length === 0 && !searchResults && (
            <div className="px-2 py-8 text-center">
              <Sparkles className="mx-auto mb-2 h-6 w-6 text-brand-400" />
              <p className="text-sm text-slate-400">Your conversations will appear here.</p>
            </div>
          )}

          {grouped.pinned.length > 0 && (
            <SectionLabel>Pinned</SectionLabel>
          )}
          {grouped.pinned.map((chat) => (
            <ChatRow
              key={chat.id}
              chat={chat}
              active={chat.id === activeChatId}
              editing={editingId === chat.id}
              editTitle={editTitle}
              editInputRef={editInputRef}
              onSelect={() => onSelectChat(chat.id)}
              onStartEdit={() => {
                setEditingId(chat.id);
                setEditTitle(chat.title);
              }}
              onEditChange={setEditTitle}
              onCommitEdit={() => commitRename(chat.id)}
              onPin={() => onPin(chat)}
              onDelete={() => setConfirmDelete(chat)}
            />
          ))}

          {grouped.buckets.map(([label, items]) => (
            <div key={label}>
              <SectionLabel>{label}</SectionLabel>
              {items.map((chat) => (
                <ChatRow
                  key={chat.id}
                  chat={chat}
                  active={chat.id === activeChatId}
                  editing={editingId === chat.id}
                  editTitle={editTitle}
                  editInputRef={editInputRef}
                  onSelect={() => onSelectChat(chat.id)}
                  onStartEdit={() => {
                    setEditingId(chat.id);
                    setEditTitle(chat.title);
                  }}
                  onEditChange={setEditTitle}
                  onCommitEdit={() => commitRename(chat.id)}
                  onPin={() => onPin(chat)}
                  onDelete={() => setConfirmDelete(chat)}
                />
              ))}
            </div>
          ))}
        </nav>

        {/* Agent Hub + Documents + Video shortcuts */}
        <div className="border-t border-surface-border p-3 dark:border-surface-dark-border">
          <button
            onClick={onOpenAgents}
            className="group mb-0.5 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-surface-dark-muted"
          >
            <span className="grid h-5 w-5 place-items-center rounded-md bg-gradient-to-br from-brand-500 to-accent-500 text-white">
              <Bot className="h-3.5 w-3.5" />
            </span>
            Agent Hub
            <span className="ml-auto rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
              New
            </span>
          </button>

          {agentSessions.length > 0 && (
            <div className="mb-1 mt-1 max-h-32 overflow-y-auto">
              {agentSessions.slice(0, 5).map((s) => {
                const def = getAgent(s.agent_type);
                const SIcon: LucideIcon | undefined = def?.icon;
                return (
                  <button
                    key={s.id}
                    onClick={() => onOpenAgentSession(s)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-surface-dark-muted"
                  >
                    {SIcon && <SIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                    <span className="truncate">{s.title}</span>
                    <span className={clsx('ml-auto h-1.5 w-1.5 rounded-full', s.status === 'building' ? 'bg-brand-500' : s.status === 'completed' ? 'bg-success-500' : s.status === 'paused' ? 'bg-warning-500' : 'bg-slate-300 dark:bg-slate-600')} />
                  </button>
                );
              })}
            </div>
          )}

          <button
            onClick={onOpenVideo}
            className="group mb-0.5 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-surface-dark-muted"
          >
            <span className="grid h-5 w-5 place-items-center rounded-md bg-gradient-to-br from-brand-500 to-accent-500 text-white">
              <VideoIcon className="h-3.5 w-3.5" />
            </span>
            Video Studio
          </button>
          <button
            onClick={onOpenDocuments}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-surface-dark-muted"
          >
            <FileText className="h-4 w-4" />
            Documents
            <ChevronRight className="ml-auto h-4 w-4 text-slate-400" />
          </button>
        </div>

        {/* Daily usage tracker */}
        {usage && (
          <div className="px-3 pb-2">
            <DailyUsageTracker usage={usage} />
          </div>
        )}

        {/* User footer */}
        <div className="border-t border-surface-border p-3 dark:border-surface-dark-border">
          <div className="flex items-center gap-2 rounded-xl p-1.5">
            <Avatar name={profile?.full_name || user?.email} url={profile?.avatar_url} size={34} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                {profile?.full_name || 'New user'}
              </p>
              <p className="truncate text-xs text-slate-400">{user?.email}</p>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                onClick={onOpenSettings}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-surface-dark-muted dark:hover:text-slate-200"
                aria-label="Settings"
                title="Settings"
              >
                <Settings className="h-4 w-4" />
              </button>
              <button
                onClick={signOut}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-900/20 dark:hover:text-error-400"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete chat?"
        description="This conversation and all its messages will be permanently removed."
        confirmLabel="Delete"
        destructive
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
      {children}
    </p>
  );
}

interface ChatRowProps {
  chat: Chat;
  active: boolean;
  editing: boolean;
  editTitle: string;
  editInputRef: React.RefObject<HTMLInputElement>;
  onSelect: () => void;
  onStartEdit: () => void;
  onEditChange: (v: string) => void;
  onCommitEdit: () => void;
  onPin: () => void;
  onDelete: () => void;
}

function ChatRow({
  chat,
  active,
  editing,
  editTitle,
  editInputRef,
  onSelect,
  onStartEdit,
  onEditChange,
  onCommitEdit,
  onPin,
  onDelete,
}: ChatRowProps) {
  return (
    <div
      className={clsx(
        'group relative mb-0.5 flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-brand-50 text-brand-900 dark:bg-brand-900/30 dark:text-brand-100'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-surface-dark-muted',
      )}
    >
      {editing ? (
        <input
          ref={editInputRef}
          value={editTitle}
          onChange={(e) => onEditChange(e.target.value)}
          onBlur={onCommitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCommitEdit();
            if (e.key === 'Escape') onCommitEdit();
          }}
          className="w-full rounded-md bg-white px-1.5 py-0.5 text-sm outline-none ring-2 ring-brand-500/40 dark:bg-surface-dark-muted"
        />
      ) : (
        <button onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <MessageSquare className={clsx('h-4 w-4 shrink-0', active ? 'text-brand-500' : 'text-slate-400')} />
          <span className="truncate">{chat.title}</span>
          {chat.pinned && <Pin className="h-3 w-3 shrink-0 text-brand-500" />}
        </button>
      )}

      {!editing && (
        <div className="absolute right-1.5 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-lg bg-white/90 p-0.5 shadow-sm group-hover:flex dark:bg-surface-dark-elevated/90">
          <IconBtn onClick={onPin} label={chat.pinned ? 'Unpin' : 'Pin'}>
            {chat.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </IconBtn>
          <IconBtn onClick={onStartEdit} label="Rename">
            <Pencil className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn onClick={onDelete} label="Delete" danger>
            <Trash2 className="h-3.5 w-3.5" />
          </IconBtn>
        </div>
      )}
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  label,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      title={label}
      className={clsx(
        'rounded-md p-1 text-slate-400 transition-colors',
        danger ? 'hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-900/20' : 'hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-surface-dark-muted dark:hover:text-slate-200',
      )}
    >
      {children}
    </button>
  );
}

// re-export to avoid an unused import warning; chats loader used by parent
export { fetchChats };
