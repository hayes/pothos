'use client';

import type { ExplorerType } from './introspect';

interface Props {
  type: ExplorerType;
  /** Names of types that have entries in the explorer — used to color refs as clickable. */
  knownTypes: Set<string>;
  /** Field that should be highlighted (current operation cursor). */
  activeFieldKey?: string;
  /** Click on a type ref → ask page to jump/open that type. */
  onTypeClick?: (typeName: string) => void;
}

const KIND_LABEL: Record<string, string> = {
  query: 'query',
  mutation: 'mutation',
  subscription: 'subscription',
  object: 'type',
  interface: 'interface',
};

export function TypeRow({ type, knownTypes, activeFieldKey, onTypeClick }: Props) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="font-serif text-[15px] font-medium tracking-[-0.005em] text-bm-ink">
          {type.name}
        </span>
        <span className="text-[9px] uppercase tracking-[0.1em] text-bm-ink-muted">
          {KIND_LABEL[type.kind]}
        </span>
      </div>
      <div>
        {type.fields.map((field) => {
          const key = `${type.name}.${field.name}`;
          const active = key === activeFieldKey;
          const className = `flex w-full items-baseline text-left py-0.5 pl-2.5 -ml-2.5 transition-colors border-l-2 ${
            active ? 'border-bm-accent bg-bm-surface-alt font-medium' : 'border-transparent'
          }`;
          return (
            <div key={field.name} className={className}>
              <span className="text-bm-ink">{field.name}</span>
              {field.args && <span className="text-bm-ink-muted">{field.args}</span>}
              <span className="text-bm-ink-muted mx-1">:</span>
              <FieldReturn
                returns={field.returns}
                refs={field.refs}
                knownTypes={knownTypes}
                onTypeClick={onTypeClick}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FieldReturn({
  returns,
  refs,
  knownTypes,
  onTypeClick,
}: {
  returns: string;
  refs: string[];
  knownTypes: Set<string>;
  onTypeClick?: (typeName: string) => void;
}) {
  const hasKnownRef = refs.some((r) => knownTypes.has(r));
  if (!hasKnownRef || !onTypeClick) {
    return <span className="text-bm-ink-soft">{returns}</span>;
  }
  // Render as a styled span (not interactive on its own) — the parent row's
  // onClick already handles navigation. Color signals the relation; the row
  // is the click target.
  return <span className="text-bm-accent">{returns}</span>;
}
