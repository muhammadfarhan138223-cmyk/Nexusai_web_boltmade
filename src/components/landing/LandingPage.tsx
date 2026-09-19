import { useEffect, useState } from 'react';
import {
  Sparkles,
  ArrowRight,
  MessageSquare,
  FileText,
  Search,
  Download,
  Brain,
  Code2,
  GraduationCap,
  Mic,
  Image as ImageIcon,
  Bot,
  Zap,
  Shield,
  Moon,
  Sun,
  Check,
  Star,
  Plus,
} from 'lucide-react';
import { Logo, LogoMark } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { Seo } from '@/components/ui/Seo';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { clsx } from '@/lib/clsx';

export function LandingPage({ onEnter }: { onEnter: (view: 'app' | 'login' | 'signup') => void }) {
  const { session } = useAuth();
  const { resolvedTheme, toggle } = useTheme();

  return (
    <div className="relative min-h-dvh overflow-hidden bg-surface-subtle text-slate-900 dark:bg-surface-dark dark:text-slate-100">
      <Seo />
      {/* Ambient backdrop */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-brand-400/20 blur-3xl dark:bg-brand-600/15" />
        <div className="absolute -right-40 top-1/4 h-[32rem] w-[32rem] rounded-full bg-accent-400/20 blur-3xl dark:bg-accent-700/15" />
        <div className="absolute inset-0 bg-grid-light dark:bg-grid-dark opacity-50" />
      </div>

      <div className="relative z-10">
        <Nav onEnter={onEnter} session={!!session} theme={resolvedTheme} onToggleTheme={toggle} />
        <Hero onEnter={onEnter} session={!!session} />
        <ModelStrip />
        <Features />
        <Ecosystem />
        <Pricing onEnter={onEnter} />
        <CTA onEnter={onEnter} session={!!session} />
        <Footer />
      </div>
    </div>
  );
}

// ---------------- Nav ----------------

function Nav({
  onEnter,
  session,
  theme,
  onToggleTheme,
}: {
  onEnter: (v: 'app' | 'login' | 'signup') => void;
  session: boolean;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={clsx(
        'sticky top-0 z-40 transition-all duration-300',
        scrolled
          ? 'border-b border-surface-border bg-white/80 backdrop-blur-xl dark:border-surface-dark-border dark:bg-surface-dark/80'
          : 'border-b border-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">Features</a>
          <a href="#models" className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">Models</a>
          <a href="#ecosystem" className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">Ecosystem</a>
          <a href="#pricing" className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">Pricing</a>
        </nav>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleTheme}
            className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-surface-dark-muted"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          {session ? (
            <Button size="sm" onClick={() => onEnter('app')} rightIcon={<ArrowRight className="h-4 w-4" />}>
              Open app
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => onEnter('login')} className="hidden sm:inline-flex">
                Sign in
              </Button>
              <Button size="sm" onClick={() => onEnter('signup')}>
                Get started
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

// ---------------- Hero ----------------

function Hero({ onEnter, session }: { onEnter: (v: 'app' | 'login' | 'signup') => void; session: boolean }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
      <div className="animate-slide-up">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-xs font-medium text-brand-700 dark:border-brand-900/50 dark:bg-brand-900/30 dark:text-brand-300">
          <Sparkles className="h-3.5 w-3.5" />
          One assistant. Every model. Built to grow.
        </div>

        <h1 className="font-display text-fluid-2xl font-extrabold leading-[1.05] tracking-tight text-slate-900 dark:text-white">
          Your intelligent assistant
          <br />
          for <span className="text-gradient">work &amp; life</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-fluid-base text-slate-600 dark:text-slate-300">
          Nexus AI brings the world's best models together in one premium workspace —
          streaming chat, document tools, and a growing ecosystem of specialized agents.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            size="lg"
            onClick={() => onEnter(session ? 'app' : 'signup')}
            rightIcon={<ArrowRight className="h-5 w-5" />}
            className="w-full sm:w-auto"
          >
            {session ? 'Open Nexus AI' : 'Start chatting free'}
          </Button>
          <a
            href="#features"
            className="inline-flex h-12 items-center justify-center rounded-xl border border-surface-border bg-white px-6 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-surface-dark-border dark:bg-surface-dark-elevated dark:text-slate-200 dark:hover:bg-surface-dark-muted"
          >
            Explore features
          </a>
        </div>

        <p className="mt-5 text-xs text-slate-400">No credit card required · Free tier included</p>
      </div>

      {/* Product preview */}
      <div className="mx-auto mt-14 max-w-5xl animate-fade-in">
        <div className="gradient-border rounded-2xl border border-surface-border bg-white p-2 shadow-glow-lg dark:border-surface-dark-border dark:bg-surface-dark-elevated">
          <div className="overflow-hidden rounded-xl border border-surface-border bg-surface-subtle dark:border-surface-dark-border dark:bg-surface-dark">
            <PreviewChat />
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviewChat() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr]">
      {/* mini sidebar */}
      <div className="hidden border-r border-surface-border p-3 md:block dark:border-surface-dark-border">
        <div className="mb-3 flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 px-2.5 py-1.5 text-xs font-medium text-white">
          <Plus className="h-3 w-3" /> New chat
        </div>
        <div className="space-y-1">
          {['Product launch plan', 'Summarize Q3 report', 'React debugging help'].map((t, i) => (
            <div
              key={t}
              className={clsx(
                'flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs',
                i === 0 ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200' : 'text-slate-500',
              )}
            >
              <MessageSquare className="h-3 w-3 shrink-0" />
              <span className="truncate">{t}</span>
            </div>
          ))}
        </div>
      </div>
      {/* chat body */}
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600 dark:bg-surface-dark-muted dark:text-slate-300">YOU</span>
          <div className="rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-2.5 text-sm text-slate-700 dark:bg-surface-dark-muted dark:text-slate-200">
            Summarize this quarter's revenue growth in 3 bullet points.
          </div>
        </div>
        <div className="flex gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-white">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <div className="rounded-2xl rounded-tl-sm border border-surface-border bg-white px-4 py-2.5 text-sm text-slate-700 dark:border-surface-dark-border dark:bg-surface-dark-elevated dark:text-slate-200">
            <p>Here's the summary:</p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
              <li>Revenue grew <strong>28% YoY</strong>, driven by enterprise expansion.</li>
              <li>Net retention hit <strong>118%</strong>, up from 104% last quarter.</li>
              <li>APAC became the fastest region, contributing 31% of new ARR.</li>
            </ul>
            <span className="mt-2 inline-block h-3.5 w-1.5 animate-blink bg-brand-500 align-middle" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- Model strip ----------------

function ModelStrip() {
  const models = ['Llama 3.3', 'Gemini 2.5', 'Claude 3.5', 'GPT-4o', 'Kimi K2', 'GPT-OSS'];
  return (
    <section id="models" className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-center text-xs font-semibold uppercase tracking-widest text-slate-400">
        Powered by the best models from Groq, Google &amp; OpenRouter
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
        {models.map((m) => (
          <span key={m} className="font-display text-sm font-bold text-slate-400 dark:text-slate-500">
            {m}
          </span>
        ))}
      </div>
    </section>
  );
}

// ---------------- Features ----------------

const FEATURES = [
  { icon: MessageSquare, title: 'Streaming AI chat', desc: 'Real-time responses from your favorite models, with markdown, code blocks, and copy-on-hover.' },
  { icon: FileText, title: 'Document tools', desc: 'Upload PDFs and instantly get concise summaries and the key points that matter.' },
  { icon: Search, title: 'Search everything', desc: 'Find any conversation by title or message content — across your entire history.' },
  { icon: Download, title: 'Export &amp; share', desc: 'Download chats as Markdown, text, or JSON. Copy a response in one click.' },
  { icon: Brain, title: 'Persistent memory', desc: 'Your chats, preferences, and default model are saved and synced across sessions.' },
  { icon: Shield, title: 'Private by design', desc: 'Row-level security isolates your data. Your conversations stay yours.' },
];

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <SectionHeading
        eyebrow="Features"
        title="Everything you need in one workspace"
        description="A premium chat experience plus the productivity tools that make AI actually useful."
      />
      <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <div
              key={f.title}
              className="group rounded-2xl border border-surface-border bg-white p-6 transition-all hover:-translate-y-1 hover:border-brand-300 hover:shadow-card dark:border-surface-dark-border dark:bg-surface-dark-elevated dark:hover:border-brand-700 dark:hover:shadow-card-dark"
            >
              <span className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-50 to-accent-50 text-brand-600 transition-transform group-hover:scale-110 dark:from-brand-900/30 dark:to-accent-900/30 dark:text-brand-300">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">{f.title}</h3>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400" dangerouslySetInnerHTML={{ __html: f.desc }} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------- Ecosystem ----------------

const ECOSYSTEM = [
  { icon: GraduationCap, label: 'Study Mode', soon: true },
  { icon: Code2, label: 'Coding Assistant', soon: true },
  { icon: Bot, label: 'Business Assistant', soon: true },
  { icon: Search, label: 'SEO Assistant', soon: true },
  { icon: ImageIcon, label: 'Image Analysis', soon: true },
  { icon: Mic, label: 'Voice Assistant', soon: true },
  { icon: Bot, label: 'AI Website Builder', soon: true },
  { icon: Zap, label: 'Automation Agents', soon: true },
];

function Ecosystem() {
  return (
    <section id="ecosystem" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <SectionHeading
        eyebrow="Roadmap"
        title="A platform that grows with you"
        description="Nexus AI is built modular from day one. These specialized agents are on the way."
      />
      <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {ECOSYSTEM.map((e) => {
          const Icon = e.icon;
          return (
            <div
              key={e.label}
              className="relative overflow-hidden rounded-2xl border border-surface-border bg-white p-5 text-center dark:border-surface-dark-border dark:bg-surface-dark-elevated"
            >
              {e.soon && (
                <span className="absolute right-2 top-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-400 dark:bg-surface-dark-muted">
                  Soon
                </span>
              )}
              <span className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
                <Icon className="h-5 w-5" />
              </span>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{e.label}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------- Pricing ----------------

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    desc: 'For getting started and casual use.',
    features: ['Unlimited chats', 'All available models', 'Document summaries', 'Light & dark mode', '1 user'],
    cta: 'Start free',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$20',
    period: 'per month',
    desc: 'For power users and professionals.',
    features: ['Everything in Free', 'Priority response speed', 'Unlimited document uploads', 'Custom system prompts', 'Chat export & sharing', 'Email support'],
    cta: 'Go Pro',
    highlight: true,
  },
  {
    name: 'Team',
    price: '$49',
    period: 'per seat / mo',
    desc: 'For teams building with AI together.',
    features: ['Everything in Pro', 'Shared workspaces', 'Role-based access', 'Usage analytics', 'SSO & audit logs', 'Priority support'],
    cta: 'Contact us',
    highlight: false,
  },
];

function Pricing({ onEnter }: { onEnter: (v: 'app' | 'login' | 'signup') => void }) {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <SectionHeading
        eyebrow="Pricing"
        title="Simple, transparent pricing"
        description="Start free. Upgrade when you need more. Cancel anytime."
      />
      <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
        {PLANS.map((p) => (
          <div
            key={p.name}
            className={clsx(
              'relative flex flex-col rounded-2xl border p-6 transition-all',
              p.highlight
                ? 'border-brand-400 bg-white shadow-glow-lg dark:bg-surface-dark-elevated'
                : 'border-surface-border bg-white dark:border-surface-dark-border dark:bg-surface-dark-elevated',
            )}
          >
            {p.highlight && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 px-3 py-1 text-xs font-semibold text-white shadow-glow">
                Most popular
              </span>
            )}
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{p.name}</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{p.desc}</p>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="font-display text-3xl font-bold text-slate-900 dark:text-white">{p.price}</span>
              <span className="text-sm text-slate-400">/ {p.period}</span>
            </div>
            <ul className="mt-6 flex-1 space-y-2.5">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success-500" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Button
                fullWidth
                variant={p.highlight ? 'primary' : 'outline'}
                onClick={() => onEnter('signup')}
              >
                {p.cta}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------- CTA ----------------

function CTA({ onEnter, session }: { onEnter: (v: 'app' | 'login' | 'signup') => void; session: boolean }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-500 to-accent-600 px-6 py-14 text-center shadow-glow-lg sm:px-12">
        <div className="absolute inset-0 bg-grid-dark opacity-20" />
        <div className="relative">
          <div className="mx-auto mb-4 flex items-center justify-center gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} className="h-4 w-4 fill-white text-white" />
            ))}
          </div>
          <h2 className="font-display text-fluid-xl font-bold text-white">
            Ready to think faster?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-brand-50">
            Join Nexus AI and put a world-class assistant in your pocket today.
          </p>
          <div className="mt-8">
            <Button
              size="lg"
              variant="secondary"
              onClick={() => onEnter(session ? 'app' : 'signup')}
              rightIcon={<ArrowRight className="h-5 w-5" />}
              className="bg-white text-brand-700 hover:bg-brand-50"
            >
              {session ? 'Open Nexus AI' : 'Create your free account'}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------- Footer ----------------

function Footer() {
  return (
    <footer className="border-t border-surface-border dark:border-surface-dark-border">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <Logo />
            <p className="max-w-xs text-center text-xs text-slate-400 sm:text-left">
              The intelligent assistant platform for personal and business productivity.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
            <a href="#features" className="hover:text-slate-800 dark:hover:text-slate-200">Features</a>
            <a href="#pricing" className="hover:text-slate-800 dark:hover:text-slate-200">Pricing</a>
            <a href="#ecosystem" className="hover:text-slate-800 dark:hover:text-slate-200">Roadmap</a>
            <a href="/app" className="hover:text-slate-800 dark:hover:text-slate-200">Open app</a>
          </div>
        </div>
        <div className="mt-8 border-t border-surface-border pt-6 text-center text-xs text-slate-400 dark:border-surface-dark-border">
          © {new Date().getFullYear()} Nexus AI. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

// ---------------- shared ----------------

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400">{eyebrow}</p>
      <h2 className="mt-2 font-display text-fluid-xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h2>
      <p className="mt-3 text-fluid-sm text-slate-600 dark:text-slate-300">{description}</p>
    </div>
  );
}
