import type { ReactNode } from 'react';
import { source } from '@/app/source';
import { Sidebar } from '@/components/docs/Sidebar/Sidebar';
import { Header } from '@/components/marketing/Header';

/**
 * Docs layout: marketing Header + custom Sidebar. Children render
 * directly inside the right column — pages that need fumadocs's
 * DocsPage scaffolding (the MDX catch-all) wrap themselves in
 * DocsLayout; pages that don't (this overview, sponsors, etc.) get
 * the full column width without fumadocs's article grid.
 */
export default function DocsLayoutWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-bm-bg text-bm-ink">
      <Header />
      <div className="flex-1 flex min-h-0">
        <Sidebar tree={source.pageTree} />
        <div className="flex-1 min-w-0 min-h-0 overflow-x-hidden">{children}</div>
      </div>
    </div>
  );
}
