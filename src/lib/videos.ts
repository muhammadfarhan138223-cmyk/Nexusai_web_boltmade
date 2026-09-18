// src/lib/videos.ts
import type { VideoRow, VideoInsert, VideoUpdate } from './database.types';

// Video generation used a Supabase Edge Function to proxy Replicate — that
// backend no longer exists. Records are still kept locally so the UI doesn't
// break, but starting a new generation will surface a clear error instead of
// silently failing.

const KEY = 'nexus-local-videos';

function read(): VideoRow[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

function write(rows: VideoRow[]) {
  localStorage.setItem(KEY, JSON.stringify(rows));
}

export async function fetchVideos(): Promise<VideoRow[]> {
  return read().sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function createVideoRecord(row: VideoInsert): Promise<VideoRow> {
  const now = new Date().toISOString();
  const record: VideoRow = {
    id: row.id ?? crypto.randomUUID(),
    user_id: 'local-nexus-user',
    input_image_path: row.input_image_path ?? null,
    input_image_url: row.input_image_url ?? null,
    prompt: row.prompt ?? null,
    status: row.status ?? 'queued',
    prediction_id: row.prediction_id ?? null,
    video_url: row.video_url ?? null,
    error: row.error ?? null,
    model: row.model ?? 'stability-ai/stable-video-diffusion',
    created_at: now,
  };
  write([record, ...read()]);
  return record;
}

export async function updateVideoRecord(id: string, updates: VideoUpdate): Promise<void> {
  write(read().map((v) => (v.id === id ? { ...v, ...updates } : v)));
}

export async function deleteVideoRecord(id: string): Promise<void> {
  write(read().filter((v) => v.id !== id));
}

export async function uploadVideoInputImage(file: File, _userId?: string): Promise<{ path: string; url: string }> {
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
  return { path: file.name, url };
}

export async function startVideoPrediction(
  _imageUrl?: string,
  _model?: string,
): Promise<{ predictionId: string; status: string }> {
  throw new Error(
    'Video generation needs a backend (Replicate) that is not configured. This feature is not available in local mode.',
  );
}

export async function pollVideoPrediction(
  _predictionId?: string,
): Promise<{ status: string; videoUrl: string | null; error: string | null }> {
  throw new Error('Video generation is not available in local mode.');
}
