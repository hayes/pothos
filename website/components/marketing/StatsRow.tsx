interface Stat {
  value: string;
  label: string;
}

const STATS: Stat[] = [
  { value: '0kb', label: 'runtime overhead' },
  { value: '16+', label: 'first-party plugins' },
  { value: '100%', label: 'TS inference, no codegen' },
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
