import { clsx } from '@/lib/clsx';

interface AvatarProps {
  name?: string | null;
  url?: string | null;
  size?: number;
  className?: string;
}

const PALETTE = [
  'from-cyan-500 to-blue-500',
  'from-emerald-500 to-teal-500',
  'from-rose-500 to-pink-500',
  'from-amber-500 to-orange-500',
  'from-indigo-500 to-violet-500',
];

function initials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function colorFor(name?: string | null): string {
  if (!name) return PALETTE[0];
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return PALETTE[sum % PALETTE.length];
}

export function Avatar({ name, url, size = 36, className }: AvatarProps) {
  if (url) {
    return (
      <img
        src={url}
        alt={name ?? 'Avatar'}
        width={size}
        height={size}
        className={clsx('rounded-full object-cover', className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className={clsx(
        'inline-grid place-items-center rounded-full bg-gradient-to-br font-semibold text-white',
        colorFor(name),
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials(name)}
    </span>
  );
}
