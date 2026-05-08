'use client';

import type { ExplorerType } from './introspect';
import { TypeRow } from './TypeRow';

interface Props {
  filter: string;
  onFilterChange: (value: string) => void;
  filteredTypes: ExplorerType[];
  knownTypes: Set<string>;
  isCompiling: boolean;
}

/**
 * The Explorer tab body — renders empty/loading states and the list of
 * `TypeRow`s. The filter input lives in the parent header so the meta count
 * can stay alongside the tab switcher; this component just consumes the
 * already-filtered types.
 */
export function ExplorerView({ filteredTypes, knownTypes, isCompiling, filter }: Props) {
  return (
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
        <TypeRow key={t.name} type={t} knownTypes={knownTypes} />
      ))}
    </div>
  );
}
