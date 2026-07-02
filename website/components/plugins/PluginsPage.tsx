import { PluginCard } from './PluginCard';
import { PLUGIN_CATEGORIES, pluginsByCategory } from './plugins';

/**
 * The canonical plugin catalog, rendered at /docs/plugins inside the docs
 * shell. Its headline is intentionally distinct from the home page's plugin
 * garden teaser (`components/marketing/PluginGarden.tsx`) so the two surfaces
 * don't read as the same page.
 */
export function PluginsPage() {
  const grouped = pluginsByCategory();
  const totalPlugins = grouped.reduce((acc, g) => acc + g.items.length, 0);

  return (
    <div>
      <header className="mb-12">
        <div className="text-[12px] uppercase tracking-[0.08em] text-bm-accent mb-3">
          Plugin catalog
        </div>
        <h1
          className="font-serif font-normal m-0"
          style={{ fontSize: 44, letterSpacing: '-0.022em', lineHeight: 1.1 }}
        >
          Every plugin, categorized.
        </h1>
        <p className="text-bm-ink-soft leading-[1.5] mt-5 text-[17px] max-w-[640px]">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 border-t border-l border-bm-line">
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
