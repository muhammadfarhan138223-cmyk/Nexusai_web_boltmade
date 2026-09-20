// src/context/AuthContext.tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Profile, UserPreferences } from '@/lib/database.types';
import {
  getCurrentUser,
  localSignIn,
  localSignOut,
  localSignUp,
  updateLocalUser,
  type LocalUser,
} from '@/lib/localAuth';

// Minimal local stand-ins for the Supabase Session/User shapes — only the
// fields the app actually reads (id, email) are included.
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
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshPreferences: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function profileKey(userId: string) {
  return `nexus-profile-${userId}`;
}

function prefsKey(userId: string) {
  return `nexus-prefs-${userId}`;
}

function defaultPreferences(userId: string): UserPreferences {
  return {
    user_id: userId,
    default_provider: 'groq',
    default_model: 'groq/openai/gpt-oss-120b',
    system_prompt: '',
    temperature: 0.7,
    theme: 'system',
    updated_at: new Date().toISOString(),
  };
}

function loadProfile(user: LocalUser): Profile {
  try {
    const raw = localStorage.getItem(profileKey(user.id));
    if (raw) return JSON.parse(raw);
  } catch {
    // fall through to default
  }
  return {
    id: user.id,
    full_name: user.fullName,
    avatar_url: null,
    bio: null,
    updated_at: new Date().toISOString(),
  };
}

function loadPreferences(userId: string): UserPreferences {
  try {
    const raw = localStorage.getItem(prefsKey(userId));
    if (raw) return JSON.parse(raw);
  } catch {
    // fall through to default
  }
  return defaultPreferences(userId);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [localUser, setLocalUser] = useState<LocalUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const existing = getCurrentUser();
    if (existing) {
      setLocalUser(existing);
      setProfile(loadProfile(existing));
      setPreferences(loadPreferences(existing.id));
    }
    setLoading(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    setLocalUser((current) => {
      if (current) setProfile(loadProfile(current));
      return current;
    });
  }, []);

  const refreshPreferences = useCallback(async () => {
    setLocalUser((current) => {
      if (current) setPreferences(loadPreferences(current.id));
      return current;
    });
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName = '') => {
    const { user, error } = await localSignUp(email, password, fullName);
    if (error || !user) return { error };

    setLocalUser(user);
    setProfile(loadProfile(user));
    setPreferences(loadPreferences(user.id));
    return { error: null };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { user, error } = await localSignIn(email, password);
    if (error || !user) return { error };

    setLocalUser(user);
    setProfile(loadProfile(user));
    setPreferences(loadPreferences(user.id));
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    localSignOut();
    setLocalUser(null);
    setProfile(null);
    setPreferences(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session: localUser ? { user: { id: localUser.id, email: localUser.email } } : null,
      user: localUser ? { id: localUser.id, email: localUser.email } : null,
      profile,
      preferences,
      loading,
      signUp,
      signIn,
      signOut,
      refreshProfile,
      refreshPreferences,
    }),
    [localUser, profile, preferences, loading, signUp, signIn, signOut, refreshProfile, refreshPreferences],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Save profile fields for the given user directly to localStorage. */
export function saveLocalProfile(
  userId: string,
  updates: { full_name?: string; bio?: string; avatar_url?: string | null },
): Profile {
  const current = (() => {
    try {
      const raw = localStorage.getItem(profileKey(userId));
      if (raw) return JSON.parse(raw) as Profile;
    } catch {
      // ignore
    }
    return { id: userId, full_name: null, avatar_url: null, bio: null, updated_at: new Date().toISOString() };
  })();

  const next: Profile = { ...current, ...updates, updated_at: new Date().toISOString() };
  localStorage.setItem(profileKey(userId), JSON.stringify(next));
  if (typeof updates.full_name === 'string') updateLocalUser(userId, { fullName: updates.full_name });
  return next;
}

/** Save AI preferences for the given user directly to localStorage. */
export function saveLocalPreferences(userId: string, updates: Partial<UserPreferences>): UserPreferences {
  const current = loadPreferences(userId);
  const next: UserPreferences = { ...current, ...updates, user_id: userId, updated_at: new Date().toISOString() };
  localStorage.setItem(prefsKey(userId), JSON.stringify(next));
  return next;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return ctx;
}
