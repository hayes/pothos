import Link from 'next/link';
import { BotanicalSpray } from './BotanicalSpray';

export function Hero() {
  return (
    <section className="max-w-[1280px] mx-auto px-10 pt-[88px] pb-20 relative">
      {/* Trailing pothos vines hanging from the header line. Shown at xl (not
          md): from 768 up to ~1279 the headline reflows to "…grow with your /
          code." and runs under the right-anchored vine, so the leaves crowd
          the word "your". Only at xl (1280+) does the text column leave clear
          space to the vine's left; below that the decorative vine is hidden. */}
      <div className="absolute top-0 right-10 hidden xl:block pointer-events-none text-bm-accent">
        <BotanicalSpray color="currentColor" />
      </div>
      {/* Eyebrow */}
      <div className="inline-flex items-center gap-2 mb-5 text-[12px] uppercase tracking-[0.08em] text-bm-ink-muted">
        <span className="w-[18px] h-px bg-bm-accent" aria-hidden="true" />
        GraphQL schema builder for TypeScript
      </div>

      {/* H1 — clamps from a comfortable phone size up to the design's 88px */}
      <h1
        className="font-serif font-normal m-0"
        style={{
          fontSize: 'clamp(48px, 8vw, 88px)',
          lineHeight: 1.02,
          letterSpacing: '-0.035em',
          maxWidth: 980,
        }}
      >
        Schemas that{' '}
        <em
          className="italic text-bm-accent"
          // The Fraunces italic 'w' at opsz 144 overshoots its advance box on
          // the right; combined with the h1's -0.035em tracking it swallowed
          // the word-space so "grow" and "with" touched. A small right margin
          // restores a clear gap without adding literal whitespace.
          style={{ fontVariationSettings: '"opsz" 144', marginRight: '0.12em' }}
        >
          grow
        </em>{' '}
        with your code
      </h1>

      {/* Lede */}
      <p
        className="text-bm-ink-soft mt-7 mb-9"
        style={{
          fontSize: 'clamp(17px, 2.4vw, 21px)',
          lineHeight: 1.5,
          maxWidth: 640,
          letterSpacing: '-0.01em',
        }}
      >
        Pothos is a GraphQL schema builder for TypeScript with type safety built into every field.
        Write most of your schema without manual type annotations, with inference that extends to
        integrations like Prisma, Drizzle, and Zod.
      </p>

      {/* CTAs */}
      <div className="flex flex-wrap gap-3 items-center">
        <Link
          href="/docs"
          className="inline-flex items-center gap-2.5 rounded-lg text-[15px] font-medium px-6 py-3 bg-bm-ink text-bm-bg hover:opacity-90 transition-opacity"
        >
          Get started <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
