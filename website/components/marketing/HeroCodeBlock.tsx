/**
 * Static syntax-colored Pothos snippet for the home hero. Uses the
 * page's --bm-syntax-* CSS variables so it follows the active theme.
 */

const LINES: ReadonlyArray<readonly [string, string][]> = [
  [
    ['kw', 'import'],
    ['v', ' '],
    ['v', 'SchemaBuilder'],
    ['v', ' '],
    ['kw', 'from'],
    ['v', ' '],
    ['s', "'@pothos/core'"],
    ['v', ';'],
  ],
  [],
  [
    ['kw', 'const'],
    ['v', ' '],
    ['v', 'builder'],
    ['v', ' = '],
    ['kw', 'new'],
    ['v', ' '],
    ['v', 'SchemaBuilder'],
    ['v', '({});'],
  ],
  [],
  [
    ['v', 'builder'],
    ['v', '.'],
    ['fn', 'queryType'],
    ['v', '({'],
  ],
  [
    ['v', '  '],
    ['v', 'fields'],
    ['v', ': ('],
    ['v', 't'],
    ['v', ') => ({'],
  ],
  [
    ['v', '    '],
    ['v', 'hello'],
    ['v', ': '],
    ['v', 't'],
    ['v', '.'],
    ['fn', 'string'],
    ['v', '({'],
  ],
  [
    ['v', '      '],
    ['v', 'args'],
    ['v', ': { '],
    ['v', 'name'],
    ['v', ': '],
    ['v', 't'],
    ['v', '.'],
    ['v', 'arg'],
    ['v', '.'],
    ['fn', 'string'],
    ['v', '() },'],
  ],
  [
    ['v', '      '],
    ['v', 'resolve'],
    ['v', ': ('],
    ['v', '_'],
    ['v', ', { '],
    ['v', 'name'],
    ['v', ' }) =>'],
  ],
  [
    ['v', '        '],
    // biome-ignore lint/suspicious/noTemplateCurlyInString: literal code displayed in the example
    ['s', "`Hello, ${name ?? 'World'}!`"],
    ['v', ','],
  ],
  [['v', '    }),']],
  [['v', '  }),']],
  [['v', '});']],
  [],
  [
    ['kw', 'export'],
    ['v', ' '],
    ['kw', 'const'],
    ['v', ' '],
    ['v', 'schema'],
    ['v', ' = '],
    ['v', 'builder'],
    ['v', '.'],
    ['fn', 'toSchema'],
    ['v', '();'],
  ],
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
      className="m-0 font-mono text-[12px] sm:text-[13px] text-[var(--bm-syntax-text)]"
      style={{ lineHeight: 1.7 }}
    >
      {LINES.map((tokens, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: line indices are stable
          key={i}
          className="flex"
        >
          <span
            className="hidden sm:block select-none w-7 text-right mr-4 shrink-0 tabular-nums"
            style={{ color: 'var(--bm-syntax-lineno)' }}
            aria-hidden="true"
          >
            {i + 1}
          </span>
          <span className="min-w-0 flex-1 whitespace-pre-wrap break-words sm:whitespace-pre">
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
