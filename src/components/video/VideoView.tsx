import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Upload,
  Video as VideoIcon,
  Trash2,
  Download,
  Loader2,
  Image as ImageIcon,
  Sparkles,
  AlertCircle,
  Film,
} from 'lucide-react';
import { Seo } from '@/components/ui/Seo';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { clsx } from '@/lib/clsx';
import {
  fetchVideos,
  createVideoRecord,
  updateVideoRecord,
  deleteVideoRecord,
  uploadVideoInputImage,
  startVideoPrediction,
  pollVideoPrediction,
} from '@/lib/videos';
import type { VideoRow } from '@/lib/database.types';

interface VideoViewProps {
  onBack: () => void;
}

const POLL_INTERVAL_MS = 4000;
const MAX_POLL_ATTEMPTS = 75; // 5 minutes at 4s intervals

export function VideoView({ onBack }: VideoViewProps) {
  const { user } = useAuth();
  const toast = useToast();
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<VideoRow | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadVideos = useCallback(async () => {
    try {
      const list = await fetchVideos();
      setVideos(list);
    } catch {
      // keep current
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  // Poll for in-progress videos
  useEffect(() => {
    const pending = videos.filter(
      (v) => v.status === 'queued' || v.status === 'processing',
    );
    if (pending.length === 0) return;

    let cancelled = false;
    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    async function pollOne(video: VideoRow, attempt: number) {
      if (cancelled || !video.prediction_id) return;
      if (attempt >= MAX_POLL_ATTEMPTS) {
        await updateVideoRecord(video.id, { status: 'failed', error: 'Timed out waiting for video.' });
        await loadVideos();
        return;
      }

      try {
        const result = await pollVideoPrediction(video.prediction_id);
        if (cancelled) return;

        if (result.status === 'succeeded' && result.videoUrl) {
          await updateVideoRecord(video.id, {
            status: 'succeeded',
            video_url: result.videoUrl,
            error: null,
          });
          await loadVideos();
          toast.success('Your video is ready!');
        } else if (result.status === 'failed' || result.error) {
          await updateVideoRecord(video.id, {
            status: 'failed',
            error: result.error ?? 'Generation failed.',
          });
          await loadVideos();
          toast.error('Video generation failed.');
        } else {
          const t = setTimeout(() => pollOne(video, attempt + 1), POLL_INTERVAL_MS);
          timers.set(video.id, t);
        }
      } catch {
        if (!cancelled) {
          const t = setTimeout(() => pollOne(video, attempt + 1), POLL_INTERVAL_MS);
          timers.set(video.id, t);
        }
      }
    }

    for (const v of pending) {
      pollOne(v, 0);
    }

    return () => {
      cancelled = true;
      timers.forEach((t) => clearTimeout(t));
    };
  }, [videos, loadVideos, toast]);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10 MB.');
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function onGenerate() {
    if (!selectedFile || !user) return;
    setGenerating(true);
    try {
      const { path, url } = await uploadVideoInputImage(selectedFile, user.id);
      const record = await createVideoRecord({
        input_image_path: path,
        input_image_url: url,
        status: 'queued',
        model: 'stability-ai/stable-video-diffusion',
      });

      const { predictionId } = await startVideoPrediction(url, 'stability-ai/stable-video-diffusion');
      await updateVideoRecord(record.id, {
        status: 'processing',
        prediction_id: predictionId,
      });

      await loadVideos();
      setSelectedFile(null);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success('Video generation started. This takes 1-3 minutes.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not start video generation.';
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  }

  async function onDelete() {
    if (!confirmDelete) return;
    try {
      await deleteVideoRecord(confirmDelete.id);
      await loadVideos();
      toast.success('Video deleted.');
    } catch {
      toast.error('Could not delete video.');
    } finally {
      setConfirmDelete(null);
    }
  }

  return (
    <div className="flex h-full flex-col bg-surface-subtle dark:bg-surface-dark">
      <Seo title="Video Studio" path="/app/video" />
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-surface-border bg-white/80 px-4 backdrop-blur-md dark:border-surface-dark-border dark:bg-surface-dark/80">
        <button
          onClick={onBack}
          className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-surface-dark-muted"
          aria-label="Back to chat"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold text-slate-800 dark:text-slate-100">Video Studio</h1>
        <span className="ml-1 flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
          <Sparkles className="h-3 w-3" />
          Powered by Replicate
        </span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl p-4 sm:p-8">
          {/* Upload + Generate card */}
          <div className="mb-8 rounded-2xl border border-surface-border bg-white p-6 shadow-card dark:border-surface-dark-border dark:bg-surface-dark-elevated dark:shadow-card-dark">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">Generate a video from an image</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Upload any image and AI will animate it into a short video clip. Best results with clear, well-lit photos.
            </p>

            <div
              className={clsx(
                'mt-5 cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors',
                previewUrl
                  ? 'border-brand-300 bg-brand-50/30 dark:border-brand-700 dark:bg-brand-900/10'
                  : 'border-slate-300 hover:border-brand-400 dark:border-surface-dark-border dark:hover:border-brand-600',
              )}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('image/')) {
                  setSelectedFile(file);
                  setPreviewUrl(URL.createObjectURL(file));
                }
              }}
            >
              {previewUrl ? (
                <div className="relative inline-block">
                  <img src={previewUrl} alt="Preview" className="max-h-48 rounded-lg shadow-md" />
                  <p className="mt-2 text-xs text-slate-500">{selectedFile?.name}</p>
                </div>
              ) : (
                <div className="py-4">
                  <Upload className="mx-auto mb-2 h-8 w-8 text-slate-400" />
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Click to upload or drag an image</p>
                  <p className="mt-1 text-xs text-slate-400">PNG, JPG, WebP up to 10 MB</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={onFileChange}
                className="hidden"
              />
            </div>

            <div className="mt-5 flex items-center gap-3">
              <Button
                onClick={onGenerate}
                disabled={!selectedFile || generating}
                loading={generating}
                leftIcon={!generating ? <Film className="h-4 w-4" /> : undefined}
              >
                {generating ? 'Starting generation…' : 'Generate video'}
              </Button>
              {selectedFile && !generating && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Generation takes 1-3 minutes. You can leave this page — your video will appear in the gallery below when ready.
            </p>
          </div>

          {/* Gallery */}
          <div>
            <h2 className="mb-4 font-display text-lg font-bold text-slate-900 dark:text-white">Your videos</h2>

            {loading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="skeleton h-48 rounded-2xl" />
                ))}
              </div>
            ) : videos.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 py-16 text-center dark:border-surface-dark-border">
                <VideoIcon className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No videos yet</p>
                <p className="mt-1 text-xs text-slate-400">Upload an image above to create your first AI video.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {videos.map((v) => (
                  <VideoCard key={v.id} video={v} onDelete={() => setConfirmDelete(v)} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete video?"
        description="This video and its source image will be permanently removed."
        confirmLabel="Delete"
        destructive
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function VideoCard({ video, onDelete }: { video: VideoRow; onDelete: () => void }) {
  const isProcessing = video.status === 'queued' || video.status === 'processing';
  const isFailed = video.status === 'failed';
  const isReady = video.status === 'succeeded' && video.video_url;

  return (
    <div className="group overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card transition-shadow hover:shadow-glow-lg dark:border-surface-dark-border dark:bg-surface-dark-elevated dark:shadow-card-dark">
      <div className="relative aspect-video bg-slate-100 dark:bg-surface-dark-muted">
        {isReady ? (
          <video
            src={video.video_url!}
            controls
            loop
            muted
            className="h-full w-full object-cover"
            poster={video.input_image_url ?? undefined}
          />
        ) : isProcessing ? (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {video.status === 'queued' ? 'Queued…' : 'Generating…'}
            </p>
            <div className="mt-1 h-1 w-20 overflow-hidden rounded-full bg-slate-200 dark:bg-surface-dark-border">
              <div className="h-full w-1/2 animate-shimmer rounded-full bg-gradient-to-r from-brand-400 to-accent-400" />
            </div>
          </div>
        ) : isFailed ? (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <AlertCircle className="h-8 w-8 text-error-400" />
            <p className="px-4 text-center text-xs text-error-500">{video.error ?? 'Generation failed'}</p>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <ImageIcon className="h-8 w-8 text-slate-300 dark:text-slate-600" />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between p-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-600 dark:text-slate-300">
            {new Date(video.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </p>
          <p className="text-[11px] text-slate-400">
            {isReady ? 'Ready' : isProcessing ? 'In progress' : isFailed ? 'Failed' : '—'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {isReady && (
            <a
              href={video.video_url!}
              download
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-surface-dark-muted dark:hover:text-slate-200"
              aria-label="Download video"
              title="Download"
            >
              <Download className="h-4 w-4" />
            </a>
          )}
          <button
            onClick={onDelete}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-900/20 dark:hover:text-error-400"
            aria-label="Delete video"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
