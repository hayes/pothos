import Link from 'next/link';
import { ThemedLogo } from './ThemedLogo';
import { ThemeToggle } from './ThemeToggle';

const NAV_LINKS = [
  { label: 'Docs', href: '/docs' },
  { label: 'Plugins', href: '/docs/plugins' },
  { label: 'Playground', href: '/playground' },
  { label: 'Sponsors', href: '/sponsors' },
  { label: 'Examples', href: 'https://github.com/hayes/pothos/tree/main/examples' },
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
          <ThemedLogo
            lightSrc="/assets/logo-name-light.svg"
            darkSrc="/assets/logo-name-dark.svg"
            alt="Pothos"
            width={130}
            height={32}
            priority
          />
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
          className="hidden sm:inline-flex items-center gap-1.5 text-[12px] text-bm-ink-muted hover:text-bm-ink transition-colors px-3 py-1.5 border border-bm-line rounded font-mono"
        >
          ★ 1.1k
        </a>

        <Link
          href="/docs"
          className="inline-flex items-center gap-1.5 rounded text-[14px] font-medium tracking-[0.01em] px-4 py-2 bg-bm-ink text-bm-bg hover:opacity-90 transition-opacity"
        >
          Get started
        </Link>
      </div>
    </header>
  );
}
