import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
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

const USER_ID = 'local-nexus-user';

const GUEST_USER = {
  id: USER_ID,
  email: 'user@nexus.local',
  user_metadata: { full_name: 'Nexus User' },
} as unknown as User;

const GUEST_SESSION = {
  user: GUEST_USER,
} as unknown as Session;

const DEFAULT_PREFERENCES: UserPreferences = {
  user_id: USER_ID,
  default_provider: 'groq',
  default_model: 'groq/llama-3.3-70b-versatile',
  system_prompt: '',
  temperature: 0.7,
  theme: 'system',
  updated_at: new Date().toISOString(),
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session] = useState<Session | null>(GUEST_SESSION);
  const [user] = useState<User | null>(GUEST_USER);
  const [profile] = useState<Profile | null>({
    id: USER_ID,
    full_name: 'Nexus User',
    avatar_url: null,
    bio: null,
    updated_at: new Date().toISOString(),
  });

  const [preferences, setPreferences] =
    useState<UserPreferences>(DEFAULT_PREFERENCES);

  const refreshProfile = useCallback(async () => {}, []);

  const refreshPreferences = useCallback(async () => {
    setPreferences((prev) => ({
      ...prev,
      updated_at: new Date().toISOString(),
    }));
  }, []);

  const signUp = useCallback(
    async () => ({
      error: 'Account creation is disabled in local mode.',
    }),
    [],
  );

  const signIn = useCallback(
    async () => ({
      error: null,
    }),
    [],
  );

  const signOut = useCallback(async () => {
    // Local mode intentionally keeps the app available without authentication.
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile,
      preferences,
      loading: false,
      signUp,
      signIn,
      signOut,
      refreshProfile,
      refreshPreferences,
    }),
    [
      session,
      user,
      profile,
      preferences,
      signUp,
      signIn,
      signOut,
      refreshProfile,
      refreshPreferences,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return ctx;
}
