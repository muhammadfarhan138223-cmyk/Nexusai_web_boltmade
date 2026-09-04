import { useEffect, useState } from 'react';
import { Gauge, ImageIcon, Video, Zap, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import { clsx } from '@/lib/clsx';
import { type UsageState, LIMITS } from '@/lib/usage';

interface DailyUsageTrackerProps {
  usage: UsageState;
  collapsed?: boolean;
}

/**
 * A compact daily usage tracker showing remaining Gemini free-tier quota.
 * Shows progress bars for requests, images, and videos with a countdown
 * to midnight reset. Designed for placement in the sidebar footer or header.
 */
export function DailyUsageTracker({ usage, collapsed = false }: DailyUsageTrackerProps) {
  const [timeUntilReset, setTimeUntilReset] = useState(getTimeUntilReset(usage.resetsAtMidnight));

  // Live countdown to midnight
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeUntilReset(getTimeUntilReset(usage.resetsAtMidnight));
    }, 1000);
    return () => clearInterval(interval);
  }, [usage.resetsAtMidnight]);

  if (collapsed) {
    return <CompactBadge usage={usage} />;
  }

  const requestsPct = (usage.requestCount / LIMITS.DAILY_REQUESTS) * 100;
  const imagesPct = (usage.imageCount / LIMITS.DAILY_IMAGES) * 100;
  const videosPct = (usage.videoCount / LIMITS.DAILY_VIDEOS) * 100;

  return (
    <div className="rounded-xl border border-surface-border bg-white p-3 dark:border-surface-dark-border dark:bg-surface-dark-elevated">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Gauge className="h-4 w-4 text-brand-500" />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            Daily Quota
          </span>
        </div>
        <span className="flex items-center gap-1 text-[10px] text-slate-400" title="Resets at midnight local time">
          <Clock className="h-3 w-3" />
          {timeUntilReset}
        </span>
      </div>

      {/* RPM status badge */}
      <RpmBadge rpmCount={usage.rpmCount} exceeded={usage.rpmExceeded} />

      {/* Progress bars */}
      <div className="mt-2.5 space-y-2.5">
        <UsageBar
          icon={<Zap className="h-3.5 w-3.5" />}
          label="Requests"
          used={usage.requestCount}
          total={LIMITS.DAILY_REQUESTS}
          remaining={usage.remainingRequests}
          pct={requestsPct}
          color="brand"
        />
        <UsageBar
          icon={<ImageIcon className="h-3.5 w-3.5" />}
          label="Images"
          used={usage.imageCount}
          total={LIMITS.DAILY_IMAGES}
          remaining={usage.remainingImages}
          pct={imagesPct}
          color="emerald"
        />
        <UsageBar
          icon={<Video className="h-3.5 w-3.5" />}
          label="Videos"
          used={usage.videoCount}
          total={LIMITS.DAILY_VIDEOS}
          remaining={usage.remainingVideos}
          pct={videosPct}
          color="amber"
        />
      </div>

      {/* Limit reached warning */}
      {usage.remainingRequests <= 0 && (
        <div className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-error-50 px-2 py-1.5 text-[11px] text-error-600 dark:bg-error-900/20 dark:text-error-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Daily free quota reached! Limit resets at midnight.</span>
        </div>
      )}
    </div>
  );
}

function UsageBar({
  icon,
  label,
  used,
  total,
  remaining,
  pct,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  used: number;
  total: number;
  remaining: number;
  pct: number;
  color: 'brand' | 'emerald' | 'amber';
}) {
  const colorMap = {
    brand: {
      bar: 'bg-brand-500',
      text: 'text-brand-600 dark:text-brand-300',
      icon: 'text-brand-400',
      track: 'bg-brand-100 dark:bg-brand-900/30',
    },
    emerald: {
      bar: 'bg-emerald-500',
      text: 'text-emerald-600 dark:text-emerald-300',
      icon: 'text-emerald-400',
      track: 'bg-emerald-100 dark:bg-emerald-900/30',
    },
    amber: {
      bar: 'bg-amber-500',
      text: 'text-amber-600 dark:text-amber-300',
      icon: 'text-amber-400',
      track: 'bg-amber-100 dark:bg-amber-900/30',
    },
  };
  const c = colorMap[color];
  const isLow = remaining > 0 && remaining <= total * 0.1;
  const isDepleted = remaining <= 0;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className={clsx('flex items-center gap-1 font-medium', c.icon)}>
          {icon}
          <span className="text-slate-600 dark:text-slate-300">{label}</span>
        </span>
        <span className={clsx('font-semibold tabular-nums', isDepleted ? 'text-error-500' : isLow ? 'text-amber-500' : 'text-slate-500 dark:text-slate-400')}>
          {remaining} / {total}
        </span>
      </div>
      <div className={clsx('h-1.5 w-full overflow-hidden rounded-full', c.track)}>
        <div
          className={clsx('h-full rounded-full transition-all duration-500', isDepleted ? 'bg-error-500' : isLow ? 'bg-amber-500' : c.bar)}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

function RpmBadge({ rpmCount, exceeded }: { rpmCount: number; exceeded: boolean }) {
  return (
    <div className={clsx(
      'flex items-center justify-between rounded-lg px-2 py-1 text-[11px] font-medium',
      exceeded
        ? 'bg-error-50 text-error-600 dark:bg-error-900/20 dark:text-error-400'
        : 'bg-slate-50 text-slate-500 dark:bg-surface-dark-muted dark:text-slate-400',
    )}>
      <span className="flex items-center gap-1">
        <TrendingUp className="h-3.5 w-3.5" />
        Rate: {rpmCount} / {LIMITS.RPM} RPM
      </span>
      {exceeded && <span className="text-error-500">Slow down</span>}
    </div>
  );
}

function CompactBadge({ usage }: { usage: UsageState }) {
  const totalRemaining = usage.remainingRequests;
  const pct = (totalRemaining / LIMITS.DAILY_REQUESTS) * 100;
  const isLow = pct <= 10;

  return (
    <div
      className={clsx(
        'flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium',
        isLow
          ? 'bg-error-50 text-error-600 dark:bg-error-900/20 dark:text-error-400'
          : 'bg-slate-50 text-slate-500 dark:bg-surface-dark-muted dark:text-slate-400',
      )}
      title={`Requests: ${usage.remainingRequests}/${LIMITS.DAILY_REQUESTS} • Images: ${usage.remainingImages}/${LIMITS.DAILY_IMAGES} • Videos: ${usage.remainingVideos}/${LIMITS.DAILY_VIDEOS}`}
    >
      <Gauge className="h-3.5 w-3.5" />
      <span className="tabular-nums">{totalRemaining}/{LIMITS.DAILY_REQUESTS}</span>
    </div>
  );
}

function getTimeUntilReset(resetDate: Date): string {
  const now = new Date();
  const diff = resetDate.getTime() - now.getTime();
  if (diff <= 0) return 'Resets now';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
