/*
# Multimodal file uploads + daily usage tracking

## Overview
Adds support for multimodal file attachments (images, audio, video) in chat
messages, and a daily usage tracking system that enforces Gemini free-tier
limits (1,500 RPD, 300 images/day, 50 videos/day, 15 RPM).

## New Tables
### daily_usage
Tracks per-user daily API usage counters that reset at midnight.
- `user_id` (uuid, not null, defaults to auth.uid()) — owner
- `date` (date, not null, defaults to today) — the calendar day this row covers
- `request_count` (integer, not null, default 0) — total API requests today
- `image_count` (integer, not null, default 0) — image uploads today
- `video_count` (integer, not null, default 0) — video uploads today
- `last_request_at` (timestamptz, nullable) — timestamp of most recent request (for RPM rate-limiting)
- `recent_request_times` (jsonb, nullable) — array of recent request timestamps for RPM calculation
- `created_at` / `updated_at` (timestamptz)

Primary key is (user_id, date) so there is exactly one row per user per day.

## Modified Tables
### messages
- Added `attachments` column: jsonb, nullable. Stores an array of attachment
  metadata objects: { type: 'image'|'audio'|'video', url: string, name: string,
  mime: string, size: number }. The url is a public/signed Supabase Storage URL.

## New Storage Bucket
### chat-attachments
A private bucket for user-uploaded images, audio, and video files.
Storage policies scope read/write/delete to each user's own prefix
(`user_id/filename`), same pattern as the existing `documents` bucket.

## Security
- RLS enabled on `daily_usage`; owner-scoped CRUD via auth.uid().
- Storage policies on `chat-attachments` bucket scoped to auth.uid() prefix.
- The `recent_request_times` jsonb array is capped at ~30 entries client-side
  to keep rows small (only needed for a 2-minute RPM sliding window).
*/

-- ── daily_usage table ──
CREATE TABLE IF NOT EXISTS daily_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  request_count integer NOT NULL DEFAULT 0,
  image_count integer NOT NULL DEFAULT 0,
  video_count integer NOT NULL DEFAULT 0,
  last_request_at timestamptz,
  recent_request_times jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE daily_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_daily_usage" ON daily_usage;
CREATE POLICY "select_own_daily_usage" ON daily_usage FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_daily_usage" ON daily_usage;
CREATE POLICY "insert_own_daily_usage" ON daily_usage FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_daily_usage" ON daily_usage;
CREATE POLICY "update_own_daily_usage" ON daily_usage FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_daily_usage" ON daily_usage;
CREATE POLICY "delete_own_daily_usage" ON daily_usage FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_daily_usage_user_date ON daily_usage(user_id, date);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_daily_usage_updated_at ON daily_usage;
CREATE TRIGGER trg_daily_usage_updated_at
  BEFORE UPDATE ON daily_usage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── messages.attachments column ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'attachments'
  ) THEN
    ALTER TABLE messages ADD COLUMN attachments jsonb;
  END IF;
END $$;

-- ── chat-attachments storage bucket ──
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for chat-attachments (same pattern as documents bucket)
DROP POLICY IF EXISTS "read_own_chat_attachments" ON storage.objects;
CREATE POLICY "read_own_chat_attachments" ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "insert_own_chat_attachments" ON storage.objects;
CREATE POLICY "insert_own_chat_attachments" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "update_own_chat_attachments" ON storage.objects;
CREATE POLICY "update_own_chat_attachments" ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "delete_own_chat_attachments" ON storage.objects;
CREATE POLICY "delete_own_chat_attachments" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);