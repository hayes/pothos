import './global.css';
import { Fraunces, Inter_Tight, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import { Providers } from '../components/Providers';

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

export default function RootLayout({ children }: { children: ReactNode }) {
  // Note: Next.js 16's dev mode escalates "script inside a React
  // component" into a blocking error overlay, which means we can't
  // render a pre-hydration FOUC-prevention `<script>` from app/layout
  // even via next/script. We accept a brief one-frame flash on first
  // paint instead; Providers applies the right class via useEffect.
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${interTight.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
