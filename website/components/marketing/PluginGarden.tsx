import Link from 'next/link';
import { PLUGINS, type PluginEntry } from './plugins';

export function PluginGarden() {
  return (
    <section className="max-w-[1280px] mx-auto px-10 py-24 border-t border-bm-line">
      <div className="flex items-end justify-between mb-9 flex-wrap gap-4">
        <div>
          <div className="text-[12px] uppercase tracking-[0.08em] text-bm-accent mb-2">
            The plugin garden
          </div>
          <h2
            className="font-serif font-normal m-0"
            style={{ fontSize: 48, letterSpacing: '-0.025em' }}
          >
            One ecosystem. Every shape.
          </h2>
        </div>
        <Link
          href="/docs/plugins"
          className="text-bm-ink-soft hover:text-bm-ink text-[14px] transition-colors"
        >
          Browse all {PLUGINS.length}+ plugins →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-t border-l border-bm-line">
        {PLUGINS.map((p) => (
          <PluginCard key={p.name} plugin={p} />
        ))}
      </div>
    </section>
  );
}

function PluginCard({ plugin }: { plugin: PluginEntry }) {
  const inner = (
    <div className="px-6 py-6 border-r border-b border-bm-line transition-colors hover:bg-bm-surface group h-full">
      <div className="flex items-center justify-center size-8 rounded-lg bg-bm-accent-soft text-bm-accent text-[16px] mb-3.5">
        {plugin.icon}
      </div>
      <div className="font-medium text-[15px] mb-1.5">{plugin.name}</div>
      <p className="text-bm-ink-muted text-[13px] leading-[1.5] m-0">{plugin.desc}</p>
    </div>
  );
  return plugin.href ? (
    <Link href={plugin.href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}
