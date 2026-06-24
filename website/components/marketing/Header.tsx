'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CloseIcon } from '@/components/icons/CloseIcon';
import { GitHubIcon } from '@/components/icons/GitHubIcon';
import { HamburgerIcon } from '@/components/icons/HamburgerIcon';
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
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 backdrop-blur-sm bg-bm-bg/85 border-b border-bm-line">
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 h-[72px] flex items-center gap-8">
        <Link
          href="/"
          aria-label="Pothos GraphQL"
          className="flex items-center text-bm-ink hover:opacity-90 transition-opacity"
        >
          <Wordmark width={130} height={32} />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-7 ml-2">
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
          <GitHubIcon />
          <span className="font-mono text-[12px]">GitHub</span>
        </a>

        {/* Hamburger — visible below md: */}
        <button
          type="button"
          onClick={() => setMobileOpen((s) => !s)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          aria-controls="marketing-mobile-nav"
          className="md:hidden inline-flex items-center justify-center size-9 rounded text-bm-ink-soft hover:text-bm-ink hover:bg-bm-surface-alt transition-colors"
        >
          {mobileOpen ? <CloseIcon /> : <HamburgerIcon />}
        </button>
      </div>

      {/* Mobile nav drawer — collapses below md: */}
      {mobileOpen && (
        <nav id="marketing-mobile-nav" className="md:hidden border-t border-bm-line bg-bm-bg">
          <ul className="flex flex-col px-6 py-3">
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block py-2 text-[15px] text-bm-ink-soft hover:text-bm-ink transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
