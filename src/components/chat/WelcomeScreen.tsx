import { Sparkles, FileText, Code2, Lightbulb, PenLine, GraduationCap, Bot } from 'lucide-react';
import { LogoMark } from '@/components/ui/Logo';

const STARTERS = [
  {
    icon: PenLine,
    title: 'Write a professional email',
    prompt: 'Write a professional follow-up email after a job interview for a product designer role. Keep it warm and concise.',
  },
  {
    icon: Lightbulb,
    title: 'Brainstorm ideas',
    prompt: 'Give me 5 creative side-project ideas that combine AI with everyday productivity, with a one-line pitch for each.',
  },
  {
    icon: Code2,
    title: 'Explain a concept',
    prompt: 'Explain how HTTPS encryption works, using a simple analogy a 12-year-old would understand.',
  },
  {
    icon: FileText,
    title: 'Summarize a topic',
    prompt: 'Summarize the key benefits and risks of remote work for a small team, as bullet points.',
  },
  {
    icon: Bot,
    title: 'Plan with AI Agent',
    prompt: 'I need to launch a SaaS product in 30 days. Break this down into a week-by-week plan with key milestones, risks, and what to prioritize first.',
    agent: true,
  },
];

interface WelcomeScreenProps {
  onPick: (prompt: string, agent?: boolean) => void;
  onOpenDocuments: () => void;
}

export function WelcomeScreen({ onPick, onOpenDocuments }: WelcomeScreenProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="animate-slide-up text-center">
        <div className="relative mx-auto mb-6 h-16 w-16">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 opacity-30 blur-xl" />
          <LogoMark size={64} className="relative animate-float" />
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          How can I help you today?
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-slate-500 dark:text-slate-400">
          Ask anything, upload a document to summarize, or pick a starting point below.
        </p>
      </div>

      <div className="mt-10 grid w-full max-w-2xl grid-cols-1 gap-3 animate-fade-in sm:grid-cols-2">
        {STARTERS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.title}
              onClick={() => onPick(s.prompt, (s as { agent?: boolean }).agent)}
              className="group flex items-start gap-3 rounded-2xl border border-surface-border bg-white p-4 text-left transition-all hover:border-brand-300 hover:shadow-card dark:border-surface-dark-border dark:bg-surface-dark-elevated dark:hover:border-brand-700 dark:hover:shadow-card-dark"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white transition-transform group-hover:scale-110"
                style={{
                  background: (s as { agent?: boolean }).agent
                    ? 'linear-gradient(135deg, var(--color-brand-500), var(--color-accent-500))'
                    : undefined,
                }}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {s.title}
                  {(s as { agent?: boolean }).agent && (
                    <span className="ml-1.5 rounded bg-brand-100 px-1.5 py-0.5 text-[10px] uppercase text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">Agent</span>
                  )}
                </span>
                <span className="mt-0.5 line-clamp-2 block text-xs text-slate-500 dark:text-slate-400">{s.prompt}</span>
              </span>
            </button>
          );
        })}
      </div>

      <button
        onClick={onOpenDocuments}
        className="mt-8 inline-flex items-center gap-2 rounded-xl border border-surface-border bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-all hover:border-brand-300 hover:text-brand-600 dark:border-surface-dark-border dark:bg-surface-dark-elevated dark:text-slate-300 dark:hover:text-brand-300"
      >
        <GraduationCap className="h-4 w-4" />
        Or summarize a PDF document
      </button>

      <p className="mt-10 flex items-center gap-1.5 text-xs text-slate-400">
        <Sparkles className="h-3.5 w-3.5 text-brand-400" />
        Powered by your choice of Groq, Gemini, or OpenRouter models.
      </p>
    </div>
  );
}
