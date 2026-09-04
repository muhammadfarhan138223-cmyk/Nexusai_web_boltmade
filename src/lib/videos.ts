import { supabase } from './supabase';
import type { VideoRow, VideoInsert, VideoUpdate } from './database.types';

export async function fetchVideos(): Promise<VideoRow[]> {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as VideoRow[];
}

export async function createVideoRecord(row: VideoInsert): Promise<VideoRow> {
  const { data, error } = await supabase
    .from('videos')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data as VideoRow;
}

export async function updateVideoRecord(id: string, updates: VideoUpdate): Promise<void> {
  const { error } = await supabase.from('videos').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteVideoRecord(id: string): Promise<void> {
  const { error } = await supabase.from('videos').delete().eq('id', id);
  if (error) throw error;
}

export async function uploadVideoInputImage(file: File, userId: string): Promise<{ path: string; url: string }> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from('video-inputs')
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (upErr) throw upErr;

  const { data } = supabase.storage.from('video-inputs').createSignedUrl(path, 3600);
  if (!data?.signedUrl) throw new Error('Could not create signed URL for image.');
  return { path, url: data.signedUrl };
}

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/replicate-video`;

async function callVideoFunction(body: unknown): Promise<Record<string, unknown>> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;

  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson?.error) detail = errJson.error;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }

  return await res.json();
}

export async function startVideoPrediction(
  imageUrl: string,
  model: string,
): Promise<{ predictionId: string; status: string }> {
  const result = await callVideoFunction({ action: 'create', imageUrl, model });
  const predictionId = (result as { predictionId?: string }).predictionId;
  const status = (result as { status?: string }).status;
  if (!predictionId) throw new Error('No prediction ID returned from server.');
  return { predictionId, status: status ?? 'starting' };
}

export async function pollVideoPrediction(
  predictionId: string,
): Promise<{ status: string; videoUrl: string | null; error: string | null }> {
  const result = await callVideoFunction({ action: 'poll', predictionId });
  return {
    status: (result as { status?: string }).status ?? 'unknown',
    videoUrl: (result as { videoUrl?: string | null }).videoUrl ?? null,
    error: (result as { error?: string | null }).error ?? null,
  };
}
