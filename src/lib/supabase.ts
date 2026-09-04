import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // Surface a clear error at load time rather than silent failures later.
  // eslint-disable-next-line no-console
  console.error('Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
}

// Untyped client: we cast row shapes at the data-access layer (lib/chats.ts,
// context/AuthContext.tsx) using the row types from lib/database.types.ts.
// This keeps query payloads flexible without fighting Supabase v2's generated
// generic typing, while still giving the UI fully-typed rows.
export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'nexus-auth',
  },
});
