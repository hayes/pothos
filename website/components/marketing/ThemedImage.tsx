'use client';

import { useEffect, useState } from 'react';
import { useTheme } from '../Providers';

interface Props extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
}

/**
 * Plain `<img>` that remounts when the site's resolved theme changes,
 * forcing the browser to re-fetch the SVG so its internal
 * `prefers-color-scheme` media queries re-evaluate. Use for external
 * theme-adaptive SVGs we don't have light/dark variants for (sponsor
 * logos, etc.).
 */
export function ThemedImage({ src, alt, ...rest }: Props) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const themeKey = mounted ? resolvedTheme : 'initial';
  return (
    // biome-ignore lint/performance/noImgElement: the source is an
    // external SVG with embedded prefers-color-scheme styles — Next
    // Image's optimizer would strip the inline <style> block.
    <img key={themeKey} src={src} alt={alt} {...rest} />
  );
}
