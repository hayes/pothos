import Link from 'next/link';

export function Hero() {
  return (
    <section className="max-w-[1280px] mx-auto px-10 pt-[88px] pb-20 relative">
      {/* Eyebrow */}
      <div className="inline-flex items-center gap-2 mb-5 text-[12px] uppercase tracking-[0.08em] text-bm-ink-muted">
        <span className="w-[18px] h-px bg-bm-accent" aria-hidden="true" />
        Type-safe by design · v4.0
      </div>

      {/* H1 */}
      <h1
        className="font-serif font-normal m-0"
        style={{
          fontSize: 88,
          lineHeight: 1.02,
          letterSpacing: '-0.035em',
          maxWidth: 980,
        }}
      >
        Schemas that{' '}
        <em
          className="italic text-bm-accent"
          style={{ fontVariationSettings: '"opsz" 144' }}
        >
          grow
        </em>{' '}
        with your code.
      </h1>

      {/* Lede */}
      <p
        className="text-bm-ink-soft mt-7 mb-9"
        style={{ fontSize: 21, lineHeight: 1.5, maxWidth: 640, letterSpacing: '-0.01em' }}
      >
        Pothos is a plugin-based GraphQL schema builder for TypeScript. Zero runtime overhead, no
        codegen, end-to-end inference — at the scale of Airbnb, Netflix, and your weekend project.
      </p>

      {/* CTAs */}
      <div className="flex flex-wrap gap-3 items-center">
        <Link
          href="/docs"
          className="inline-flex items-center gap-2.5 rounded-lg text-[15px] font-medium px-6 py-3 bg-bm-ink text-bm-bg hover:opacity-90 transition-opacity"
        >
          Read the guide <span aria-hidden="true">→</span>
        </Link>
        <code className="inline-flex items-center gap-2.5 rounded-lg text-[14px] px-5 py-2.5 border border-bm-line text-bm-ink font-mono bg-transparent select-all">
          npm i @pothos/core
          <span className="text-bm-ink-muted ml-2.5" aria-hidden="true">
            ⧉
          </span>
        </code>
        <span className="text-[13px] text-bm-ink-muted ml-2">MIT · loved by 1.1k+ stars</span>
      </div>
    </section>
  );
}
