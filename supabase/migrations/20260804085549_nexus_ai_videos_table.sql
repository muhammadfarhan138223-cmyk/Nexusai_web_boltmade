/*
# Create videos table + video-inputs storage bucket

## Overview
Adds video generation support powered by Replicate. Users upload an image,
the server sends it to Replicate's Stable Video Diffusion model, and the
resulting MP4 URL is stored here. Each user sees only their own videos.

## New Tables
1. `videos` — generated video records
   - `id` uuid PK
   - `user_id` uuid, defaults to auth.uid(), references auth.users ON DELETE CASCADE
   - `input_image_path` text — Supabase Storage path of the source image
   - `input_image_url` text — public/signed URL of the source image (for Replicate)
   - `prompt` text (nullable) — optional text prompt for text-to-video models
   - `status` text — 'queued' | 'processing' | 'succeeded' | 'failed'
   - `prediction_id` text (nullable) — Replicate prediction ID for polling
   - `video_url` text (nullable) — resulting MP4 URL from Replicate
   - `error` text (nullable) — error message if generation failed
   - `model` text — which Replicate model was used
   - `created_at` timestamptz

## Storage
- Creates a `video-inputs` bucket (private) for user-uploaded source images.
- Policies allow each authenticated user to manage only their own folder.

## Security (RLS)
- RLS enabled on `videos`.
- Owner-scoped CRUD via auth.uid() = user_id, TO authenticated.
- Storage policies scoped to user_id folder prefix.
*/

CREATE TABLE IF NOT EXISTS videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  input_image_path text,
  input_image_url text,
  prompt text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','succeeded','failed')),
  prediction_id text,
  video_url text,
  error text,
  model text NOT NULL DEFAULT 'stability-ai/stable-video-diffusion',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_videos" ON videos;
CREATE POLICY "select_own_videos" ON videos FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_videos" ON videos;
CREATE POLICY "insert_own_videos" ON videos FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_videos" ON videos;
CREATE POLICY "update_own_videos" ON videos FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_videos" ON videos;
CREATE POLICY "delete_own_videos" ON videos FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);

-- ========== Storage bucket for video input images ==========
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'video-inputs') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('video-inputs', 'video-inputs', false);
  END IF;
END $$;

DROP POLICY IF EXISTS "read_own_video_inputs" ON storage.objects;
CREATE POLICY "read_own_video_inputs" ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'video-inputs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "insert_own_video_inputs" ON storage.objects;
CREATE POLICY "insert_own_video_inputs" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'video-inputs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "update_own_video_inputs" ON storage.objects;
CREATE POLICY "update_own_video_inputs" ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'video-inputs' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'video-inputs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "delete_own_video_inputs" ON storage.objects;
CREATE POLICY "delete_own_video_inputs" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'video-inputs' AND (storage.foldername(name))[1] = auth.uid()::text);
