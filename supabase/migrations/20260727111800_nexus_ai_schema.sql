/*
# Nexus AI — initial schema (multi-user, auth-scoped)

## Overview
Creates the data layer for Nexus AI, a multi-user AI assistant platform.
Every row is owned by a single authenticated user and isolated via Row Level
Security. No data is shared between users.

## New Tables
1. `profiles` — public user profile data (display name, avatar url, bio)
   - `id` uuid PK, references `auth.users.id` ON DELETE CASCADE
   - `full_name` text (nullable)
   - `avatar_url` text (nullable)
   - `bio` text (nullable)
   - `updated_at` timestamptz
   A profile row is auto-created on signup via a trigger.

2. `user_preferences` — one row per user, per-account settings
   - `user_id` uuid PK, references `auth.users.id` ON DELETE CASCADE
   - `default_model` text (e.g. 'groq/llama-3.3-70b')
   - `default_provider` text ('groq' | 'gemini' | 'openrouter')
   - `system_prompt` text (custom assistant persona)
   - `temperature` numeric (0.0–1.0, default 0.7)
   - `theme` text ('light' | 'dark' | 'system', default 'system')
   - `updated_at` timestamptz

3. `chats` — conversation sessions
   - `id` uuid PK
   - `user_id` uuid, defaults to auth.uid(), references auth.users ON DELETE CASCADE
   - `title` text (auto-generated from first message, editable)
   - `provider` text, `model` text — snapshot of model used
   - `pinned` boolean default false
   - `created_at`, `updated_at` timestamptz

4. `messages` — individual messages within a chat
   - `id` uuid PK
   - `chat_id` uuid FK -> chats ON DELETE CASCADE
   - `user_id` uuid, defaults to auth.uid(), references auth.users ON DELETE CASCADE
   - `role` text ('user' | 'assistant' | 'system')
   - `content` text
   - `provider` text, `model` text (nullable, set for assistant msgs)
   - `tokens` int (nullable)
   - `created_at` timestamptz
   Child of chats; scoped via parent ownership.

5. `documents` — uploaded PDFs / extracted text for summarization
   - `id` uuid PK
   - `user_id` uuid, defaults to auth.uid(), references auth.users ON DELETE CASCADE
   - `filename` text
   - `storage_path` text (Supabase Storage object path)
   - `char_count` int
   - `summary` text (nullable, populated after summarize)
   - `key_points` jsonb (nullable, array of strings)
   - `status` text ('uploaded' | 'processing' | 'ready' | 'failed')
   - `created_at` timestamptz

## Security (RLS)
- RLS enabled on all 5 tables.
- `profiles`: a user can read & update only their own profile.
- `user_preferences`: a user fully manages only their own row.
- `chats`, `messages`, `documents`: full CRUD scoped to the owning user via
  `auth.uid() = user_id`.
- All policies scoped `TO authenticated` because this app has a sign-in screen.

## Helper functions / triggers
- `handle_new_user()` trigger: after a new auth.users row is inserted, insert a
  matching `profiles` row and a default `user_preferences` row.
- `update_updated_at()` trigger: bumps `updated_at` on row update.

## Important notes
1. Owner columns default to `auth.uid()` so client inserts that omit `user_id`
   still satisfy the WITH CHECK policy.
2. The handle_new_user trigger runs with SECURITY DEFINER so it can write the
   profile/preferences rows on behalf of a freshly created user.
3. Indexes added on foreign keys and frequently-filtered columns.
*/

-- ========== profiles ==========
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  bio text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ========== user_preferences ==========
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_provider text NOT NULL DEFAULT 'groq',
  default_model text NOT NULL DEFAULT 'groq/llama-3.3-70b-versatile',
  system_prompt text NOT NULL DEFAULT '',
  temperature numeric NOT NULL DEFAULT 0.7,
  theme text NOT NULL DEFAULT 'system',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_preferences" ON user_preferences;
CREATE POLICY "select_own_preferences" ON user_preferences FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_preferences" ON user_preferences;
CREATE POLICY "insert_own_preferences" ON user_preferences FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_preferences" ON user_preferences;
CREATE POLICY "update_own_preferences" ON user_preferences FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ========== chats ==========
CREATE TABLE IF NOT EXISTS chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New chat',
  provider text NOT NULL DEFAULT 'groq',
  model text NOT NULL DEFAULT 'groq/llama-3.3-70b-versatile',
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_chats" ON chats;
CREATE POLICY "select_own_chats" ON chats FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_chats" ON chats;
CREATE POLICY "insert_own_chats" ON chats FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_chats" ON chats;
CREATE POLICY "update_own_chats" ON chats FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_chats" ON chats;
CREATE POLICY "delete_own_chats" ON chats FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at DESC);

-- ========== messages ==========
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL DEFAULT '',
  provider text,
  model text,
  tokens integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_messages" ON messages;
CREATE POLICY "select_own_messages" ON messages FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_messages" ON messages;
CREATE POLICY "insert_own_messages" ON messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_messages" ON messages;
CREATE POLICY "update_own_messages" ON messages FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_messages" ON messages;
CREATE POLICY "delete_own_messages" ON messages FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- ========== documents ==========
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  filename text NOT NULL,
  storage_path text NOT NULL,
  char_count integer NOT NULL DEFAULT 0,
  summary text,
  key_points jsonb,
  status text NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded','processing','ready','failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_documents" ON documents;
CREATE POLICY "select_own_documents" ON documents FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_documents" ON documents;
CREATE POLICY "insert_own_documents" ON documents FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_documents" ON documents;
CREATE POLICY "update_own_documents" ON documents FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_documents" ON documents;
CREATE POLICY "delete_own_documents" ON documents FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);

-- ========== updated_at trigger ==========
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER trg_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_chats_updated_at ON chats;
CREATE TRIGGER trg_chats_updated_at
  BEFORE UPDATE ON chats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ========== new-user trigger (auto profile + preferences) ==========
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ========== Storage bucket (best-effort) ==========
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'documents') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('documents', 'documents', false);
  END IF;
END $$;
