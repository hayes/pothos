import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';
import { Wordmark } from './Wordmark';

const NAV_LINKS = [
  { label: 'Docs', href: '/docs' },
  { label: 'Plugins', href: '/plugins' },
  { label: 'Playground', href: '/playground' },
  { label: 'Resources', href: '/resources' },
  { label: 'Sponsors', href: '/sponsors' },
];

export function Header() {
  return (
    <header className="sticky top-0 z-30 backdrop-blur-sm bg-bm-bg/85 border-b border-bm-line">
      <div className="max-w-[1280px] mx-auto px-10 h-[72px] flex items-center gap-8">
        <Link
          href="/"
          aria-label="Pothos GraphQL"
          className="flex items-center text-bm-ink hover:opacity-90 transition-opacity"
        >
          <Wordmark width={130} height={32} />
        </Link>

        <nav className="flex items-center gap-7 ml-2">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-[14px] text-bm-ink-soft hover:text-bm-ink transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex-1" />

        <ThemeToggle />

        <a
          href="https://github.com/hayes/pothos"
          className="hidden sm:inline-flex items-center gap-2 text-[13px] text-bm-ink-soft hover:text-bm-ink hover:bg-bm-surface-alt transition-colors px-3 py-1.5 border border-bm-line rounded"
          title="Star Pothos on GitHub"
        >
          <GitHubMark />
          <span className="inline-flex items-center gap-1 font-mono text-[12px] text-bm-ink-muted">
            <StarMark />
            <span>1.1k</span>
          </span>
        </a>
      </div>
    </header>
  );
}

function GitHubMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.4 7.86 10.93.58.1.79-.25.79-.55v-2c-3.2.7-3.87-1.36-3.87-1.36-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.75 1.18 1.75 1.18 1.02 1.75 2.68 1.24 3.33.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.16 1.18a11 11 0 0 1 5.75 0c2.2-1.49 3.16-1.18 3.16-1.18.62 1.58.23 2.75.11 3.04.74.81 1.18 1.84 1.18 3.1 0 4.43-2.7 5.4-5.27 5.69.41.36.78 1.05.78 2.13v3.16c0 .31.21.66.79.55C20.21 21.4 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

function StarMark() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0l2.47 5 5.53.8-4 3.9.94 5.5L8 12.6l-4.94 2.6L4 9.7 0 5.8 5.53 5z" />
    </svg>
  );
}
