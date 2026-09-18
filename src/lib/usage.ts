// src/lib/usage.ts
import type { DailyUsage, AttachmentType } from './database.types';

const KEY = 'nexus-local-usage';

// Gemini free-tier limits
export const LIMITS = {
  DAILY_REQUESTS: 1500,
  DAILY_IMAGES: 300,
  DAILY_VIDEOS: 50,
  RPM: 15, // requests per minute
} as const;

export interface UsageState {
  requestCount: number;
  imageCount: number;
  videoCount: number;
  remainingRequests: number;
  remainingImages: number;
  remainingVideos: number;
  rpmCount: number; // requests in the last 60 seconds
  rpmExceeded: boolean;
  resetsAtMidnight: Date;
}

function getMidnight(): Date {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_STATE: UsageState = {
  requestCount: 0,
  imageCount: 0,
  videoCount: 0,
  remainingRequests: LIMITS.DAILY_REQUESTS,
  remainingImages: LIMITS.DAILY_IMAGES,
  remainingVideos: LIMITS.DAILY_VIDEOS,
  rpmCount: 0,
  rpmExceeded: false,
  resetsAtMidnight: getMidnight(),
};

function deriveState(row: DailyUsage): UsageState {
  const now = Date.now();
  const recent = (row.recent_request_times ?? []).filter(
    (ts) => now - new Date(ts).getTime() < 60_000,
  );
  return {
    requestCount: row.request_count,
    imageCount: row.image_count,
    videoCount: row.video_count,
    remainingRequests: Math.max(0, LIMITS.DAILY_REQUESTS - row.request_count),
    remainingImages: Math.max(0, LIMITS.DAILY_IMAGES - row.image_count),
    remainingVideos: Math.max(0, LIMITS.DAILY_VIDEOS - row.video_count),
    rpmCount: recent.length,
    rpmExceeded: recent.length >= LIMITS.RPM,
    resetsAtMidnight: getMidnight(),
  };
}

function readRow(): DailyUsage | null {
  try {
    const row = JSON.parse(localStorage.getItem(KEY) || 'null') as DailyUsage | null;
    if (row && row.date === todayStr()) return row;
    return null; // stale (previous day) — treat as no row yet
  } catch {
    return null;
  }
}

function writeRow(row: DailyUsage) {
  localStorage.setItem(KEY, JSON.stringify(row));
}

/**
 * Load today's usage row for the current user. Returns a normalized UsageState
 * with derived remaining counts and RPM status.
 */
export async function loadUsage(): Promise<UsageState> {
  const row = readRow();
  if (!row) return { ...EMPTY_STATE, resetsAtMidnight: getMidnight() };
  return deriveState(row);
}

/**
 * Increment usage after a request. Reads/writes the local daily-usage record
 * and appends the current timestamp to the recent-request-times array.
 * `attachments` is the list of file types attached to the request.
 */
export async function incrementUsage(
  attachments: AttachmentType[] = [],
): Promise<UsageState> {
  const now = new Date().toISOString();
  const today = todayStr();
  const row = readRow();

  const nowMs = Date.now();
  const recent = (row?.recent_request_times ?? []).filter(
    (ts) => nowMs - new Date(ts).getTime() < 60_000,
  );
  recent.push(now);
  const trimmedRecent = recent.slice(-30);

  const images = attachments.filter((a) => a === 'image').length;
  const videos = attachments.filter((a) => a === 'video').length;

  const next: DailyUsage = {
    id: row?.id ?? crypto.randomUUID(),
    user_id: 'local-nexus-user',
    date: today,
    request_count: (row?.request_count ?? 0) + 1,
    image_count: (row?.image_count ?? 0) + images,
    video_count: (row?.video_count ?? 0) + videos,
    last_request_at: now,
    recent_request_times: trimmedRecent,
    created_at: row?.created_at ?? now,
    updated_at: now,
  };

  writeRow(next);
  return deriveState(next);
}

/**
 * Check whether the user can send a request right now. Returns an error
 * message string if blocked, or null if allowed.
 */
export function checkUsage(
  state: UsageState,
  attachments: AttachmentType[] = [],
): string | null {
  if (state.remainingRequests <= 0) {
    return 'Daily free quota reached! Limit resets at midnight.';
  }
  if (state.rpmExceeded) {
    return "You're sending requests too fast. Gemini free tier allows 15 requests per minute. Please wait a moment.";
  }
  const images = attachments.filter((a) => a === 'image').length;
  const videos = attachments.filter((a) => a === 'video').length;
  if (images > 0 && state.remainingImages < images) {
    return 'Daily image upload limit reached! Limit resets at midnight.';
  }
  if (videos > 0 && state.remainingVideos < videos) {
    return 'Daily video upload limit reached! Limit resets at midnight.';
  }
  return null;
                  }
