import './global.css';
import { RootProvider } from 'fumadocs-ui/provider';
import { DocsLayout, Layout } from 'fumadocs-ui/layout';
import { Banner } from 'fumadocs-ui/components/banner';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { baseOptions, docsOptions } from './layout.config';
import Link from 'fumadocs-core/link';

const inter = Inter({
  subsets: ['latin'],
});

export default function HomeLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body>
        <RootProvider search={{ enabled: true }}>
          <Banner id="v4-release-2">
            <p className="text-foreground">
              Pothos v4 is now available! 🎉
              <Link href="/docs/migrations/v4" className="ml-2 hover:underline">
                Check out the full migration guide here
              </Link>
            </p>
          </Banner>
          <Layout {...baseOptions}>
            <DocsLayout
              {...docsOptions}
              links={docsOptions.links}
              sidebar={{
                enabled: true,
              }}
            >
              {children}
            </DocsLayout>
          </Layout>
        </RootProvider>
      </body>
    </html>
  );
}
