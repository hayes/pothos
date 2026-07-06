import { PLUGINS } from '../plugins/plugins';

interface Stat {
  value: string;
  label: string;
}

const STATS: Stat[] = [
  // Every figure here is checkable against the repo, not a performance
  // claim dressed up as a number.
  { value: '0', label: 'codegen steps' },
  // Core's only peer dependency is `graphql` (packages/core/package.json).
  { value: '1', label: 'peer dependency (graphql)' },
  // Derived from the single source of truth so the stat never drifts from
  // the plugin catalog (/plugins) or the garden's "Browse all N plugins".
  { value: String(PLUGINS.length), label: 'first-party plugins' },
];

/**
 * Three serif numerals stacked under the hero — the design's "stats row".
 * Each row gets a hairline separator below.
 */
export function StatsRow() {
  return (
    <div className="grid gap-3.5">
      {STATS.map((s) => (
        <div
          key={s.label}
          className="flex items-baseline gap-3.5 pb-3.5 border-b border-bm-line-soft"
        >
          <span
            className="font-serif font-normal text-bm-accent tabular-nums"
            style={{ fontSize: 36, letterSpacing: '-0.02em', minWidth: 80 }}
          >
            {s.value}
          </span>
          <span className="text-bm-ink-soft text-[15px]">{s.label}</span>
        </div>
      ))}
    </div>
  );
}
