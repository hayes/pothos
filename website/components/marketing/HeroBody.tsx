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
        <h3
          className="font-serif font-normal mt-0 mb-4"
          style={{ fontSize: 28, letterSpacing: '-0.02em' }}
        >
          Inference, all the way down.
        </h3>
        <p className="text-bm-ink-soft text-[16px] leading-[1.6] mt-0 mb-7">
          Define a type once. Pothos walks your code and infers the shape of arguments, return
          types, and context across resolvers. No codegen step, no decorators, no{' '}
          <code className="bg-bm-surface-alt px-1.5 py-0.5 rounded text-[13px] font-mono">
            any
          </code>{' '}
          escape hatches.
        </p>
        <StatsRow />
      </div>
    </section>
  );
}
