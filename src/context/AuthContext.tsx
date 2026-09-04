import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile, UserPreferences } from '@/lib/database.types';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  preferences: UserPreferences | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshPreferences: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const DEFAULT_PREFERENCES: UserPreferences = {
  user_id: '',
  default_provider: 'groq',
  default_model: 'groq/llama-3.3-70b-versatile',
  system_prompt: '',
  temperature: 0.7,
  theme: 'system',
  updated_at: new Date().toISOString(),
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      return;
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    setProfile((data as Profile | null) ?? null);
  }, [user?.id]);

  const refreshPreferences = useCallback(async () => {
    if (!user?.id) {
      setPreferences(null);
      return;
    }
    const { data } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    setPreferences((data as UserPreferences | null) ?? { ...DEFAULT_PREFERENCES, user_id: user.id });
  }, [user?.id]);

  // Bootstrap session + subscribe to auth changes.
  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    })();

    // onAuthStateChange callback runs synchronously; do async work in an IIFE
    // to avoid the deadlock documented in the bolt-database skill.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      (async () => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (!newSession) {
          setProfile(null);
          setPreferences(null);
        }
      })();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Load profile + preferences whenever the user changes.
  useEffect(() => {
    if (!user) {
      setProfile(null);
      setPreferences(null);
      return;
    }
    (async () => {
      await Promise.all([refreshProfile(), refreshPreferences()]);
    })();
  }, [user, refreshProfile, refreshPreferences]);

  const signUp = useCallback(
    async (email: string, password: string, fullName?: string) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName ?? '' } },
      });
      if (error) return { error: friendlyAuthError(error) };
      // signUp may return a session immediately (email confirmation off).
      if (data.session) {
        setSession(data.session);
        setUser(data.user);
      }
      return { error: null };
    },
    [],
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: friendlyAuthError(error) };
    setSession(data.session);
    setUser(data.user);
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setPreferences(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile,
      preferences,
      loading,
      signUp,
      signIn,
      signOut,
      refreshProfile,
      refreshPreferences,
    }),
    [session, user, profile, preferences, loading, signUp, signIn, signOut, refreshProfile, refreshPreferences],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function friendlyAuthError(err: { message?: string; status?: number }): string {
  const msg = err.message ?? '';
  if (msg.includes('Invalid login credentials')) return 'Incorrect email or password.';
  if (msg.includes('User already registered')) return 'An account with this email already exists.';
  if (msg.includes('Password should be at least')) return 'Password must be at least 6 characters.';
  if (msg.includes('rate limit') || msg.includes('too many')) return 'Too many attempts. Please wait a moment and try again.';
  if (msg.includes('Email')) return 'Please enter a valid email address.';
  return msg || 'Something went wrong. Please try again.';
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
