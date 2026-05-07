'use client';

import { HeadersEditor } from './HeadersEditor';
import { OperationTabs } from './OperationTabs';
import { QueryEditor } from './QueryEditor';
import { SubTabs } from './SubTabs';
import type { HeaderEntry, Operation, OperationSubTab } from './types';
import { VariablesEditor } from './VariablesEditor';

interface Props {
  operations: Operation[];
  activeIndex: number;
  subTab: OperationSubTab;
  onSelectOperation: (index: number) => void;
  onCloseOperation: (index: number) => void;
  onAddOperation: () => void;
  onSelectSubTab: (tab: OperationSubTab) => void;
  onChangeQuery: (next: string) => void;
  onChangeVariables: (next: string) => void;
  onChangeHeaders: (next: HeaderEntry[]) => void;
  onRun: () => void;
}

function variableCount(raw: string): number {
  if (!raw.trim()) {
    return 0;
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? Object.keys(parsed).length : 0;
  } catch {
    return 0;
  }
}

export function OperationPane({
  operations,
  activeIndex,
  subTab,
  onSelectOperation,
  onCloseOperation,
  onAddOperation,
  onSelectSubTab,
  onChangeQuery,
  onChangeVariables,
  onChangeHeaders,
  onRun,
}: Props) {
  const active = operations[activeIndex] ?? operations[0];

  return (
    <div className="grid grid-rows-[auto_auto_1fr] min-h-0 bg-bm-editor-bg border-b border-bm-line">
      <OperationTabs
        operations={operations}
        activeIndex={activeIndex}
        onSelect={onSelectOperation}
        onClose={onCloseOperation}
        onAdd={onAddOperation}
      />
      <SubTabs
        active={subTab}
        onSelect={onSelectSubTab}
        variableCount={variableCount(active.variables)}
        headerCount={active.headers.length}
      />
      <div className="min-h-0 overflow-hidden">
        {subTab === 'query' && (
          <QueryEditor value={active.query} onChange={onChangeQuery} onRun={onRun} />
        )}
        {subTab === 'variables' && (
          <VariablesEditor value={active.variables} onChange={onChangeVariables} onRun={onRun} />
        )}
        {subTab === 'headers' && (
          <HeadersEditor headers={active.headers} onChange={onChangeHeaders} />
        )}
      </div>
    </div>
  );
}
