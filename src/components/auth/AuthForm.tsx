import { useState, type FormEvent } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { Seo } from '@/components/ui/Seo';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { clsx } from '@/lib/clsx';

interface AuthFormProps {
  mode: 'login' | 'signup';
  onSwitch: (mode: 'login' | 'signup') => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthForm({ mode, onSwitch }: AuthFormProps) {
  const { signIn, signUp } = useAuth();
  const toast = useToast();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignup = mode === 'signup';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!EMAIL_RE.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (isSignup && fullName.trim().length < 1) {
      setError('Please enter your name.');
      return;
    }

    setLoading(true);
    try {
      if (isSignup) {
        const { error: err } = await signUp(email, password, fullName.trim());
        if (err) {
          setError(err);
        } else {
          toast.success('Welcome to Nexus AI!', 'Your account is ready.');
        }
      } else {
        const { error: err } = await signIn(email, password);
        if (err) setError(err);
        else toast.success('Welcome back!');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-surface-subtle dark:bg-surface-dark">
      <Seo title={isSignup ? 'Create your account' : 'Sign in'} path={isSignup ? '/signup' : '/login'} />
      {/* Ambient gradient backdrop */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-400/20 blur-3xl dark:bg-brand-600/20" />
        <div className="absolute -right-32 top-1/3 h-96 w-96 rounded-full bg-accent-400/20 blur-3xl dark:bg-accent-700/20" />
        <div className="absolute inset-0 bg-grid-light dark:bg-grid-dark opacity-60" />
      </div>

      <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center p-4">
        <div className="w-full max-w-md animate-slide-up">
          <div className="mb-8 flex flex-col items-center text-center">
            <a href="/" className="mb-6">
              <Logo size={44} />
            </a>
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:border-brand-900/50 dark:bg-brand-900/30 dark:text-brand-300">
              <Sparkles className="h-3.5 w-3.5" /> AI that grows with you
            </div>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              {isSignup ? 'Create your account' : 'Welcome back'}
            </h1>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              {isSignup ? 'Start chatting with AI in seconds.' : 'Sign in to continue to your assistant.'}
            </p>
          </div>

          <div className="rounded-2xl border border-surface-border bg-white/80 p-6 shadow-card backdrop-blur-xl dark:border-surface-dark-border dark:bg-surface-dark-elevated/80 dark:shadow-card-dark">
            <form onSubmit={onSubmit} className="space-y-4">
              {isSignup && (
                <Field label="Full name" htmlFor="name">
                  <input
                    id="name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ada Lovelace"
                    autoComplete="name"
                    className={inputClass}
                  />
                </Field>
              )}

              <Field label="Email" htmlFor="email">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className={clsx(inputClass, 'pl-9')}
                  />
                </div>
              </Field>

              <Field label="Password" htmlFor="password">
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isSignup ? 'At least 6 characters' : '••••••••'}
                    autoComplete={isSignup ? 'new-password' : 'current-password'}
                    className={clsx(inputClass, 'px-9')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>

              {error && (
                <div className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-700 dark:border-error-900/50 dark:bg-error-900/20 dark:text-error-400">
                  {error}
                </div>
              )}

              <Button type="submit" fullWidth size="lg" loading={loading} rightIcon={<ArrowRight className="h-4 w-4" />}>
                {isSignup ? 'Create account' : 'Sign in'}
              </Button>
            </form>

            <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
              {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                type="button"
                onClick={() => onSwitch(isSignup ? 'login' : 'signup')}
                className="font-medium text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
              >
                {isSignup ? 'Sign in' : 'Sign up'}
              </button>
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
            By continuing you agree to our Terms &amp; Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  'w-full rounded-xl border border-surface-border bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-surface-dark-border dark:bg-surface-dark-muted dark:text-slate-100 dark:placeholder:text-slate-500';

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      {children}
    </div>
  );
}
