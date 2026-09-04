import { supabase } from './supabase';
import type { Attachment, AttachmentType } from './database.types';

const BUCKET = 'chat-attachments';

const ACCEPTED: Record<AttachmentType, { mimes: string[]; exts: string[] }> = {
  image: {
    mimes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'],
    exts: ['.png', '.jpg', '.jpeg', '.webp', '.gif'],
  },
  audio: {
    mimes: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg'],
    exts: ['.mp3', '.wav', '.ogg'],
  },
  video: {
    mimes: ['video/mp4', 'video/webm', 'video/quicktime'],
    exts: ['.mp4', '.webm', '.mov'],
  },
};

const MAX_SIZE: Record<AttachmentType, number> = {
  image: 20 * 1024 * 1024, // 20MB
  audio: 50 * 1024 * 1024, // 50MB
  video: 100 * 1024 * 1024, // 100MB
};

export function classifyFile(file: File): AttachmentType | null {
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  for (const type of Object.keys(ACCEPTED) as AttachmentType[]) {
    const cfg = ACCEPTED[type];
    if (cfg.mimes.includes(mime)) return type;
    if (cfg.exts.some((ext) => name.endsWith(ext))) return type;
  }
  return null;
}

export function validateFile(file: File): { type: AttachmentType; error: string | null } {
  const type = classifyFile(file);
  if (!type) {
    return { type: 'image', error: `Unsupported file type: ${file.name}. Use PNG, JPG, MP3, WAV, or MP4.` };
  }
  if (file.size > MAX_SIZE[type]) {
    const maxMB = MAX_SIZE[type] / (1024 * 1024);
    return { type, error: `${file.name} is too large. Max ${maxMB}MB for ${type} files.` };
  }
  return { type, error: null };
}

export function getAcceptString(): string {
  const all = Object.values(ACCEPTED).flatMap((c) => [...c.mimes, ...c.exts]);
  return Array.from(new Set(all)).join(',');
}

/**
 * Upload a file to the chat-attachments bucket under the user's ID prefix.
 * Returns an Attachment object with a signed URL for rendering.
 */
export async function uploadAttachment(file: File, type: AttachmentType): Promise<Attachment> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('You must be signed in to upload files.');

  const ext = file.name.split('.').pop() ?? 'bin';
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || 'application/octet-stream' });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  // Create a signed URL valid for 1 hour.
  const { data: urlData, error: urlError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600);
  if (urlError || !urlData?.signedUrl) throw new Error('Could not generate file URL.');

  return {
    type,
    url: urlData.signedUrl,
    name: file.name,
    mime: file.type || 'application/octet-stream',
    size: file.size,
  };
}

/**
 * Upload multiple files, returning Attachment objects for successful uploads
 * and errors for failures.
 */
export async function uploadAttachments(
  files: File[],
): Promise<{ attachments: Attachment[]; errors: string[] }> {
  const attachments: Attachment[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const { type, error } = validateFile(file);
    if (error) {
      errors.push(error);
      continue;
    }
    try {
      const att = await uploadAttachment(file, type);
      attachments.push(att);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : `Failed to upload ${file.name}`);
    }
  }

  return { attachments, errors };
}

/**
 * Read a file as a base64 data URL for inline embedding in API requests.
 * Used for multimodal Gemini requests where the file content is sent inline.
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/**
 * Convert an Attachment (with a storage URL) to a data URL by fetching it.
 * For multimodal API calls we need the base64 inline data.
 */
export async function attachmentToDataUrl(att: Attachment): Promise<string> {
  const res = await fetch(att.url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Could not read ${att.name}`));
    reader.readAsDataURL(blob);
  });
}
