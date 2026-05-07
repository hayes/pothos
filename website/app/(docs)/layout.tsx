import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { RootProvider } from 'fumadocs-ui/provider/next';
import type { ReactNode } from 'react';
import { Header } from '../../components/marketing/Header';
import { docsOptions } from './layout.config';

export default function DocsLayoutWrapper({ children }: { children: ReactNode }) {
  return (
    <RootProvider search={{ enabled: true }}>
      <Header />
      <DocsLayout
        {...docsOptions}
        nav={{ enabled: false }}
        links={docsOptions.links}
        sidebar={{
          enabled: true,
        }}
      >
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
