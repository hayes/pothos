'use client';

import type { GraphQLSchema } from 'graphql';
import { useMemo, useState } from 'react';
import { type ExplorerSchema, introspectSchema } from '../SchemaExplorer/introspect';
import { TypeRow } from '../SchemaExplorer/TypeRow';
import type { PlaygroundFile } from '../types';
import { FilesView } from './FilesView';

type Tab = 'files' | 'explorer';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'files', label: 'Files' },
  { key: 'explorer', label: 'Explorer' },
];

interface Props {
  // Files
  files: PlaygroundFile[];
  activeIndex: number;
  sdlActive: boolean;
  onSelectFile: (index: number) => void;
  onSelectSdl: () => void;
  onAddFile: () => void;
  onRenameFile: (index: number, name: string) => boolean;
  onRemoveFile: (index: number) => void;

  // Schema
  schema: GraphQLSchema | null;
  schemaSDL: string | null;
  isCompiling: boolean;
  activeFieldKey?: string;
  onTypeClick?: (typeName: string) => void;
}

const EMPTY: ExplorerSchema = { types: [], fieldCount: 0 };

/**
 * Left-column container with two tabs — Files (your input, including the
 * read-only generated `schema.graphql`) and Explorer (the compiled schema's
 * type tree). Both share a header, a filter input (when relevant), and a
 * meta count.
 */
export function SchemaSidebar({
  files,
  activeIndex,
  sdlActive,
  onSelectFile,
  onSelectSdl,
  onAddFile,
  onRenameFile,
  onRemoveFile,
  schema,
  schemaSDL: _schemaSDL,
  isCompiling,
  activeFieldKey,
  onTypeClick,
}: Props) {
  const [tab, setTab] = useState<Tab>('files');
  const [filter, setFilter] = useState('');

  const explorer = useMemo<ExplorerSchema>(
    () => (schema ? introspectSchema(schema) : EMPTY),
    [schema],
  );
  const knownTypes = useMemo(() => new Set(explorer.types.map((t) => t.name)), [explorer]);

  const filteredTypes = useMemo(() => {
    if (!filter) return explorer.types;
    const q = filter.toLowerCase();
    return explorer.types.filter((t) => {
      if (t.name.toLowerCase().includes(q)) return true;
      return t.fields.some(
        (f) => f.name.toLowerCase().includes(q) || f.returns.toLowerCase().includes(q),
      );
    });
  }, [explorer.types, filter]);

  const meta =
    tab === 'files'
      ? `${files.length + 1} file${files.length === 0 ? '' : 's'}`
      : `${explorer.types.length} type${explorer.types.length === 1 ? '' : 's'} · ${explorer.fieldCount} field${explorer.fieldCount === 1 ? '' : 's'}`;

  const showFilter = tab === 'explorer';

  return (
    <aside className="grid grid-rows-[auto_auto_1fr] min-h-0 bg-bm-bg border-r border-bm-line">
      <header className="flex items-center px-5 h-11 border-b border-bm-line">
        <div className="flex gap-4 h-full items-center">
          {TABS.map((t) => (
            <button
              type="button"
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-px text-[11px] uppercase tracking-[0.08em] border-b-[1.5px] transition-colors ${
                tab === t.key
                  ? 'text-bm-ink border-bm-accent'
                  : 'text-bm-ink-muted border-transparent hover:text-bm-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <span className="text-[10px] tracking-normal text-bm-ink-muted">{meta}</span>
      </header>

      {showFilter ? (
        <div className="px-4 pt-3 pb-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter…"
            className="w-full px-2.5 py-1.5 font-mono text-[12px] text-bm-ink bg-bm-surface-alt border border-bm-line rounded outline-none focus:border-bm-accent"
          />
        </div>
      ) : (
        <div className="pt-2" />
      )}

      <div className="min-h-0 overflow-auto pb-4">
        {tab === 'files' && (
          <FilesView
            files={files}
            activeIndex={activeIndex}
            sdlActive={sdlActive}
            onSelectFile={onSelectFile}
            onSelectSdl={onSelectSdl}
            onAddFile={onAddFile}
            onRenameFile={onRenameFile}
            onRemoveFile={onRemoveFile}
          />
        )}

        {tab === 'explorer' && (
          <div className="px-4 font-mono text-[12px]">
            {isCompiling && filteredTypes.length === 0 && (
              <div className="text-bm-ink-muted italic py-2">Compiling…</div>
            )}
            {!isCompiling && filteredTypes.length === 0 && filter && (
              <div className="text-bm-ink-muted italic py-2">No types match "{filter}"</div>
            )}
            {!isCompiling && filteredTypes.length === 0 && !filter && (
              <div className="text-bm-ink-muted italic py-2">Schema is empty.</div>
            )}
            {filteredTypes.map((t) => (
              <TypeRow
                key={t.name}
                type={t}
                knownTypes={knownTypes}
                activeFieldKey={activeFieldKey}
                onTypeClick={onTypeClick}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
