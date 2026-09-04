import { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, RotateCcw, Sparkles, User } from 'lucide-react';
import { MessageAttachments } from './MessageAttachments';
import type { Message } from '@/lib/database.types';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { copyToClipboard, formatTime } from '@/lib/utils';
import { clsx } from '@/lib/clsx';

interface MessageBubbleProps {
  message: Message;
  streaming?: boolean;
  onRegenerate?: () => void;
  canRegenerate?: boolean;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  streaming,
  onRegenerate,
  canRegenerate,
}: MessageBubbleProps) {
  const { profile, user } = useAuth();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  async function onCopy() {
    const ok = await copyToClipboard(message.content);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } else {
      toast.error('Could not copy to clipboard.');
    }
  }

  return (
    <div className={clsx('group flex gap-3 px-4 py-5 sm:px-6', isUser ? '' : 'bg-slate-50/60 dark:bg-surface-dark-muted/40')}>
      <div className="shrink-0">
        {isUser ? (
          <Avatar name={profile?.full_name || user?.email} url={profile?.avatar_url} size={32} />
        ) : (
          <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-glow">
            <Sparkles className="h-4 w-4" />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {isUser ? (profile?.full_name || 'You') : 'Nexus AI'}
          </span>
          <span className="text-xs text-slate-400">{formatTime(message.created_at)}</span>
          {!isUser && message.model && (
            <span className="hidden rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 sm:inline dark:bg-surface-dark dark:text-slate-400">
              {message.model.split('/').pop()}
            </span>
          )}
        </div>

        <div
          className={clsx(
            'prose-chat text-slate-700 dark:text-slate-200',
            streaming && !message.content && 'text-slate-400',
          )}
        >
          {streaming && !message.content ? (
            <TypingDots />
          ) : (
            <>
              {message.attachments && message.attachments.length > 0 && (
                <MessageAttachments attachments={message.attachments} />
              )}
              {isUser ? (
                <p className="whitespace-pre-wrap">{message.content}</p>
              ) : (
                <div className={clsx(streaming && 'stream-caret')}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                </div>
              )}
            </>
          )}
        </div>

        {/* Action bar — show on hover when not streaming */}
        {!streaming && message.content && (
          <div className="mt-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <ActionBtn onClick={onCopy} label={copied ? 'Copied' : 'Copy'}>
              {copied ? <Check className="h-3.5 w-3.5 text-success-500" /> : <Copy className="h-3.5 w-3.5" />}
            </ActionBtn>
            {!isUser && canRegenerate && onRegenerate && (
              <ActionBtn onClick={onRegenerate} label="Regenerate">
                <RotateCcw className="h-3.5 w-3.5" />
              </ActionBtn>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

function ActionBtn({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-600 dark:hover:bg-surface-dark-muted dark:hover:text-slate-200"
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1">
      <span className="h-2 w-2 rounded-full bg-brand-400 animate-bounce-dot" />
      <span className="h-2 w-2 rounded-full bg-brand-400 animate-bounce-dot [animation-delay:0.2s]" />
      <span className="h-2 w-2 rounded-full bg-brand-400 animate-bounce-dot [animation-delay:0.4s]" />
    </span>
  );
}

export { User };
