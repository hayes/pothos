'use client';

import { type KeyboardEvent, useId, useRef } from 'react';
import type { OperationSubTab } from './types';

interface Props {
  active: OperationSubTab;
  onSelect: (tab: OperationSubTab) => void;
  variableCount: number;
  headerCount: number;
  contextSet: boolean;
}

const TABS: Array<{ key: OperationSubTab; label: string }> = [
  { key: 'query', label: 'Query' },
  { key: 'variables', label: 'Variables' },
  { key: 'headers', label: 'Headers' },
  { key: 'context', label: 'Context' },
];

export function SubTabs({ active, onSelect, variableCount, headerCount, contextSet }: Props) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const baseId = useId();

  const focusTab = (index: number) => {
    const wrapped = (index + TABS.length) % TABS.length;
    const tab = TABS[wrapped];
    if (tab) {
      tabRefs.current[wrapped]?.focus();
      onSelect(tab.key);
    }
  };

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusTab(i + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusTab(i - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusTab(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusTab(TABS.length - 1);
    }
  };

  return (
    <div
      role="tablist"
      aria-label="Operation panes"
      className="flex items-center px-6 h-8 gap-[18px] border-b border-bm-line bg-bm-editor-bg"
    >
      {TABS.map((t, i) => {
        const count =
          t.key === 'variables' && variableCount > 0
            ? ` (${variableCount})`
            : t.key === 'headers' && headerCount > 0
              ? ` (${headerCount})`
              : t.key === 'context' && contextSet
                ? ' •'
                : '';
        const isActive = active === t.key;
        return (
          <button
            type="button"
            key={t.key}
            id={`${baseId}-tab-${t.key}`}
            role="tab"
            aria-selected={isActive}
            aria-controls={`${baseId}-panel-${t.key}`}
            tabIndex={isActive ? 0 : -1}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            onClick={() => onSelect(t.key)}
            onKeyDown={(e) => onTabKey(e, i)}
            className={`-mb-px py-2 text-[12px] tracking-[0.02em] border-b-[1.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bm-accent ${
              isActive
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
