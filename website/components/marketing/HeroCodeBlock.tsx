/**
 * Static syntax-colored Pothos snippet for the home hero. Uses the
 * page's --bm-syntax-* CSS variables so it follows the active theme.
 */

const LINES: ReadonlyArray<readonly [string, string][]> = [
  [
    ['kw', 'import '],
    ['v', 'SchemaBuilder'],
    ['p', ' from '],
    ['s', "'@pothos/core'"],
    ['p', ';'],
  ],
  [],
  [['c', '// Pothos infers field shapes from the builder generic.']],
  [
    ['kw', 'const '],
    ['v', 'builder'],
    ['p', ' = '],
    ['kw', 'new '],
    ['fn', 'SchemaBuilder'],
    ['t', '<{ Context: Context }>'],
    ['p', '();'],
  ],
  [],
  [
    ['v', 'builder'],
    ['m', '.objectType'],
    ['p', '('],
    ['s', "'User'"],
    ['p', ', {'],
  ],
  [
    ['p', '  '],
    ['v', 'fields'],
    ['p', ': ('],
    ['v', 't'],
    ['p', ') => ({'],
  ],
  [
    ['p', '    '],
    ['v', 'id'],
    ['p', ':    '],
    ['v', 't'],
    ['m', '.exposeID'],
    ['p', '('],
    ['s', "'id'"],
    ['p', '),'],
  ],
  [
    ['p', '    '],
    ['v', 'name'],
    ['p', ':  '],
    ['v', 't'],
    ['m', '.exposeString'],
    ['p', '('],
    ['s', "'name'"],
    ['p', '),'],
  ],
  [
    ['p', '    '],
    ['v', 'posts'],
    ['p', ': '],
    ['v', 't'],
    ['m', '.field'],
    ['p', '({ '],
    ['v', 'type'],
    ['p', ': ['],
    ['t', 'Post'],
    ['p', '], '],
    ['v', 'resolve'],
    ['p', ': '],
    ['fn', 'loadPosts'],
    ['p', ' }),'],
  ],
  [['p', '  }),']],
  [['p', '});']],
];

const COLOR_VAR: Record<string, string> = {
  c: 'var(--bm-syntax-comment)',
  kw: 'var(--bm-syntax-keyword)',
  s: 'var(--bm-syntax-string)',
  t: 'var(--bm-syntax-type)',
  m: 'var(--bm-syntax-method)',
  fn: 'var(--bm-syntax-method)',
  v: 'var(--bm-syntax-text)',
  p: 'var(--bm-syntax-text)',
};

export function HeroCodeBlock() {
  return (
    <pre
      className="m-0 font-mono text-[13px] text-[var(--bm-syntax-text)]"
      style={{ lineHeight: 1.7 }}
    >
      {LINES.map((tokens, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: line indices are stable
          key={i}
          className="flex"
        >
          <span
            className="select-none w-7 text-right mr-4 shrink-0 tabular-nums"
            style={{ color: 'var(--bm-syntax-lineno)' }}
            aria-hidden="true"
          >
            {i + 1}
          </span>
          <span className="flex-1 whitespace-pre">
            {tokens.length === 0
              ? ' '
              : tokens.map(([kind, text], j) => (
                  <span
                    // biome-ignore lint/suspicious/noArrayIndexKey: token indices are stable
                    key={j}
                    style={{
                      color: COLOR_VAR[kind] ?? 'var(--bm-syntax-text)',
                      fontStyle: kind === 'c' ? 'italic' : 'normal',
                    }}
                  >
                    {text}
                  </span>
                ))}
          </span>
        </div>
      ))}
    </pre>
  );
}
