import { clsx } from '@/lib/clsx';

interface LogoProps {
  className?: string;
  withWordmark?: boolean;
  size?: number;
}

export function LogoMark({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={clsx('shrink-0', className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="nexus-logo-grad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#06b6d4" />
          <stop offset="0.5" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#nexus-logo-grad)" />
      <path
        d="M20 44V20l12 16 12-16v24"
        stroke="#fff"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="32" cy="32" r="3" fill="#fff" />
    </svg>
  );
}

export function Logo({ className, withWordmark = true, size = 32 }: LogoProps) {
  return (
    <span className={clsx('inline-flex items-center gap-2', className)}>
      <LogoMark size={size} />
      {withWordmark && (
        <span className="font-display text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
          Nexus<span className="text-gradient"> AI</span>
        </span>
      )}
    </span>
  );
}
