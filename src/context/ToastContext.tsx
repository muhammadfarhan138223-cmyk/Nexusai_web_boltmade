import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toast: (t: { kind?: ToastKind; title: string; description?: string }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ kind = 'info', title, description }: { kind?: ToastKind; title: string; description?: string }) => {
      const id = ++counter;
      setToasts((prev) => [...prev, { id, kind, title, description }]);
      window.setTimeout(() => dismiss(id), 4200);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (title, description) => toast({ kind: 'success', title, description }),
      error: (title, description) => toast({ kind: 'error', title, description }),
      info: (title, description) => toast({ kind: 'info', title, description }),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:bottom-4 sm:right-4 sm:left-auto sm:items-end">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const config = {
    success: { icon: CheckCircle2, ring: 'text-success-500', bar: 'bg-success-500' },
    error: { icon: AlertCircle, ring: 'text-error-500', bar: 'bg-error-500' },
    info: { icon: Info, ring: 'text-brand-500', bar: 'bg-brand-500' },
  }[toast.kind];
  const Icon = config.icon;

  return (
    <div className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-xl border border-surface-border bg-white shadow-card animate-slide-in-right dark:bg-surface-dark-elevated dark:shadow-card-dark">
      <div className="flex items-start gap-3 p-4">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${config.ring}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{toast.title}</p>
          {toast.description && (
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{toast.description}</p>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-surface-dark-muted dark:hover:text-slate-200"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className={`h-0.5 ${config.bar}`} />
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
