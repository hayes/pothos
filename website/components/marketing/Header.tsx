'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CloseIcon } from '@/components/icons/CloseIcon';
import { GitHubIcon } from '@/components/icons/GitHubIcon';
import { HamburgerIcon } from '@/components/icons/HamburgerIcon';
import { DocsSearchProvider } from './DocsSearchProvider';
import { SearchButton } from './SearchButton';
import { ThemeToggle } from './ThemeToggle';
import { Wordmark } from './Wordmark';

const NAV_LINKS = [
  { label: 'Docs', href: '/docs' },
  { label: 'Plugins', href: '/docs/plugins' },
  { label: 'Playground', href: '/playground' },
  { label: 'Resources', href: '/resources' },
  { label: 'Sponsors', href: '/sponsors' },
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <DocsSearchProvider>
      <header className="bm-site-header sticky top-0 z-30 backdrop-blur-sm bg-bm-bg/85 border-b border-bm-line">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 md:px-10 min-h-[72px] flex items-center gap-2 sm:gap-4 xl:gap-8">
          <Link
            href="/"
            aria-label="Pothos GraphQL"
            className="flex items-center text-bm-ink hover:opacity-90 transition-opacity"
          >
            <Wordmark width={130} height={32} />
          </Link>

          {/* Switch to the drawer when enlarged text leaves too little room.
            The container query in global.css measures space in text units. */}
          <nav className="bm-header-desktop-nav hidden items-center gap-4 xl:gap-7 ml-2">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-base text-bm-ink-soft hover:text-bm-ink transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex-1" />

          <SearchButton variant="full" />

          <ThemeToggle />

          <a
            href="https://github.com/hayes/pothos"
            className="hidden sm:inline-flex items-center gap-2 text-sm text-bm-ink-soft hover:text-bm-ink hover:bg-bm-surface-alt transition-colors px-3 py-1.5 border border-bm-line rounded"
            title="Star Pothos on GitHub"
          >
            <GitHubIcon />
            <span className="font-mono text-sm">GitHub</span>
          </a>

          {/* Compact search trigger — visible below sm: where the labelled
            pill is hidden. */}
          <SearchButton variant="icon" />

          {/* Drawer trigger — paired with the desktop container breakpoint. */}
          <button
            type="button"
            onClick={() => setMobileOpen((s) => !s)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            aria-controls="marketing-mobile-nav"
            className="bm-header-menu inline-flex items-center justify-center size-9 rounded text-bm-ink-soft hover:text-bm-ink hover:bg-bm-surface-alt transition-colors"
          >
            {mobileOpen ? <CloseIcon /> : <HamburgerIcon />}
          </button>
        </div>

        {/* Drawer — also serves readers using enlarged text on desktop. */}
        {mobileOpen && (
          <nav
            id="marketing-mobile-nav"
            className="bm-header-mobile-nav border-t border-bm-line bg-bm-bg"
          >
            <div className="px-6 pt-3 pb-1 border-b border-bm-line-soft">
              <SearchButton variant="block" onActivate={() => setMobileOpen(false)} />
            </div>
            <ul className="flex flex-col px-6 py-3">
              {NAV_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="block py-2 text-base text-bm-ink-soft hover:text-bm-ink transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>
    </DocsSearchProvider>
  );
}
