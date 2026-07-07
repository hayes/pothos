import './global.css';
import type { Metadata } from 'next';
import { Fraunces, Inter_Tight, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import { ReviewProviderDevOnly } from '@/review-plugin/src/client';
import { Providers } from '../components/Providers';

// Canonical origin for absolute URLs in metadata (OpenGraph, canonical
// links, sitemap, robots). Overridable per-environment so preview
// deployments can advertise their own origin.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pothos-graphql.dev';

const SITE_NAME = 'Pothos';
const DEFAULT_TITLE = 'Pothos GraphQL — Schemas that grow with your code';
const DEFAULT_DESCRIPTION =
  'A plugin-based GraphQL schema builder for TypeScript. Build your schema with the builder and your types flow into every resolver — no codegen, no decorators.';

// Site-wide metadata defaults. Every route inherits these unless it
// overrides a field:
//   - `title.template` gives docs/marketing pages a consistent
//     "<Page> — Pothos" suffix; `title.default` covers routes that set
//     no title of their own (e.g. /playground).
//   - `openGraph`/`twitter` are declared here WITHOUT a title or
//     description so Next auto-fills them per-page from each route's own
//     resolved title/description — while keeping the shared siteName,
//     type, and locale. This gives every shared link a preview card.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: '%s — Pothos',
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    url: SITE_URL,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary',
  },
};

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  axes: ['opsz'],
  display: 'swap',
});

const interTight = Inter_Tight({
  subsets: ['latin'],
  variable: '--font-inter-tight',
  weight: ['400', '500', '600'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  weight: ['400', '500'],
  display: 'swap',
});

// Pre-hydration theme bootstrap. Reads `pothos-theme` from localStorage
// (matching the storage key used by `components/Providers.tsx`) and the
// system color-scheme preference, then sets the right class on
// `<html>` before paint so dark-mode users don't see a one-frame flash.
// Mirrors the standard next-themes recipe but inlined for our custom
// provider. Stays in sync with `applyClass` in Providers.tsx.
const themeBootstrap = `(function(){try{var s=localStorage.getItem('pothos-theme');var r=(s==='dark'||s==='light')?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');var d=document.documentElement;d.classList.toggle('dark',r==='dark');d.classList.toggle('light',r==='light');d.style.colorScheme=r;}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${interTight.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: pre-hydration FOUC-prevention IIFE
          dangerouslySetInnerHTML={{ __html: themeBootstrap }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
        {/* Mounted at the root so the overlay covers every route — docs,
            playground, plugins, theme-editor — not just the docs column.
            `contentSelector="body"` lets reviewers comment on sidebar items,
            header chrome, playground panels, anything. The provider itself
            excludes its own UI from capture via the `rp-*` class checks.
            In production this resolves to a no-op component (see
            review-plugin/src/client/index.ts). */}
        <ReviewProviderDevOnly contentSelector="body" />
      </body>
    </html>
  );
}
