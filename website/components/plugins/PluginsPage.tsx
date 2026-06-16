import { PluginCard } from './PluginCard';
import { PLUGIN_CATEGORIES, pluginsByCategory } from './plugins';

interface Props {
  /** Tighten the layout when used inside the docs main column.
   *  Drops the marketing hero scale and the outer max-width wrapper. */
  variant?: 'marketing' | 'docs';
}

export function PluginsPage({ variant = 'marketing' }: Props) {
  const grouped = pluginsByCategory();
  const totalPlugins = grouped.reduce((acc, g) => acc + g.items.length, 0);
  const isDocs = variant === 'docs';

  return (
    <div className={isDocs ? '' : 'max-w-[1280px] mx-auto px-10 py-16'}>
      <header className="mb-12">
        <div className="text-[12px] uppercase tracking-[0.08em] text-bm-accent mb-3">
          The plugin garden
        </div>
        <h1
          className="font-serif font-normal m-0"
          style={
            isDocs
              ? { fontSize: 44, letterSpacing: '-0.022em', lineHeight: 1.1 }
              : { fontSize: 56, letterSpacing: '-0.025em', lineHeight: 1.05 }
          }
        >
          {isDocs ? (
            'One ecosystem. Every shape.'
          ) : (
            <>
              One ecosystem.
              <br />
              Every shape.
            </>
          )}
        </h1>
        <p
          className={`text-bm-ink-soft leading-[1.5] mt-5 ${
            isDocs ? 'text-[17px] max-w-[640px]' : 'text-[19px] max-w-[680px]'
          }`}
        >
          {totalPlugins} first-party plugins to wire Pothos into your data layer, your auth model,
          your tracing stack, and the schema patterns your spec calls for. Every plugin ships with
          full TypeScript inference and zero runtime overhead beyond what you wire up.
        </p>
      </header>

      <div className="flex flex-col gap-16">
        {grouped.map((group) => {
          const meta = PLUGIN_CATEGORIES[group.category];
          if (group.items.length === 0) {
            return null;
          }
          return (
            <section key={group.category}>
              <header className="mb-6 flex items-baseline gap-4 flex-wrap">
                <div>
                  <div className="text-[12px] uppercase tracking-[0.08em] text-bm-accent mb-1">
                    {meta.eyebrow}
                  </div>
                  <h2
                    className="font-serif font-normal m-0"
                    style={{ fontSize: 28, letterSpacing: '-0.02em' }}
                  >
                    {meta.label}
                  </h2>
                </div>
                <p className="text-bm-ink-muted text-[14px] m-0 flex-1">{meta.description}</p>
              </header>
              <div
                className={`grid grid-cols-1 sm:grid-cols-2 ${
                  isDocs ? 'lg:grid-cols-2' : 'lg:grid-cols-3 xl:grid-cols-4'
                } border-t border-l border-bm-line`}
              >
                {group.items.map((p) => (
                  <PluginCard key={p.slug} plugin={p} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
