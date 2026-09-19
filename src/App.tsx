import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';
import { LandingPage } from '@/components/landing/LandingPage';
import { AuthForm } from '@/components/auth/AuthForm';
import { AppLayout } from '@/components/app/AppLayout';
import { LogoMark } from '@/components/ui/Logo';

type Route = 'landing' | 'login' | 'signup' | 'app';

function parseRoute(): Route {
  const path = window.location.pathname.replace(/\/+$/, '');
  if (path === '/login') return 'login';
  if (path === '/signup') return 'signup';
  if (path === '/app' || path.startsWith('/app/')) return 'app';
  return 'landing';
}

function parseChatId(): string | null {
  const params = new URLSearchParams(window.location.search);
  const c = params.get('c');
  return c && /^[0-9a-f-]+$/i.test(c) ? c : null;
}

function navigate(route: Route, opts?: { replace?: boolean }) {
  const path = route === 'landing' ? '/' : `/${route}`;
  if (opts?.replace) window.history.replaceState({ route }, '', path);
  else window.history.pushState({ route }, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function Shell() {
  const { session, loading } = useAuth();
  const [route, setRoute] = useState<Route>(parseRoute);
  const [initialChatId, setInitialChatId] = useState<string | null>(parseChatId);

  // Sync with browser back/forward.
  useEffect(() => {
    const onPop = () => {
      setRoute(parseRoute());
      setInitialChatId(parseChatId());
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Auth gating: if a user lands on /app while logged out, redirect to login.
  // If logged in and on an auth screen, send them to the app.
  useEffect(() => {
    if (loading) return;
    if (route === 'app' && !session) {
      navigate('login', { replace: true });
    } else if ((route === 'login' || route === 'signup') && session) {
      navigate('app', { replace: true });
    }
  }, [route, session, loading]);

  const enter = (next: 'app' | 'login' | 'signup') => {
    if (next === 'app' && !session) {
      navigate('login');
      return;
    }
    navigate(next);
  };

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-surface-subtle dark:bg-surface-dark">
        <div className="flex flex-col items-center gap-3">
          <LogoMark size={48} className="animate-float" />
          <div className="h-1 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-surface-dark-border">
            <div className="h-full w-1/2 animate-shimmer rounded-full bg-gradient-to-r from-brand-400 to-accent-400" />
          </div>
        </div>
      </div>
    );
  }

  if (route === 'login' || route === 'signup') {
    return <AuthForm mode={route} onSwitch={(m) => navigate(m)} />;
  }

  if (route === 'app' && session) {
    return <AppLayout initialChatId={initialChatId} />;
  }

  return <LandingPage onEnter={enter} />;
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <Shell />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
