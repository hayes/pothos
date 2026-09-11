'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from '@/components/Providers';

export function LandingPlayground() {
  const { resolvedTheme } = useTheme();
  const cleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanupRef.current?.(), []);

  const connectScrolling = (iframe: HTMLIFrameElement) => {
    cleanupRef.current?.();
    const child = iframe.contentWindow;
    const document = iframe.contentDocument;
    if (!child || !document) {
      return;
    }
    const onWheel = (event: WheelEvent) => {
      // Preserve browser zoom and normal scrolling in an editor the visitor is using.
      if (event.ctrlKey) {
        return;
      }
      const target = event.target as Element | null;
      const editor = target?.closest?.('.monaco-editor');
      if (editor && document.activeElement && editor.contains(document.activeElement)) {
        return;
      }
      // A wheel gesture over an unfocused embed belongs to the surrounding page.
      // Only intercept wheel events, leaving hover, selection and clicks intact.
      event.preventDefault();
      event.stopImmediatePropagation();
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      window.scrollBy({
        left: event.deltaX * scale,
        top: event.deltaY * scale,
        behavior: 'instant',
      });
    };
    child.addEventListener('wheel', onWheel, { capture: true, passive: false });
    cleanupRef.current = () => child.removeEventListener('wheel', onWheel, true);
  };

  return (
    <figure className="m-0 rounded-xl border border-bm-line overflow-hidden bg-bm-editor-bg">
      <iframe
        onLoad={(event) => connectScrolling(event.currentTarget)}
        src={`/playground?embed=1&sidebar=0&theme=${encodeURIComponent(resolvedTheme)}`}
        aria-describedby="landing-playground-caption"
        title="Pothos playground: edit a schema and run GraphQL queries"
        className="block w-full h-[900px] md:h-[680px] border-0"
        allow="clipboard-write"
      />
      <figcaption
        id="landing-playground-caption"
        className="border-t border-bm-line bg-bm-surface px-4 py-3 text-[13px] leading-relaxed text-bm-ink-muted"
      >
        Change the greeting, add an argument, or write another field. The editor checks your
        TypeScript as you work; run the query to see what your API returns.
      </figcaption>
    </figure>
  );
}
