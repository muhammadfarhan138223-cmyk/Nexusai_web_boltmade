import { useState } from 'react';
import {
  ArrowLeft,
  Search,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { Seo } from '@/components/ui/Seo';
import { AGENTS, type AgentDefinition } from '@/lib/agents';
import { clsx } from '@/lib/clsx';

interface AgentHubProps {
  onStartAgent: (agent: AgentDefinition) => void;
  onBack: () => void;
}

export function AgentHub({ onStartAgent, onBack }: AgentHubProps) {
  const [query, setQuery] = useState('');

  const filtered = AGENTS.filter((a) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      a.name.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex h-full flex-col bg-surface-subtle dark:bg-surface-dark">
      <Seo title="Agent Hub" path="/app/agents" />
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-surface-border bg-white/80 px-4 backdrop-blur-md dark:border-surface-dark-border dark:bg-surface-dark/80">
        <button
          onClick={onBack}
          className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-surface-dark-muted"
          aria-label="Back to chat"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold text-slate-800 dark:text-slate-100">Agent Hub</h1>
        <span className="ml-1 flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
          <Sparkles className="h-3 w-3" />
          {AGENTS.length} agents
        </span>

        <div className="relative ml-auto w-40 sm:w-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search agents…"
            className="w-full rounded-xl border border-surface-border bg-white py-1.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-surface-dark-border dark:bg-surface-dark-muted dark:text-slate-100"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl p-4 sm:p-8">
          <div className="mb-6">
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              Choose your AI expert
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Each agent asks questions, creates a plan, gets your approval, then builds step by step.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((agent) => (
              <AgentCard key={agent.id} agent={agent} onStart={() => onStartAgent(agent)} />
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-sm text-slate-400">No agents match "{query}".</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AgentCard({ agent, onStart }: { agent: AgentDefinition; onStart: () => void }) {
  const Icon: LucideIcon = agent.icon;
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-surface-border bg-white p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-glow-lg dark:border-surface-dark-border dark:bg-surface-dark-elevated dark:shadow-card-dark">
      {/* Glow accent */}
      <div
        className={clsx(
          'absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br opacity-10 blur-2xl transition-opacity duration-300 group-hover:opacity-20',
          agent.gradient,
        )}
      />

      <div className="relative flex items-start gap-4">
        <div
          className={clsx(
            'grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-md transition-transform duration-300 group-hover:scale-110',
            agent.gradient,
          )}
        >
          <Icon className="h-6 w-6" />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
            {agent.name}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {agent.description}
          </p>
        </div>
      </div>

      <button
        onClick={onStart}
        className={clsx(
          'mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r py-2.5 text-sm font-semibold text-white transition-all duration-300 hover:shadow-lg active:scale-[0.98]',
          agent.gradient,
        )}
      >
        <Sparkles className="h-4 w-4" />
        Start
      </button>
    </div>
  );
}
