'use client';

import { PaneHeader, type PaneTab } from '../shell/PaneHeader';
import { ResponseEditor } from './ResponseEditor';
import { ResponseStatus } from './ResponseStatus';
import { TraceWaterfall } from './TraceWaterfall';
import type { ResponsePhase, ResponseSubTab, TraceRow } from './types';

interface Props {
  phase: ResponsePhase;
  subTab: ResponseSubTab;
  onSelectSubTab: (tab: ResponseSubTab) => void;
  trace: TraceRow[];
}

export function ResponsePane({ phase, subTab, onSelectSubTab, trace }: Props) {
  const tabs: PaneTab[] = [
    {
      key: 'response',
      label: 'Response',
      active: subTab === 'response',
      onClick: () => onSelectSubTab('response'),
    },
    {
      key: 'trace',
      label: 'Trace',
      active: subTab === 'trace',
      onClick: () => onSelectSubTab('trace'),
    },
  ];

  const body = phase.kind === 'success' || phase.kind === 'error' ? phase.body : '';

  return (
    <section className="grid grid-rows-[auto_1fr] min-h-0 bg-bm-editor-bg">
      <PaneHeader tabs={tabs} meta={<ResponseStatus phase={phase} />} />
      <div className="min-h-0">
        {subTab === 'response' ? <ResponseEditor body={body} /> : <TraceWaterfall rows={trace} />}
      </div>
    </section>
  );
}
