import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type { ReactNode } from 'react';
import { source } from '@/app/source';
import { Sidebar } from '../../components/docs/Sidebar';
import { Header } from '../../components/marketing/Header';
import { docsOptions } from './layout.config';

/**
 * Docs layout: marketing Header above, our custom Sidebar on the left,
 * fumadocs DocsLayout (with its own nav + sidebar disabled) on the
 * right hosting the article + TOC. Wrapping like this lets us replace
 * fumadocs's sidebar wholesale without losing the DocsPage / DocsBody
 * context that the per-page renderer relies on.
 */
export default function DocsLayoutWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-bm-bg text-bm-ink">
      <Header />
      <div className="flex-1 grid grid-cols-[260px_1fr] min-h-0">
        <Sidebar tree={source.pageTree} />
        <DocsLayout
          {...docsOptions}
          nav={{ enabled: false }}
          sidebar={{ enabled: false }}
          links={docsOptions.links}
        >
          {children}
        </DocsLayout>
      </div>
    </div>
  );
}
