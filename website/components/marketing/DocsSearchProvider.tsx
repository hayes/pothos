'use client';

import { SearchProvider } from 'fumadocs-ui/contexts/search';
import dynamic from 'next/dynamic';
import type { ComponentProps, ReactNode } from 'react';

// Lazy-load the stock fumadocs search dialog so it isn't in the initial
// bundle — it only mounts once the user opens search (Cmd/Ctrl+K or the
// header trigger). It loads the prebuilt index from `/api/search` and
// searches in the browser, and its `fd-*` tokens are already mapped
// onto the Botanical Modern palette in `app/global.css`, so it blends
// with both themes without extra styling.
const DefaultSearchDialog = dynamic(() => import('fumadocs-ui/components/dialog/search-default'));

// `static`: download the prebuilt index from `/api/search` once and search in the browser.
function SearchDialog(props: ComponentProps<typeof DefaultSearchDialog>) {
  return <DefaultSearchDialog {...props} type="static" />;
}

/**
 * Mounts the fumadocs `SearchProvider` (Cmd/Ctrl+K hotkey + the shared
 * search context that `SearchButton` reads) around the site header. Kept
 * scoped to the header tree so the global keydown listener is only active
 * on pages that actually expose a search affordance — not the playground,
 * which owns its own keyboard shortcuts.
 */
export function DocsSearchProvider({ children }: { children: ReactNode }) {
  return <SearchProvider SearchDialog={SearchDialog}>{children}</SearchProvider>;
}
