import type { Metadata } from 'next';
import { NotFoundContent } from '@/components/NotFoundContent';

export const metadata: Metadata = {
  title: 'Page not found',
};

/**
 * 404 boundary for docs routes (e.g. a mistyped `/docs/*` slug). It
 * renders inside the docs layout, which already provides the Header and
 * Sidebar, so this only emits the branded 404 body — no second Header.
 */
export default function DocsNotFound() {
  return <NotFoundContent />;
}
