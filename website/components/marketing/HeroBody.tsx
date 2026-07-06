import { CodeWindow } from './CodeWindow';
import { HeroCodeBlock } from './HeroCodeBlock';
import { StatsRow } from './StatsRow';

/**
 * Below the hero copy: a 2-column block with the Pothos snippet on the
 * left and a short value-prop paragraph + stats on the right.
 */
export function HeroBody() {
  return (
    <section className="max-w-[1280px] mx-auto px-10 pb-24 grid lg:grid-cols-[1.4fr_1fr] gap-14 items-start">
      <CodeWindow filename="schema/user.ts">
        <HeroCodeBlock />
      </CodeWindow>

      <div>
        {/* h2 (not h3) so the landing page heading order is H1 → H2 → H2 with
            no skipped level (WCAG 1.3.1). Visual size stays 28px via inline
            style — the docs `article#nd-page h2` override doesn't apply here. */}
        <h2
          className="font-serif font-normal mt-0 mb-4"
          style={{ fontSize: 28, letterSpacing: '-0.02em' }}
        >
          Inference, all the way down.
        </h2>
        <p className="text-bm-ink-soft text-[16px] leading-[1.6] mt-0 mb-7">
          The types are TypeScript&apos;s own. The builder carries your context, backing models, and
          scalars through its generics, so every resolver&apos;s arguments, parent, and return type
          arrive already inferred — checked by the compiler. Nothing scans or reflects over your
          code; there&apos;s no codegen step and no{' '}
          <code className="bg-bm-surface-alt px-1.5 py-0.5 rounded text-[13px] font-mono">any</code>{' '}
          escape hatch.
        </p>
        <StatsRow />
      </div>
    </section>
  );
}
