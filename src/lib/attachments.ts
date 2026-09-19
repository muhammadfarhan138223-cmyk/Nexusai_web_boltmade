// src/lib/attachments.ts
import type { Attachment, AttachmentType } from './database.types';

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

// Local mode stores attachments as inline base64 data URLs (in the chat's
// localStorage record), so keep limits modest to avoid bloating storage.
const MAX_SIZE: Record<AttachmentType, number> = {
  image: 8 * 1024 * 1024, // 8MB
  audio: 15 * 1024 * 1024, // 15MB
  video: 15 * 1024 * 1024, // 15MB
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

function fileToDataUrlInternal(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/**
 * "Upload" a file — in local mode this just reads it into a base64 data URL,
 * which is stored inline with the message (no backend/storage bucket).
 */
export async function uploadAttachment(file: File, type: AttachmentType): Promise<Attachment> {
  const url = await fileToDataUrlInternal(file);
  return {
    type,
    url,
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
  return fileToDataUrlInternal(file);
}

/**
 * Attachments already store a data URL in local mode, so this is a
 * pass-through kept for API compatibility with callers.
 */
export async function attachmentToDataUrl(att: Attachment): Promise<string> {
  if (att.url.startsWith('data:')) return att.url;
  const res = await fetch(att.url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Could not read ${att.name}`));
    reader.readAsDataURL(blob);
  });
  }
