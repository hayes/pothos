import './global.css';
import { RootProvider } from 'fumadocs-ui/provider';
import { DocsLayout, Layout } from 'fumadocs-ui/layout';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { baseOptions, docsOptions } from './layout.config';

const inter = Inter({
  subsets: ['latin'],
});

export default function HomeLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body>
        <RootProvider search={{ enabled: true }}>
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
