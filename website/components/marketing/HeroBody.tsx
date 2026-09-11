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
          Where the types come from.
        </h2>
        <p className="text-bm-ink-soft text-[16px] leading-[1.6] mt-0 mb-7">
          You write two type annotations here: your context on the builder, and the model backing{' '}
          <code className="bg-bm-surface-alt px-1.5 py-0.5 rounded text-[13px] font-mono">
            User
          </code>
          . In the last resolver,{' '}
          <code className="bg-bm-surface-alt px-1.5 py-0.5 rounded text-[13px] font-mono">
            user
          </code>{' '}
          and{' '}
          <code className="bg-bm-surface-alt px-1.5 py-0.5 rounded text-[13px] font-mono">ctx</code>{' '}
          are typed from those, without annotations of their own.
        </p>
        <StatsRow />
      </div>
    </section>
  );
}
