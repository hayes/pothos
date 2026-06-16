import Link from 'next/link';
import type { PluginEntry } from './plugins';

interface Props {
  plugin: PluginEntry;
}

/**
 * Single plugin card — icon swatch, name, description, and the
 * `npm i @pothos/plugin-<slug>` snippet under the description as a
 * subtle mono chip. Whole card is the link to the docs page.
 */
export function PluginCard({ plugin }: Props) {
  const pkg = `@pothos/plugin-${plugin.slug}`;
  return (
    <Link
      href={`/docs/plugins/${plugin.slug}`}
      className="group flex flex-col px-6 py-6 border-r border-b border-bm-line hover:bg-bm-surface transition-colors min-h-[180px]"
    >
      <div className="flex items-center justify-center size-9 rounded-lg bg-bm-accent-soft text-bm-accent text-[18px] mb-4">
        {plugin.icon}
      </div>
      <div className="font-medium text-[15px] mb-1.5">{plugin.name}</div>
      <p className="text-bm-ink-muted text-[13px] leading-[1.5] m-0 flex-1">{plugin.description}</p>
      <code className="mt-4 inline-flex self-start text-[11px] text-bm-ink-muted font-mono bg-bm-surface-alt px-2 py-1 rounded border border-bm-line group-hover:text-bm-ink transition-colors">
        {pkg}
      </code>
    </Link>
  );
}
