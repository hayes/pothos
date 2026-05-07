'use client';

import type { OperationSubTab } from './types';

interface Props {
  active: OperationSubTab;
  onSelect: (tab: OperationSubTab) => void;
  variableCount: number;
  headerCount: number;
}

const TABS: Array<{ key: OperationSubTab; label: string }> = [
  { key: 'query', label: 'Query' },
  { key: 'variables', label: 'Variables' },
  { key: 'headers', label: 'Headers' },
];

export function SubTabs({ active, onSelect, variableCount, headerCount }: Props) {
  return (
    <div className="flex items-center px-6 h-8 gap-[18px] border-b border-bm-line bg-bm-editor-bg">
      {TABS.map((t) => {
        const count =
          t.key === 'variables' && variableCount > 0
            ? ` (${variableCount})`
            : t.key === 'headers' && headerCount > 0
              ? ` (${headerCount})`
              : '';
        return (
          <button
            type="button"
            key={t.key}
            onClick={() => onSelect(t.key)}
            className={`-mb-px py-2 text-[12px] tracking-[0.02em] border-b-[1.5px] transition-colors ${
              active === t.key
                ? 'text-bm-ink border-bm-accent'
                : 'text-bm-ink-muted border-transparent hover:text-bm-ink'
            }`}
          >
            {t.label}
            {count}
          </button>
        );
      })}
      <div className="flex-1" />
      <span className="font-mono text-[11px] text-bm-ink-muted">⌘↵ to run</span>
    </div>
  );
}
