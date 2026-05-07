import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type { ReactNode } from 'react';
import { source } from '@/app/source';
import { Sidebar } from '../../components/docs/Sidebar';
import { Header } from '../../components/marketing/Header';
import { docsOptions } from './layout.config';

export default function DocsLayoutWrapper({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <DocsLayout
        {...docsOptions}
        nav={{ enabled: false }}
        links={docsOptions.links}
        sidebar={{
          enabled: true,
          // Override fumadocs' default sidebar with our custom one. The
          // deprecated `component` prop is the simplest way to inject a
          // ReactNode without adopting the slot/provider machinery.
          component: <Sidebar tree={source.pageTree} />,
        }}
      >
        {children}
      </DocsLayout>
    </>
  );
}
