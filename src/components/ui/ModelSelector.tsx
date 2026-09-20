import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Zap } from 'lucide-react';
import { MODELS, getModel, modelsByProvider, PROVIDERS, type ModelOption } from '@/lib/models';
import { getVerifiedModels } from '@/lib/modelCatalog';
import { clsx } from '@/lib/clsx';
import type { Provider } from '@/lib/database.types';

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  className?: string;
  compact?: boolean;
}

const POPUP_HEIGHT = 360;

export function ModelSelector({ value, onChange, className, compact }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [models, setModels] = useState<ModelOption[]>(MODELS);
  const ref = useRef<HTMLDivElement>(null);
  const current = getModel(value, models);

  // Swap in the live-verified model list (only models that actually exist
  // on the connected provider accounts right now) once it's ready. Starts
  // with the static list so the UI renders instantly.
  useEffect(() => {
    let cancelled = false;
    getVerifiedModels().then((list) => {
      if (!cancelled && list.length > 0) setModels(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    setDropUp(spaceBelow < POPUP_HEIGHT && rect.top > spaceBelow);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
    };
  }, [open]);

  return (
    <div ref={ref} className={clsx('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'inline-flex items-center gap-2 rounded-xl border border-surface-border bg-white px-3 py-2 text-sm font-medium transition-colors',
          'hover:bg-slate-50 dark:bg-surface-dark-elevated dark:hover:bg-surface-dark-muted',
          compact && 'py-1.5',
        )}
      >
        <span className="grid h-5 w-5 place-items-center rounded-md bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
          <Zap className="h-3 w-3" />
        </span>
        <span className="max-w-[140px] truncate text-slate-700 dark:text-slate-200">
          {current?.label ?? value}
        </span>
        <ChevronDown className={clsx('h-4 w-4 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          className={clsx(
            'absolute right-0 z-50 w-72 rounded-2xl border border-surface-border bg-white p-1.5 shadow-glow-lg animate-scale-in dark:bg-surface-dark-elevated dark:border-surface-dark-border',
            dropUp ? 'origin-bottom-right bottom-full mb-2' : 'origin-top-right mt-2',
          )}
        >
          <div className="max-h-[60vh] overflow-y-auto">
            {PROVIDERS.map((p) => {
              const list = modelsByProvider(p.id as Provider, models);
              if (!list.length) return null;
              return (
                <div key={p.id} className="mb-1">
                  <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {p.label} · <span className="font-normal normal-case">{p.description}</span>
                  </p>
                  {list.map((m) => {
                    const active = m.id === value;
                    return (
                      <button
                        key={m.id}
                        onClick={() => {
                          onChange(m.id);
                          setOpen(false);
                        }}
                        className={clsx(
                          'flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left transition-colors',
                          active ? 'bg-brand-50 dark:bg-brand-900/30' : 'hover:bg-slate-50 dark:hover:bg-surface-dark-muted',
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                              {m.label}
                            </span>
                            {m.badge && (
                              <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                                {m.badge}
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                            {m.description}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-slate-400">{m.contextWindow} context</span>
                        </span>
                        {active && <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export { MODELS };
