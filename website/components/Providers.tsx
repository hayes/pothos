'use client';

import { NextProvider } from 'fumadocs-core/framework/next';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  /** The user's preference (may be `system`). */
  theme: ThemeMode;
  /** What's actually applied — never `system`. */
  resolvedTheme: 'light' | 'dark';
  setTheme: (next: ThemeMode) => void;
}

const STORAGE_KEY = 'pothos-theme';
const ThemeContext = createContext<ThemeContextValue | null>(null);

function readSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readSavedTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {}
  return 'system';
}

function applyClass(resolved: 'light' | 'dark') {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.classList.toggle('light', resolved === 'light');
  root.style.colorScheme = resolved;
}

/**
 * Site-wide theme provider — small enough that we don't need the
 * next-themes dep, and (importantly) doesn't inject a `<script>` inside
 * a React component, which Next.js 16 dev mode escalated into a hard
 * error. The matching pre-hydration script lives in `app/layout.tsx`'s
 * `<head>` so the right `dark`/`light` class is on `<html>` before paint.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  // Hydrate from localStorage / matchMedia once on mount.
  useEffect(() => {
    const initial = readSavedTheme();
    setThemeState(initial);
    const resolved = initial === 'system' ? readSystemTheme() : initial;
    setResolvedTheme(resolved);
    applyClass(resolved);
  }, []);

  // React to system-preference changes when the user is on `system`.
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const next = mq.matches ? 'dark' : 'light';
      setResolvedTheme(next);
      applyClass(next);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = (next: ThemeMode) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {}
    const resolved = next === 'system' ? readSystemTheme() : next;
    setResolvedTheme(resolved);
    applyClass(resolved);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      <NextProvider>{children}</NextProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Tolerant fallback for components that may render in tests without the
    // provider — keep them rendering as if the theme hadn't loaded yet.
    return { theme: 'system', resolvedTheme: 'light', setTheme: () => {} };
  }
  return ctx;
}
