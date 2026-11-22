/**
 * Icon set.
 *
 * Hand-tuned inline SVGs on a 24x24 grid with currentColor strokes, so the
 * interface never depends on emoji fonts or external icon packages.
 */

import type { ReactElement } from 'react';

export type IconName =
  | 'play'
  | 'pause'
  | 'home'
  | 'retry'
  | 'next'
  | 'lock'
  | 'star'
  | 'coin'
  | 'gem'
  | 'crate'
  | 'relic'
  | 'bomb'
  | 'mine'
  | 'barrel'
  | 'meteor'
  | 'shield'
  | 'magnet'
  | 'slow'
  | 'double'
  | 'wallet'
  | 'check'
  | 'close'
  | 'volume'
  | 'trophy'
  | 'user'
  | 'settings'
  | 'help'
  | 'flag'
  | 'crown'
  | 'globe'
  | 'bolt'
  | 'arrowLeft'
  | 'arrowRight'
  | 'jump'
  | 'sparkle'
  | 'info'
  | 'target'
  | 'clock'
  | 'heart'
  | 'chevronRight';

interface Props {
  name: IconName;
  size?: number;
  className?: string;
  filled?: boolean;
}

const PATHS: Record<IconName, ReactElement> = {
  play: <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />,
  pause: (
    <>
      <rect x="7" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" stroke="none" />
      <rect x="13.4" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  home: <path d="M4 11.5 12 4l8 7.5M6.5 10.5V20h11v-9.5" />,
  retry: (
    <>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 4v4.5h-4.5" />
    </>
  ),
  next: (
    <>
      <path d="M5 12h13" />
      <path d="M13 6.5 19 12l-6 5.5" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.4" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  star: <path d="m12 3.6 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 10l6.1-.9z" />,
  coin: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.6v8.8M9.6 10h4a1.7 1.7 0 0 1 0 3.4h-3.2a1.7 1.7 0 0 0 0 3.4h4" />
    </>
  ),
  gem: (
    <>
      <path d="M6 4h12l3 5.2L12 21 3 9.2z" />
      <path d="M3 9.2h18M9 4l3 5.2L15 4M12 9.2V21" />
    </>
  ),
  crate: (
    <>
      <rect x="3.5" y="6.5" width="17" height="13" rx="2" />
      <path d="M3.5 11h17M12 6.5V19.5" />
    </>
  ),
  relic: (
    <>
      <path d="m12 3 3 4.6 5.4.8-3.9 3.9.9 5.5L12 15.2 6.6 17.8l.9-5.5L3.6 8.4 9 7.6z" />
      <circle cx="12" cy="11.6" r="1.9" fill="currentColor" stroke="none" />
    </>
  ),
  bomb: (
    <>
      <circle cx="11" cy="14.4" r="6.4" />
      <path d="M15.6 9.2 18 6.8M17.4 4.2l2.4 2.4M14.6 5.4l2.2 2.2" />
      <path d="M8.6 12.6c.6-1.2 1.8-2 3-2.1" />
    </>
  ),
  mine: (
    <>
      <circle cx="12" cy="13" r="5.6" />
      <path d="M12 3.2v3.6M12 19.2v2.2M3.4 13h3.2M17.4 13h3.2M6.2 6.6l2.3 2.3M15.5 17l2.3 2.3M17.8 6.6 15.5 8.9M8.5 17l-2.3 2.3" />
      <circle cx="12" cy="13" r="1.7" fill="currentColor" stroke="none" />
    </>
  ),
  barrel: (
    <>
      <rect x="6.5" y="4" width="11" height="16" rx="3.2" />
      <path d="M6.5 9.2h11M6.5 14.8h11M10 4v16M14 4v16" />
    </>
  ),
  meteor: (
    <>
      <circle cx="14.4" cy="10.6" r="5.6" />
      <path d="M9.4 8.4 4.2 5.6M8.6 12.2 3 12.6M11.2 15 6.4 18.2" />
      <circle cx="13" cy="9.4" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  shield: <path d="M12 3.2 19 6v5.6c0 4.3-2.9 7.6-7 9.2-4.1-1.6-7-4.9-7-9.2V6z" />,
  magnet: (
    <>
      <path d="M6 4v8a6 6 0 0 0 12 0V4" />
      <path d="M6 8.5h4M14 8.5h4" />
    </>
  ),
  slow: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.6V12l3 2.2" />
    </>
  ),
  double: (
    <>
      <path d="m8.4 8.4 3.6 3.6 3.6-3.6M8.4 14.4 12 18l3.6-3.6" />
      <path d="M4.5 12h15" opacity=".45" />
    </>
  ),
  wallet: (
    <>
      <rect x="3.2" y="6.4" width="17.6" height="12.4" rx="3" />
      <path d="M3.2 10.4h17.6" />
      <circle cx="16.6" cy="14.6" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  check: <path d="m5 12.8 4.4 4.4L19 6.8" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  volume: (
    <>
      <path d="M4.5 9.5h3.2L12 5.6v12.8L7.7 14.5H4.5z" />
      <path d="M15.6 9.2a4 4 0 0 1 0 5.6M18.2 6.6a7.6 7.6 0 0 1 0 10.8" />
    </>
  ),
  trophy: (
    <>
      <path d="M7 4h10v4.6a5 5 0 0 1-10 0z" />
      <path d="M7 5.4H4.4v1.8A3.4 3.4 0 0 0 7.8 10.6M17 5.4h2.6v1.8a3.4 3.4 0 0 1-3.4 3.4" />
      <path d="M12 13.6V17M8.4 20h7.2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.4" r="3.9" />
      <path d="M4.8 20c.6-3.6 3.5-5.6 7.2-5.6s6.6 2 7.2 5.6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M12 3.4v2.2M12 18.4v2.2M4.6 12H2.4M21.6 12h-2.2M6.6 6.6 5 5M19 19l-1.6-1.6M17.4 6.6 19 5M5 19l1.6-1.6" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M9.6 9.4a2.5 2.5 0 1 1 3.7 2.3c-.8.5-1.3 1-1.3 2" />
      <circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none" />
    </>
  ),
  flag: (
    <>
      <path d="M6 3.6v17" />
      <path d="M6 4.8h10.4l-1.8 3.6 1.8 3.6H6z" />
    </>
  ),
  crown: <path d="M4 8.4 8 12l4-5.4 4 5.4 4-3.6-1.6 9.2H5.6z" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M3.6 12h16.8M12 3.6c2.4 2.4 3.6 5.2 3.6 8.4s-1.2 6-3.6 8.4c-2.4-2.4-3.6-5.2-3.6-8.4S9.6 6 12 3.6z" />
    </>
  ),
  bolt: <path d="M13.4 3 6.6 13.2h4.4L10 21l7.4-10.6h-4.6z" />,
  arrowLeft: (
    <>
      <path d="M19 12H5" />
      <path d="M10.5 6.5 5 12l5.5 5.5" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M5 12h14" />
      <path d="M13.5 6.5 19 12l-5.5 5.5" />
    </>
  ),
  jump: (
    <>
      <path d="M12 20V5" />
      <path d="m6.6 10.4 5.4-5.4 5.4 5.4" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3.4 13.5 9 19 10.5 13.5 12 12 17.6 10.5 12 5 10.5 10.5 9z" />
      <path d="M18 16.4 18.7 19l2.3.7-2.3.7-.7 2.6-.7-2.6-2.3-.7 2.3-.7z" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 11v5.4" />
      <circle cx="12" cy="8" r=".95" fill="currentColor" stroke="none" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <circle cx="12" cy="12" r="4.4" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.2V12l3.4 2.2" />
    </>
  ),
  heart: (
    <path d="M12 20s-7.4-4.4-7.4-9.2A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.4 3.2C19.4 15.6 12 20 12 20z" />
  ),
  chevronRight: <path d="m9.5 6 6 6-6 6" />,
};

export function Icon({ name, size = 20, className, filled = false }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name] ?? PATHS.info}
    </svg>
  );
}
