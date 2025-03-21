import './global.css';
import Link from 'fumadocs-core/link';
import { Banner } from 'fumadocs-ui/components/banner';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
// import { HomeLayout as Layout } from 'fumadocs-ui/layouts/home';
import { RootProvider } from 'fumadocs-ui/provider';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import {  docsOptions } from './layout.config';

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
            <DocsLayout
              {...docsOptions}
              links={docsOptions.links}
              sidebar={{
                enabled: true,
              }}
            >
              {/* <Layout {...baseOptions}> */}
                {children}
              {/* </Layout> */}
            </DocsLayout>
        </RootProvider>
      </body>
    </html>
  );
}
