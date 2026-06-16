import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ReviewIndexPage } from '@/review-plugin/src/client';

export const metadata: Metadata = {
  title: 'Review feedback',
  robots: { index: false, follow: false },
};

/**
 * Centralized review feedback index. The component itself is dead-code-
 * eliminated from the production bundle, and we 404 here too so an empty
 * page never ships to readers — the route only exists during `pnpm dev`.
 */
export default function ReviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <ReviewIndexPage />;
}
