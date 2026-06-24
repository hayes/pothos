'use client';

import Editor from '@monaco-editor/react';
import { useEffect, useMemo, useState } from 'react';
import { useEditorTheme } from '@/hooks/playground/useEditorTheme';
import type { ExtensionPanel, ExtensionSubPanel } from '@/lib/playground/playground-panels';

interface Props {
  panel: ExtensionPanel;
}

/**
 * Renders a single playground extension panel. When the panel has a
 * `tabs` array, a horizontal sub-tab strip switches between sub-panels;
 * otherwise the panel's flat `content` / `language` is rendered in a
 * read-only Monaco editor.
 */
export function PanelView({ panel }: Props) {
  if (panel.tabs && panel.tabs.length > 0) {
    return <SubTabsPanel panel={panel} />;
  }
  return <CodeView content={panel.content ?? ''} language={panel.language ?? 'text'} />;
}

function SubTabsPanel({ panel }: { panel: ExtensionPanel }) {
  const tabs = panel.tabs ?? [];
  const [activeKey, setActiveKey] = useState<string>(() => tabs[0]?.name ?? '');

  // Reset the active sub-tab when the panel's tab set changes (new run
  // produces a fresh `panels` array, often with different names).
  const _keys = useMemo(() => tabs.map((t) => t.name).join('|'), [tabs]);
  useEffect(() => {
    if (!tabs.find((t) => t.name === activeKey)) {
      setActiveKey(tabs[0]?.name ?? '');
    }
  }, [activeKey, tabs]);

  const active: ExtensionSubPanel | undefined = tabs.find((t) => t.name === activeKey) ?? tabs[0];

  return (
    <div className="grid grid-rows-[auto_1fr] min-h-0 h-full">
      <div
        role="tablist"
        aria-label={`${panel.name} sub-tabs`}
        className="flex items-center gap-4 px-6 h-8 border-b border-bm-line overflow-x-auto"
      >
        {tabs.map((tab) => {
          const isActive = tab.name === active?.name;
          return (
            <button
              type="button"
              key={tab.name}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveKey(tab.name)}
              className={`text-[11px] py-1 -mb-px border-b-[1.5px] whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bm-accent ${
                isActive
                  ? 'text-bm-ink border-bm-accent'
                  : 'text-bm-ink-muted border-transparent hover:text-bm-ink'
              }`}
            >
              {tab.name}
            </button>
          );
        })}
      </div>
      <div className="min-h-0">
        {active && <CodeView content={active.content} language={active.language} />}
      </div>
    </div>
  );
}

function CodeView({ content, language }: { content: string; language: string }) {
  const { theme, beforeMount: registerThemes } = useEditorTheme();
  return (
    <Editor
      height="100%"
      language={monacoLanguage(language)}
      value={content}
      theme={theme}
      beforeMount={registerThemes}
      options={{
        readOnly: true,
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
        folding: true,
        renderLineHighlight: 'none',
        padding: { top: 16, bottom: 16 },
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
      }}
    />
  );
}

// Map our panel `language` tags onto Monaco's built-in language IDs.
// `text` falls back to plaintext; unknown values are passed through
// (Monaco silently treats unknown languages as plaintext).
function monacoLanguage(language: string): string {
  switch (language) {
    case 'text':
      return 'plaintext';
    default:
      return language;
  }
}
