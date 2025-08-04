import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { RootProvider } from 'fumadocs-ui/provider';
import type { ReactNode } from 'react';
import { docsOptions } from './layout.config';

export default function DocsLayoutWrapper({ children }: { children: ReactNode }) {
  return (
    <RootProvider search={{ enabled: true }}>
      <DocsLayout
        {...docsOptions}
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
