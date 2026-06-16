import type { Resource } from './resources';

interface Props {
  source?: Resource['source'];
}

/**
 * Tiny mark indicating where a resource lives — GitHub repo, YouTube,
 * docs site, blog, or npm. Sits in the corner of each ResourceCard.
 */
export function SourceIcon({ source }: Props) {
  switch (source) {
    case 'github':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-label="GitHub">
          <title>GitHub</title>
          <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.4 7.86 10.93.58.1.79-.25.79-.55v-2c-3.2.7-3.87-1.36-3.87-1.36-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.75 1.18 1.75 1.18 1.02 1.75 2.68 1.24 3.33.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.16 1.18a11 11 0 0 1 5.75 0c2.2-1.49 3.16-1.18 3.16-1.18.62 1.58.23 2.75.11 3.04.74.81 1.18 1.84 1.18 3.1 0 4.43-2.7 5.4-5.27 5.69.41.36.78 1.05.78 2.13v3.16c0 .31.21.66.79.55C20.21 21.4 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
        </svg>
      );
    case 'youtube':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-label="YouTube">
          <title>YouTube</title>
          <path d="M21.6 7.2a2.5 2.5 0 0 0-1.7-1.8C18.3 5 12 5 12 5s-6.3 0-7.9.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12c0 1.7.1 3.3.4 4.8a2.5 2.5 0 0 0 1.7 1.8C5.7 19 12 19 12 19s6.3 0 7.9-.4a2.5 2.5 0 0 0 1.7-1.8c.3-1.5.4-3.1.4-4.8 0-1.7-.1-3.3-.4-4.8zM10 15.2V8.8L15.5 12 10 15.2z" />
        </svg>
      );
    case 'npm':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-label="npm">
          <title>npm</title>
          <path d="M3 3h18v18h-9V6H8v15H3z" />
        </svg>
      );
    case 'blog':
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-label="Article"
        >
          <title>Article</title>
          <rect x="4" y="4" width="16" height="16" rx="1.5" />
          <line x1="8" y1="9" x2="16" y2="9" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="13" y2="17" />
        </svg>
      );
    case 'docs':
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-label="Docs"
        >
          <title>Docs</title>
          <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z" />
          <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z" />
          <path d="M12 4v16" />
        </svg>
      );
    default:
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-label="Link"
        >
          <title>Link</title>
          <path d="M9 14l6-6M11 7h5a3 3 0 0 1 0 6h-2M13 17H8a3 3 0 0 1 0-6h2" />
        </svg>
      );
  }
}
