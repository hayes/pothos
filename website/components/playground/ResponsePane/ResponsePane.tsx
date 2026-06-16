'use client';

import { useEffect, useMemo } from 'react';
import type { ExtensionPanel } from '@/lib/playground/playground-panels';
import { PaneHeader, type PaneTab } from '../shell/PaneHeader';
import { PanelView } from './PanelView';
import { ResponseEditor } from './ResponseEditor';
import { ResponseStatus } from './ResponseStatus';
import type { ResponsePhase, ResponseSubTab } from './types';

interface Props {
  phase: ResponsePhase;
  subTab: ResponseSubTab;
  onSelectSubTab: (tab: ResponseSubTab) => void;
  panels: ExtensionPanel[];
}

const RESPONSE_KEY = 'response';

export function ResponsePane({ phase, subTab, onSelectSubTab, panels }: Props) {
  // De-duplicate by name in case a schema emits two panels with the
  // same `name` — last write wins, mirroring how Map insertion works.
  const orderedPanels = useMemo(() => {
    const byName = new Map<string, ExtensionPanel>();
    for (const p of panels) {
      byName.set(p.name, p);
    }
    return Array.from(byName.values());
  }, [panels]);

  // If the active sub-tab no longer exists in this run's panels (e.g.
  // user ran a query that produced no SQL while sitting on the SQL
  // tab), fall back to the response tab so the editor doesn't render
  // blank.
  useEffect(() => {
    if (subTab === RESPONSE_KEY) {
      return;
    }
    if (!orderedPanels.find((p) => p.name === subTab)) {
      onSelectSubTab(RESPONSE_KEY);
    }
  }, [orderedPanels, subTab, onSelectSubTab]);

  const tabs: PaneTab[] = [
    {
      key: RESPONSE_KEY,
      label: 'Response',
      active: subTab === RESPONSE_KEY,
      onClick: () => onSelectSubTab(RESPONSE_KEY),
    },
    ...orderedPanels.map((panel) => ({
      key: panel.name,
      label: panel.name,
      active: subTab === panel.name,
      onClick: () => onSelectSubTab(panel.name),
    })),
  ];

  const body = phase.kind === 'success' || phase.kind === 'error' ? phase.body : '';
  const activePanel = orderedPanels.find((p) => p.name === subTab);

  return (
    <section className="grid grid-rows-[auto_1fr] min-h-0 bg-bm-editor-bg">
      <PaneHeader tabs={tabs} meta={<ResponseStatus phase={phase} />} />
      <div className="min-h-0">
        {activePanel ? <PanelView panel={activePanel} /> : <ResponseEditor body={body} />}
      </div>
    </section>
  );
}
