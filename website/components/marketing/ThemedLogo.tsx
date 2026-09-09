'use client';

import Image, { type ImageProps } from 'next/image';
import { useEffect, useState } from 'react';
import { useTheme } from '../Providers';

interface Props extends Omit<ImageProps, 'src' | 'alt'> {
  /** Light-mode SVG (or generic). */
  lightSrc: string;
  /** Dark-mode SVG. Falls back to `lightSrc` when unspecified. */
  darkSrc?: string;
  alt: string;
}

/**
 * Renders a theme-aware logo. The auto-adapting SVGs we use (with
 * `prefers-color-scheme` media queries inside them) only re-evaluate
 * their styles when the document re-fetches — they don't react to our
 * `.dark` class flip. To work around that, we:
 *   1. Pick the explicit light/dark variant when available.
 *   2. Bump the React `key` on theme change so the underlying `<img>`
 *      remounts and re-fetches the SVG against the current
 *      color-scheme.
 *
 * Before mount, render the light variant — both server and client
 * agree on that, so hydration stays clean.
 */
export function ThemedLogo({ lightSrc, darkSrc, alt, ...rest }: Props) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === 'dark';
  const src = isDark && darkSrc ? darkSrc : lightSrc;
  return <Image key={isDark ? 'dark' : 'light'} src={src} alt={alt} {...rest} />;
}
