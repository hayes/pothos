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
import { ChevronDown, Copy, Plus, Sparkles, X } from 'lucide-react';
import { type FC, useEffect, useState } from 'react';

const ResponsePlaceholder: FC = () => (
  <div className="flex h-full items-center justify-center">
    <div className="text-center opacity-50">
      <div className="mb-2 text-4xl">▷</div>
      <div className="text-sm">Click play to run your query</div>
    </div>
  </div>
);

export const GraphQLEditor: FC = () => {
  const [showVariables, setShowVariables] = useState(false);
  const [hasExecuted, setHasExecuted] = useState(false);

  // Use GraphiQL's built-in tab management
  const { tabs, activeTabIndex, isFetching } = useGraphiQL((state) => ({
    tabs: state.tabs,
    activeTabIndex: state.activeTabIndex,
    isFetching: state.isFetching,
  }));

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
    <div className="graphiql-container graphiql-editor-container">
      {/* Main content area with rounded corners */}
      <div className="graphiql-main">
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
          <div className="graphiql-sessions">
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

                {/* Variables/Headers section */}
                <div className="graphiql-editor-tools">
                  <div className="graphiql-editor-tools-tabs">
                    <button
                      type="button"
                      className={`graphiql-editor-tools-tab ${showVariables ? 'graphiql-editor-tools-tab-active' : ''}`}
                      onClick={() => setShowVariables(!showVariables)}
                    >
                      Variables
                    </button>
                  </div>
                  <button
                    type="button"
                    className="graphiql-editor-tools-toggle"
                    onClick={() => setShowVariables(!showVariables)}
                    aria-label={showVariables ? 'Hide variables' : 'Show variables'}
                  >
                    <ChevronDown
                      size={16}
                      className={`transition-transform duration-200 ${showVariables ? 'rotate-180' : ''}`}
                    />
                  </button>
                </div>

                {/* Variables Panel */}
                {showVariables && (
                  <section className="graphiql-variables-editor" aria-label="Variables">
                    <VariableEditor />
                  </section>
                )}
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
      </div>
    </div>
  );
};
