import { useState } from 'react';
import { ImageIcon, Music, Video, X, Download, Play } from 'lucide-react';
import type { Attachment } from '@/lib/database.types';

interface MessageAttachmentsProps {
  attachments: Attachment[];
}

/**
 * Renders image/audio/video attachments above the message text.
 * - Images: thumbnail grid with lightbox on click.
 * - Audio: inline <audio> player.
 * - Video: inline <video> player.
 */
export function MessageAttachments({ attachments }: MessageAttachmentsProps) {
  const [lightbox, setLightbox] = useState<Attachment | null>(null);

  const images = attachments.filter((a) => a.type === 'image');
  const audio = attachments.filter((a) => a.type === 'audio');
  const videos = attachments.filter((a) => a.type === 'video');

  return (
    <div className="mb-3 space-y-2">
      {/* Image grid */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setLightbox(img)}
              className="group relative overflow-hidden rounded-xl border border-surface-border bg-slate-50 transition-all hover:shadow-glow dark:border-surface-dark-border dark:bg-surface-dark-muted"
              style={{
                width: images.length === 1 ? '240px' : '120px',
                height: images.length === 1 ? '180px' : '120px',
              }}
            >
              <img
                src={img.url}
                alt={img.name}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/0 opacity-0 transition-all group-hover:bg-slate-900/30 group-hover:opacity-100">
                <Play className="h-6 w-6 text-white" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Audio players */}
      {audio.map((a, i) => (
        <div
          key={`audio-${i}`}
          className="flex items-center gap-3 rounded-xl border border-surface-border bg-slate-50 p-3 dark:border-surface-dark-border dark:bg-surface-dark-muted"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300">
            <Music className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="mb-1 truncate text-xs font-medium text-slate-600 dark:text-slate-300">
              {a.name}
            </p>
            <audio controls className="h-9 w-full" preload="metadata">
              <source src={a.url} type={a.mime} />
            </audio>
          </div>
        </div>
      ))}

      {/* Video players */}
      {videos.map((v, i) => (
        <div
          key={`video-${i}`}
          className="overflow-hidden rounded-xl border border-surface-border bg-slate-50 dark:border-surface-dark-border dark:bg-surface-dark-muted"
        >
          <video controls className="max-h-[360px] w-full" preload="metadata">
            <source src={v.url} type={v.mime} />
          </video>
          <div className="flex items-center gap-2 px-3 py-2">
            <Video className="h-4 w-4 shrink-0 text-amber-500" />
            <span className="truncate text-xs font-medium text-slate-600 dark:text-slate-300">
              {v.name}
            </span>
          </div>
        </div>
      ))}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            onClick={() => setLightbox(null)}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightbox.url}
            alt={lightbox.name}
            className="max-h-[85vh] max-w-[85vw] rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <a
            href={lightbox.url}
            download={lightbox.name}
            className="absolute bottom-4 flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="h-4 w-4" />
            Download
          </a>
        </div>
      )}
    </div>
  );
}
