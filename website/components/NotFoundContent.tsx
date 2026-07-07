import Link from 'next/link';
import { BotanicalSpray } from '@/components/marketing/BotanicalSpray';

/**
 * Shared 404 body in the Botanical Modern vocabulary — trailing pothos
 * spray, serif headline with an accent italic, and a primary CTA back
 * into the docs. Rendered chrome-free so it can drop into either the
 * root layout (wrapped with the marketing Header, for top-level 404s) or
 * the docs content column (where the docs layout already supplies the
 * Header + Sidebar).
 */
export function NotFoundContent() {
  return (
    <section className="flex-1 flex flex-col items-center justify-center min-h-[70vh] px-6 py-24 text-center relative overflow-hidden">
      <BotanicalSpray
        width={320}
        height={300}
        className="absolute -top-6 right-4 sm:right-16 text-bm-accent pointer-events-none opacity-70"
      />

      <div className="inline-flex items-center gap-2 mb-5 text-[12px] uppercase tracking-[0.08em] text-bm-ink-muted">
        <span className="w-[18px] h-px bg-bm-accent" aria-hidden="true" />
        Error 404
      </div>

      <h1 className="font-serif font-normal text-[clamp(2.5rem,7vw,4.5rem)] leading-[1.05] m-0">
        This page has <span className="italic text-bm-accent">wandered off</span>
      </h1>

      <p className="text-bm-ink-soft mt-6 mb-9 max-w-[46ch]">
        The page you're looking for doesn't exist — it may have moved during the docs reorg, or the
        link was mistyped. Let's get you back on the trellis.
      </p>

      <div className="flex flex-wrap gap-3 items-center justify-center">
        <Link
          href="/docs"
          className="inline-flex items-center gap-2.5 rounded-lg text-[15px] font-medium px-6 py-3 bg-bm-ink text-bm-bg hover:opacity-90 transition-opacity"
        >
          Browse the docs
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 rounded-lg text-[14px] px-5 py-2.5 border border-bm-line text-bm-ink bg-transparent hover:bg-bm-surface-alt transition-colors"
        >
          Back to home
        </Link>
      </div>
    </section>
  );
}
