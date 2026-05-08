'use client';

import { useEffect, useState } from 'react';
import { useTheme } from '@/components/Providers';

interface Props {
  className?: string;
}

/**
 * Small sun/moon toggle for the site header. Renders a stable
 * placeholder until `mounted` so the SSR'd output and the client's
 * first render match (next-themes can't know the resolved theme on
 * the server).
 */
export function ThemeToggle({ className = '' }: Props) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === 'dark' : false;
  const next = isDark ? 'light' : 'dark';
  const label = mounted ? `Switch to ${next} mode` : 'Toggle theme';

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={label}
      aria-pressed={isDark}
      title={label}
      className={`inline-flex items-center justify-center size-9 rounded text-bm-ink-soft hover:text-bm-ink hover:bg-bm-surface-alt transition-colors ${className}`}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* Render both glyphs and crossfade via opacity to avoid a layout
            blink when the icon swaps. */}
        <g style={{ opacity: mounted && isDark ? 0 : 1, transition: 'opacity 120ms' }}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </g>
        <g
          style={{
            opacity: mounted && isDark ? 1 : 0,
            transition: 'opacity 120ms',
            transform: 'translateX(-100%)',
          }}
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" transform="translate(24 0)" />
        </g>
      </svg>
    </button>
  );
}
