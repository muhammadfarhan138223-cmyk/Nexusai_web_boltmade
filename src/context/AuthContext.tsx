import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { Session, User } from '@supabase/supabase-js';
import type { Profile, UserPreferences } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export interface LocalSessionUser {
  id: string;
  email: string;
}

export interface LocalSession {
  user: LocalSessionUser;
}

interface AuthContextValue {
  session: LocalSession | null;
  user: LocalSessionUser | null;
  profile: Profile | null;
  preferences: UserPreferences | null;
  loading: boolean;

  signUp: (
    email: string,
    password: string,
    fullName?: string
  ) => Promise<{
    error: string | null;
    needsEmailConfirmation?: boolean;
  }>;

  signIn: (
    email: string,
    password: string
  ) => Promise<{
    error: string | null;
  }>;

  signInWithProvider: (
    provider: 'google' | 'github' | 'facebook'
  ) => Promise<{
    error: string | null;
  }>;

  resetPassword: (
    email: string
  ) => Promise<{
    error: string | null;
  }>;

  signOut: () => Promise<void>;

  refreshProfile: () => Promise<void>;
  refreshPreferences: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(
  undefined
);

function profileKey(userId: string) {
  return `nexus-profile-${userId}`;
}

function prefsKey(userId: string) {
  return `nexus-prefs-${userId}`;
}

const DEFAULT_SYSTEM_PROMPT = `You are Nexus AI, a helpful, friendly, and knowledgeable assistant. Be clear, concise, and accurate. If you are unsure about something, say so instead of guessing.

Your goal is to answer users naturally, accurately, helpfully, and conversationally. Your responses should feel like a high-quality modern AI assistant: clear, intelligent, practical, context-aware, and human-friendly.`;

function defaultPreferences(userId: string): UserPreferences {
  return {
    user_id: userId,
    default_provider: 'groq',
    default_model: 'groq/openai/gpt-oss-120b',
    system_prompt: DEFAULT_SYSTEM_PROMPT,
    temperature: 0.7,
    theme: 'system',
    updated_at: new Date().toISOString(),
  };
}

function loadProfile(user: User): Profile {
  try {
    const raw = localStorage.getItem(profileKey(user.id));

    if (raw) {
      return JSON.parse(raw) as Profile;
    }
  } catch {
    // Ignore invalid local profile.
  }

  return {
    id: user.id,
    full_name:
      (user.user_metadata?.full_name as string | undefined) ||
      (user.user_metadata?.name as string | undefined) ||
      null,
    avatar_url:
      (user.user_metadata?.avatar_url as string | undefined) ||
      null,
    bio: null,
    updated_at: new Date().toISOString(),
  };
}

function loadPreferences(userId: string): UserPreferences {
  try {
    const raw = localStorage.getItem(prefsKey(userId));

    if (raw) {
      return JSON.parse(raw) as UserPreferences;
    }
  } catch {
    // Ignore invalid preferences.
  }

  return defaultPreferences(userId);
}

function toSession(
  session: Session | null
): LocalSession | null {
  if (!session?.user) return null;

  return {
    user: {
      id: session.user.id,
      email: session.user.email ?? '',
    },
  };
}

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [supabaseSession, setSupabaseSession] =
    useState<Session | null>(null);

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [preferences, setPreferences] =
    useState<UserPreferences | null>(null);

  const [loading, setLoading] = useState(true);

  const hydrateUser = useCallback(
    (user: User | null) => {
      if (!user) {
        setProfile(null);
        setPreferences(null);
        return;
      }

      setProfile(loadProfile(user));
      setPreferences(loadPreferences(user.id));
    },
    []
  );

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;

      setSupabaseSession(data.session);
      hydrateUser(data.session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSupabaseSession(session);
        hydrateUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [hydrateUser]);

  const refreshProfile = useCallback(async () => {
    if (!supabaseSession?.user) return;

    setProfile(loadProfile(supabaseSession.user));
  }, [supabaseSession]);

  const refreshPreferences = useCallback(async () => {
    if (!supabaseSession?.user) return;

    setPreferences(
      loadPreferences(supabaseSession.user.id)
    );
  }, [supabaseSession]);

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      fullName = ''
    ) => {
      const { data, error } =
        await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              name: fullName.trim(),
            },
          },
        });

      if (error) {
        return {
          error: error.message,
        };
      }

      if (data.user) {
        const profileData: Profile = {
          id: data.user.id,
          full_name: fullName.trim() || null,
          avatar_url: null,
          bio: null,
          updated_at: new Date().toISOString(),
        };

        localStorage.setItem(
          profileKey(data.user.id),
          JSON.stringify(profileData)
        );
      }

      return {
        error: null,
        needsEmailConfirmation: !data.session,
      };
    },
    []
  );

  const signIn = useCallback(
    async (
      email: string,
      password: string
    ) => {
      const { error } =
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

      return {
        error: error?.message ?? null,
      };
    },
    []
  );

  const signInWithProvider = useCallback(
    async (
      provider: 'google' | 'github' | 'facebook'
    ) => {
      const redirectTo =
        `${window.location.origin}/app`;

      const { error } =
        await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo,
          },
        });

      return {
        error: error?.message ?? null,
      };
    },
    []
  );

  const resetPassword = useCallback(
    async (email: string) => {
      const redirectTo =
        `${window.location.origin}/login`;

      const { error } =
        await supabase.auth.resetPasswordForEmail(
          email.trim().toLowerCase(),
          {
            redirectTo,
          }
        );

      return {
        error: error?.message ?? null,
      };
    },
    []
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();

    setSupabaseSession(null);
    setProfile(null);
    setPreferences(null);
  }, []);

  const session = toSession(supabaseSession);
  const user = session?.user ?? null;

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile,
      preferences,
      loading,
      signUp,
      signIn,
      signInWithProvider,
      resetPassword,
      signOut,
      refreshProfile,
      refreshPreferences,
    }),
    [
      session,
      user,
      profile,
      preferences,
      loading,
      signUp,
      signIn,
      signInWithProvider,
      resetPassword,
      signOut,
      refreshProfile,
      refreshPreferences,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function saveLocalProfile(
  userId: string,
  updates: {
    full_name?: string;
    bio?: string;
    avatar_url?: string | null;
  }
): Profile {
  const raw = localStorage.getItem(
    profileKey(userId)
  );

  const current: Profile = raw
    ? JSON.parse(raw)
    : {
        id: userId,
        full_name: null,
        avatar_url: null,
        bio: null,
        updated_at: new Date().toISOString(),
      };

  const next: Profile = {
    ...current,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  localStorage.setItem(
    profileKey(userId),
    JSON.stringify(next)
  );

  return next;
}

export function saveLocalPreferences(
  userId: string,
  updates: Partial<UserPreferences>
): UserPreferences {
  const raw = localStorage.getItem(
    prefsKey(userId)
  );

  const current = raw
    ? (JSON.parse(raw) as UserPreferences)
    : defaultPreferences(userId);

  const next: UserPreferences = {
    ...current,
    ...updates,
    user_id: userId,
    updated_at: new Date().toISOString(),
  };

  localStorage.setItem(
    prefsKey(userId),
    JSON.stringify(next)
  );

  return next;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error(
      'useAuth must be used within AuthProvider'
    );
  }

  return ctx;
}
