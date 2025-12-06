'use client';

import {
  ExecuteButton,
  QueryEditor,
  ResponseEditor,
  ToolbarButton,
  useGraphiQL,
  useGraphiQLActions,
  VariableEditor,
} from '@graphiql/react';
import { BracesIcon, ChevronDown, ChevronUp, Copy, GitBranch, Plus, Sparkles, Terminal, X } from 'lucide-react';
import { type FC, useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { ConsolePanel } from './ConsolePanel';

const ResponsePlaceholder: FC = () => (
  <div className="flex h-full items-center justify-center">
    <div className="text-center opacity-50">
      <div className="mb-2 text-4xl">▷</div>
      <div className="text-sm">Click play to run your query</div>
    </div>
  </div>
);

interface SchemaViewerProps {
  schemaSDL: string | null;
}

const SchemaViewer: FC<SchemaViewerProps> = ({ schemaSDL }) => {
  if (!schemaSDL) {
    return (
      <div className="flex h-full items-center justify-center text-fd-muted-foreground">
        Compiling schema...
      </div>
    );
  }

  return (
    <Editor
      height="100%"
      language="graphql"
      value={schemaSDL}
      theme="vs-dark"
      options={{
        readOnly: true,
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'off',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
        folding: false,
        renderLineHighlight: 'none',
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
        padding: { top: 16, bottom: 16 },
      }}
    />
  );
};

interface GraphQLEditorProps {
  schemaSDL: string | null;
  consoleLogs: Array<{ type: 'log' | 'warn' | 'error' | 'info'; args: unknown[]; timestamp: number }>;
  showBottomPanel: boolean;
  setShowBottomPanel: (show: boolean) => void;
  bottomPanelTab: 'variables' | 'schema' | 'console';
  setBottomPanelTab: (tab: 'variables' | 'schema' | 'console') => void;
  onQueryChange?: (query: string, variables?: string) => void;
}

export const GraphQLEditor: FC<GraphQLEditorProps> = ({
  schemaSDL,
  consoleLogs,
  showBottomPanel,
  setShowBottomPanel,
  bottomPanelTab,
  setBottomPanelTab,
  onQueryChange,
}) => {
  const [hasExecuted, setHasExecuted] = useState(false);

  // Use GraphiQL's built-in tab management
  const { tabs, activeTabIndex, isFetching } = useGraphiQL((state) => ({
    tabs: state.tabs,
    activeTabIndex: state.activeTabIndex,
    isFetching: state.isFetching,
  }));

  // Track query changes for URL state
  useEffect(() => {
    if (onQueryChange && tabs[activeTabIndex]) {
      const activeTab = tabs[activeTabIndex];
      onQueryChange(activeTab.query || '', activeTab.variables || '');
    }
  }, [tabs, activeTabIndex, onQueryChange]);

  const { addTab, changeTab, closeTab, copyQuery, prettifyEditors } = useGraphiQLActions();

  useEffect(() => {
    if (isFetching) {
      setHasExecuted(true);
    }
  }, [isFetching]);

  const handleCloseTab = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length > 1) {
      closeTab(index);
    }
  };

  return (
    <div className="graphiql-container graphiql-editor-container flex h-full flex-col">
      {/* Main content area with rounded corners */}
      <div className="graphiql-main flex min-h-0 flex-1 flex-col">
        {/* Shared header that spans both panels */}
        <div className="graphiql-session-header">
          <div className="graphiql-tabs" role="tablist" aria-label="Select active operation">
            {tabs.map((tab, index) => (
              <div
                key={tab.id}
                role="tab"
                tabIndex={0}
                aria-selected={index === activeTabIndex}
                className={`graphiql-tab ${index === activeTabIndex ? 'graphiql-tab-active' : ''}`}
              >
                <button
                  type="button"
                  className="graphiql-tab-button"
                  onClick={() => changeTab(index)}
                >
                  {tab.title}
                </button>
                {tabs.length > 1 && (
                  <button
                    type="button"
                    className="graphiql-tab-close"
                    onClick={(e) => handleCloseTab(index, e)}
                    aria-label="Close tab"
                  >
                    <X size={10} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="graphiql-tab-add"
              onClick={() => addTab()}
              aria-label="New tab"
            >
              <Plus size={16} />
            </button>
          </div>
          {/* GraphiQL branding - right side of header */}
          <a
            href="https://github.com/graphql/graphiql"
            target="_blank"
            rel="noopener noreferrer"
            className="graphiql-logo"
          >
            Graph<em>i</em>QL
          </a>
        </div>

        {/* Content area below header */}
        <div className="graphiql-content">
          {/* Query side with background */}
          <div className="graphiql-sessions overflow-hidden rounded-tr-lg">
            <div className="graphiql-session" role="tabpanel">
              <div className="graphiql-editors">
                {/* Query Editor with floating toolbar */}
                <div className="graphiql-query-editor-wrapper">
                  <section className="graphiql-query-editor" aria-label="Query Editor">
                    <QueryEditor />
                  </section>

                  {/* Floating toolbar */}
                  <div className="graphiql-toolbar">
                    <ExecuteButton />
                    <ToolbarButton
                      label="Prettify query (Shift-Ctrl-P)"
                      onClick={() => prettifyEditors()}
                    >
                      <Sparkles size={16} />
                    </ToolbarButton>
                    <ToolbarButton label="Copy query" onClick={() => copyQuery()}>
                      <Copy size={16} />
                    </ToolbarButton>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Response side - no background, shows main container background */}
          <div className="graphiql-response">
            {!hasExecuted && !isFetching && <ResponsePlaceholder />}
            <div
              className={
                hasExecuted || isFetching
                  ? 'graphiql-response-result'
                  : 'graphiql-response-result-hidden'
              }
            >
              <ResponseEditor className="graphiql-result-window" />
            </div>
          </div>
        </div>

        {/* Bottom panel toggle and content */}
        <div className="graphiql-editor-tools">
          <div className="graphiql-editor-tools-tabs">
            <button
              type="button"
              className={`graphiql-editor-tools-tab ${showBottomPanel && bottomPanelTab === 'variables' ? 'graphiql-editor-tools-tab-active' : ''}`}
              onClick={() => {
                if (showBottomPanel && bottomPanelTab === 'variables') {
                  setShowBottomPanel(false);
                } else {
                  setBottomPanelTab('variables');
                  setShowBottomPanel(true);
                }
              }}
            >
              <BracesIcon size={14} className="mr-1.5" />
              Variables
            </button>
            <button
              type="button"
              className={`graphiql-editor-tools-tab ${showBottomPanel && bottomPanelTab === 'schema' ? 'graphiql-editor-tools-tab-active' : ''}`}
              onClick={() => {
                if (showBottomPanel && bottomPanelTab === 'schema') {
                  setShowBottomPanel(false);
                } else {
                  setBottomPanelTab('schema');
                  setShowBottomPanel(true);
                }
              }}
            >
              <GitBranch size={14} className="mr-1.5" />
              Schema SDL
            </button>
            <button
              type="button"
              className={`graphiql-editor-tools-tab ${showBottomPanel && bottomPanelTab === 'console' ? 'graphiql-editor-tools-tab-active' : ''}`}
              onClick={() => {
                if (showBottomPanel && bottomPanelTab === 'console') {
                  setShowBottomPanel(false);
                } else {
                  setBottomPanelTab('console');
                  setShowBottomPanel(true);
                }
              }}
            >
              <Terminal size={14} className="mr-1.5" />
              Console
            </button>
          </div>
          <button
            type="button"
            className="graphiql-editor-tools-toggle"
            onClick={() => setShowBottomPanel(!showBottomPanel)}
            aria-label={showBottomPanel ? 'Hide panel' : 'Show panel'}
          >
            {showBottomPanel ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>

        {/* Bottom panel - Keep mounted but hide with CSS */}
        <div
          className="border-t border-fd-border"
          style={{
            display: showBottomPanel ? 'flex' : 'none',
            height: showBottomPanel ? '40%' : 0,
            minHeight: showBottomPanel ? '200px' : 0,
            flexDirection: 'column',
          }}
          aria-hidden={!showBottomPanel}
        >
          {/* Variables - Keep mounted but hide with CSS */}
          <section
            className="graphiql-editor-tool"
            aria-label="Query Variables"
            style={{ display: bottomPanelTab === 'variables' ? 'flex' : 'none', flex: 1 }}
          >
            <VariableEditor />
          </section>
          {/* Schema - Keep mounted but hide with CSS */}
          <div
            className="schema-viewer flex-1"
            style={{ display: bottomPanelTab === 'schema' ? 'flex' : 'none' }}
          >
            <SchemaViewer schemaSDL={schemaSDL} />
          </div>
          {/* Console - Keep mounted but hide with CSS */}
          <div style={{ display: bottomPanelTab === 'console' ? 'flex' : 'none', flex: 1 }}>
            <ConsolePanel messages={consoleLogs} />
          </div>
        </div>
      </div>
    </div>
  );
};
