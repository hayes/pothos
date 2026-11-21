import './global.css';
import { Analytics } from '@vercel/analytics/next';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
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
  'A plugin-based GraphQL schema builder for TypeScript. Define your types once and they flow into every resolver without codegen or decorators.';

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
    // No `url` here: a shared value would make every page claim to be the homepage.
    // Without it, crawlers fall back to each page's canonical URL.
    locale: 'en_US',
  },
  twitter: {
    card: 'summary',
  },
};

// Fonts are bundled from the @fontsource packages instead of `next/font/google`, so
// builds never download from Google Fonts (those downloads made CI flaky).
const readingSans = localFont({
  src: [
    {
      path: '../node_modules/@fontsource/lato/files/lato-latin-400-normal.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../node_modules/@fontsource/lato/files/lato-latin-400-italic.woff2',
      weight: '400',
      style: 'italic',
    },
    {
      path: '../node_modules/@fontsource/lato/files/lato-latin-700-normal.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../node_modules/@fontsource/lato/files/lato-latin-700-italic.woff2',
      weight: '700',
      style: 'italic',
    },
  ],
  variable: '--font-reading-sans',
  display: 'swap',
});

const sourceSerif = localFont({
  src: [
    {
      path: '../node_modules/@fontsource/source-serif-4/files/source-serif-4-latin-400-normal.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../node_modules/@fontsource/source-serif-4/files/source-serif-4-latin-400-italic.woff2',
      weight: '400',
      style: 'italic',
    },
    {
      path: '../node_modules/@fontsource/source-serif-4/files/source-serif-4-latin-600-normal.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../node_modules/@fontsource/source-serif-4/files/source-serif-4-latin-600-italic.woff2',
      weight: '600',
      style: 'italic',
    },
  ],
  variable: '--font-source-serif',
  display: 'swap',
});

const jetbrainsMono = localFont({
  src: [
    {
      path: '../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2',
      weight: '500',
      style: 'normal',
    },
  ],
  variable: '--font-jetbrains-mono',
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
      className={`${readingSans.variable} ${sourceSerif.variable} ${jetbrainsMono.variable}`}
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
            playground, plugins — not just the docs column.
            `contentSelector="body"` lets reviewers comment on sidebar items,
            header chrome, playground panels, anything. The provider itself
            excludes its own UI from capture via the `rp-*` class checks.
            In production this resolves to a no-op component (see
            review-plugin/src/client/index.ts). */}
        <ReviewProviderDevOnly contentSelector="body" />
        <Analytics />
      </body>
    </html>
  );
}
