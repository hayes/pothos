'use client';

import type { GraphQLSchema } from 'graphql';
import { useMemo, useState } from 'react';
import { type ExplorerSchema, introspectSchema } from './introspect';
import { TypeRow } from './TypeRow';

type View = 'tree' | 'sdl';

interface Props {
  schema: GraphQLSchema | null;
  schemaSDL: string | null;
  isCompiling: boolean;
  /** "active" field highlight — `${TypeName}.${fieldName}` */
  activeFieldKey?: string;
  /** Click on a type ref or field. Page decides what to do (jump editor, etc). */
  onTypeClick?: (typeName: string) => void;
}

const EMPTY: ExplorerSchema = { types: [], fieldCount: 0 };

export function SchemaExplorer({
  schema,
  schemaSDL,
  isCompiling,
  activeFieldKey,
  onTypeClick,
}: Props) {
  const [view, setView] = useState<View>('tree');
  const [filter, setFilter] = useState('');

  const explorer = useMemo<ExplorerSchema>(
    () => (schema ? introspectSchema(schema) : EMPTY),
    [schema],
  );
  const knownTypes = useMemo(() => new Set(explorer.types.map((t) => t.name)), [explorer]);

  const filtered = useMemo(() => {
    if (!filter) {
      return explorer.types;
    }
    const q = filter.toLowerCase();
    return explorer.types.filter((t) => {
      if (t.name.toLowerCase().includes(q)) {
        return true;
      }
      return t.fields.some(
        (f) => f.name.toLowerCase().includes(q) || f.returns.toLowerCase().includes(q),
      );
    });
  }, [explorer.types, filter]);

  return (
    <section className="flex flex-col min-h-0">
      <header className="flex items-center justify-between px-5 h-11 border-b border-bm-line text-[11px] uppercase tracking-[0.08em] text-bm-ink-muted">
        <span>Schema</span>
        <span className="text-[10px] normal-case tracking-normal">
          {explorer.types.length} types · {explorer.fieldCount} fields
        </span>
      </header>

      <div className="px-4 pt-3.5 font-mono">
        <div className="flex border-b border-bm-line mb-3">
          {(['tree', 'sdl'] as const).map((v) => (
            <button
              type="button"
              key={v}
              onClick={() => setView(v)}
              className={`text-[11px] uppercase tracking-[0.08em] mr-4 pb-2 -mb-px transition-colors border-b-[1.5px] ${
                view === v ? 'text-bm-ink border-bm-accent' : 'text-bm-ink-muted border-transparent'
              }`}
            >
              {v === 'tree' ? 'Explorer' : 'SDL'}
            </button>
          ))}
        </div>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter…"
          className="w-full mb-4 px-2.5 py-1.5 font-mono text-[12px] text-bm-ink bg-bm-surface-alt border border-bm-line rounded outline-none focus:border-bm-accent"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-auto px-4 pb-4 font-mono text-[12px]">
        {isCompiling && filtered.length === 0 && (
          <div className="text-bm-ink-muted italic py-2">Compiling…</div>
        )}
        {!isCompiling && filtered.length === 0 && filter && (
          <div className="text-bm-ink-muted italic py-2">No types match "{filter}"</div>
        )}
        {!isCompiling && filtered.length === 0 && !filter && (
          <div className="text-bm-ink-muted italic py-2">Schema is empty.</div>
        )}
        {view === 'tree' &&
          filtered.map((t) => (
            <TypeRow
              key={t.name}
              type={t}
              knownTypes={knownTypes}
              activeFieldKey={activeFieldKey}
              onTypeClick={onTypeClick}
            />
          ))}
        {view === 'sdl' && (
          <pre className="m-0 whitespace-pre-wrap text-bm-ink-soft leading-[1.7]">
            {schemaSDL ?? ''}
          </pre>
        )}
      </div>
    </section>
  );
}
