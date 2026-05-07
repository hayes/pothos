'use client';

import type { EditorBaseColors, PaletteSlots } from '../../lib/playground/monaco-theme';
import { ColorRow } from './ColorRow';
import type { Mode } from './palettes';
import { paletteGroupsFor } from './palettes';

interface Props {
  palette: PaletteSlots;
  base: EditorBaseColors;
  mode: Mode;
  onPaletteChange: (next: PaletteSlots) => void;
  onBaseChange: (next: EditorBaseColors) => void;
}

const SYNTAX_FIELDS: Array<{
  key: keyof PaletteSlots;
  label: string;
  description?: string;
}> = [
  { key: 'comment', label: 'Comment', description: '// ... and /* ... */' },
  { key: 'keyword', label: 'Keyword', description: 'import, const, function, type' },
  { key: 'string', label: 'String', description: "'hello' / \"world\" / `tpl`" },
  { key: 'number', label: 'Number', description: '42 / 0xFF / 3.14 / true·false·null' },
  { key: 'type', label: 'Type', description: 'User · Promise · interface · JSON keys' },
  { key: 'fn', label: 'Function', description: 'callable identifiers (currently unused)' },
  { key: 'variable', label: 'Variable', description: 'identifiers, properties, plain text' },
  { key: 'delimiter', label: 'Delimiter / punctuation', description: '() {} , ; .' },
  { key: 'regexp', label: 'Regex', description: '/pattern/flags' },
  { key: 'decorator', label: 'Decorator', description: '@deprecated' },
  { key: 'attribute', label: 'Attribute', description: 'JSX/HTML attribute names' },
  { key: 'tag', label: 'Tag', description: 'JSX/HTML/XML tag names' },
];

const BASE_FIELDS: Array<{
  key: keyof EditorBaseColors;
  label: string;
  description?: string;
}> = [
  { key: 'background', label: 'Editor background' },
  { key: 'foreground', label: 'Editor foreground (default text)' },
  { key: 'lineNumber', label: 'Line number' },
  { key: 'lineNumberActive', label: 'Active line number' },
  { key: 'selection', label: 'Selection background' },
  { key: 'cursor', label: 'Cursor' },
];

export function PaletteEditor({ palette, base, mode, onPaletteChange, onBaseChange }: Props) {
  const swatches = paletteGroupsFor(mode);
  return (
    <aside className="flex flex-col min-h-0 overflow-auto bg-bm-bg border-r border-bm-line w-[320px] py-3">
      <Section title="Editor surface">
        {BASE_FIELDS.map((f) => (
          <ColorRow
            key={f.key}
            label={f.label}
            description={f.description}
            value={base[f.key]}
            onChange={(v) => onBaseChange({ ...base, [f.key]: v })}
            swatches={swatches}
          />
        ))}
      </Section>

      <Section title="Syntax tokens">
        {SYNTAX_FIELDS.map((f) => (
          <ColorRow
            key={f.key}
            label={f.label}
            description={f.description}
            value={palette[f.key]}
            onChange={(v) => onPaletteChange({ ...palette, [f.key]: v })}
            swatches={swatches}
          />
        ))}
      </Section>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <header className="px-4 py-1.5 text-[10px] uppercase tracking-[0.1em] text-bm-ink-muted">
        {title}
      </header>
      {children}
    </section>
  );
}
