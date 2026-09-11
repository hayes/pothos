import { CodeWindow } from './CodeWindow';
import { HeroCodeBlock } from './HeroCodeBlock';
import { ResponsivePlayground } from './ResponsivePlayground';

export function HeroBody() {
  return (
    <section className="max-w-[1280px] mx-auto px-6 sm:px-10 pb-16 md:pb-24">
      <ResponsivePlayground>
        <CodeWindow filename="schema.ts">
          <HeroCodeBlock />
        </CodeWindow>
      </ResponsivePlayground>
    </section>
  );
}
