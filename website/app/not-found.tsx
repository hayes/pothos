import type { Metadata } from 'next';
import { Header } from '@/components/marketing/Header';
import { NotFoundContent } from '@/components/NotFoundContent';

export const metadata: Metadata = {
  title: 'Page not found',
};

/**
 * Root 404 for top-level unmatched routes. Renders inside the root layout
 * only, so it supplies its own marketing Header for site chrome. Docs
 * routes have their own boundary (`app/(docs)/not-found.tsx`) that reuses
 * the docs layout's Header instead of double-stacking one.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-bm-bg text-bm-ink">
      <Header />
      <NotFoundContent />
    </div>
  );
}
