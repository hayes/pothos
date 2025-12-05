'use client';

import { DOC_EXPLORER_PLUGIN } from '@graphiql/plugin-doc-explorer';
import '@graphiql/plugin-doc-explorer/style.css';
import { GraphiQLProvider, Tooltip } from '@graphiql/react';
import '@graphiql/react/style.css';
import type { Fetcher } from '@graphiql/toolkit';
import Editor, { useMonaco } from '@monaco-editor/react';
import { GraphqlPlain } from 'devicons-react';
import { GraphQLError, type GraphQLSchema, graphql } from 'graphql';
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  FileCode2,
  GitBranch,
  Home,
  Lightbulb,
  RotateCcw,
  Share2,
} from 'lucide-react';
import Link from 'next/link';
import { type FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { examplesList } from '../../components/playground/examples';
import { GraphQLEditor } from '../../components/playground/GraphQLEditor';
import type { PlaygroundFile } from '../../components/playground/types';
import {
  copyToClipboard,
  createShareableURL,
  getPlaygroundStateFromURL,
  setPlaygroundStateToURL,
  type ViewMode,
} from '../../lib/playground/url-state';
import { usePlaygroundCompiler } from '../../lib/playground/use-playground-compiler';

const DEFAULT_CODE = `import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

builder.queryType({
  fields: (t) => ({
    hello: t.string({
      args: {
        name: t.arg.string({ required: false }),
      },
      resolve: (_, args) => \`Hello, \${args.name ?? 'World'}!\`,
    }),
  }),
});

export const schema = builder.toSchema();`;

const DEFAULT_QUERY = `{
  hello(name: "Pothos")
}`;

function useAutoTheme() {
  const [theme, setTheme] = useState<'vs-dark' | 'vs'>('vs-dark');

  useEffect(() => {
    const updateTheme = () => {
      // Check for dark class first
      if (document.documentElement.classList.contains('dark')) {
        setTheme('vs-dark');
        return;
      }

      // Check for light class
      if (document.documentElement.classList.contains('light')) {
        setTheme('vs');
        return;
      }

      // Fall back to system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'vs-dark' : 'vs');
    };

    updateTheme();

    // Watch for class changes
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    // Watch for system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', updateTheme);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', updateTheme);
    };
  }, []);

  return theme;
}

function createFetcher(schemaRef: { current: GraphQLSchema | null }): Fetcher {
  return async ({ query, variables, operationName }) => {
    if (!schemaRef.current) {
      return { errors: [new GraphQLError('Schema not ready')] };
    }
    return await graphql({
      schema: schemaRef.current,
      source: query,
      variableValues: variables,
      operationName,
    });
  };
}

interface SourceEditorProps {
  source: string;
  onChange: (value: string) => void;
}

const SourceEditor: FC<SourceEditorProps> = ({ source, onChange }) => {
  const theme = useAutoTheme();
  const monaco = useMonaco();
  const [typesLoaded, setTypesLoaded] = useState(false);

  useEffect(() => {
    if (monaco && !typesLoaded) {
      import('../../lib/playground/setup-monaco').then(({ setupMonacoForPothos }) => {
        setupMonacoForPothos(monaco);
        setTypesLoaded(true);
      });
    }
  }, [monaco, typesLoaded]);

  return (
    <Editor
      height="100%"
      language="typescript"
      path="file:///playground/schema.ts"
      value={source}
      theme={theme}
      onChange={(value) => value !== undefined && onChange(value)}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
        folding: true,
        renderLineHighlight: 'line',
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
        padding: { top: 16, bottom: 16 },
        quickSuggestions: true,
        suggestOnTriggerCharacters: true,
      }}
    />
  );
};

interface SchemaViewerProps {
  schemaSDL: string | null;
}

const SchemaViewer: FC<SchemaViewerProps> = ({ schemaSDL }) => {
  const theme = useAutoTheme();

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
      theme={theme}
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

export default function PlaygroundPage() {
  const [files, setFiles] = useState<PlaygroundFile[]>([
    { filename: 'schema.ts', content: DEFAULT_CODE },
  ]);
  const [viewMode, setViewMode] = useState<ViewMode>('code');
  const [rightPanel, setRightPanel] = useState<'schema' | 'docs' | 'examples' | null>('schema');
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [initialized, setInitialized] = useState(false);
  const [schemaVersion, setSchemaVersion] = useState(0);
  const prevSchemaRef = useRef<GraphQLSchema | null>(null);

  // Initialize from URL state
  useEffect(() => {
    if (initialized) {
      return;
    }
    const urlState = getPlaygroundStateFromURL();
    if (urlState) {
      setFiles(urlState.files);
      if (urlState.viewMode) {
        setViewMode(urlState.viewMode);
      }
    }
    setInitialized(true);
  }, [initialized]);

  // Sync state to URL
  useEffect(() => {
    if (initialized) {
      setPlaygroundStateToURL({ files, viewMode });
    }
  }, [files, viewMode, initialized]);

  const { state: compilerState } = usePlaygroundCompiler({
    files,
    debounceMs: 500,
    autoCompile: true,
  });

  const handleSourceChange = useCallback((content: string) => {
    setFiles((prev) => prev.map((f) => (f.filename === 'schema.ts' ? { ...f, content } : f)));
  }, []);

  const handleShare = useCallback(async () => {
    try {
      const url = createShareableURL({ files, viewMode });
      const success = await copyToClipboard(url);
      setShareStatus(success ? 'copied' : 'error');
    } catch {
      setShareStatus('error');
    }
    setTimeout(() => setShareStatus('idle'), 2000);
  }, [files, viewMode]);

  const handleReset = () => {
    setFiles([{ filename: 'schema.ts', content: DEFAULT_CODE }]);
    window.history.replaceState(null, '', '/playground');
  };

  const handleLoadExample = (exampleId: string) => {
    const example = examplesList.find((e) => e.id === exampleId);
    if (example) {
      prevSchemaRef.current = null; // Force schema version increment on next compile
      setFiles(example.files);
      setRightPanel('schema');
      window.history.replaceState(null, '', '/playground');
    }
  };

  const schema = compilerState.schema;

  // Track schema changes by object identity
  useEffect(() => {
    if (schema && schema !== prevSchemaRef.current) {
      prevSchemaRef.current = schema;
      setSchemaVersion((v) => v + 1);
    }
  }, [schema]);

  const fetcherSchemaRef = useMemo(() => ({ current: schema }), [schema]);
  fetcherSchemaRef.current = schema;

  const fetcher = useMemo(() => createFetcher(fetcherSchemaRef), [fetcherSchemaRef]);

  const schemaKey = schema ? `schema-v${schemaVersion}` : 'none';

  const mainFile = files.find((f) => f.filename === 'schema.ts') || files[0];

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-fd-background text-fd-foreground">
        <div className="text-fd-muted-foreground">Loading playground...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-fd-background text-fd-foreground">
      {schema ? (
        <Tooltip.Provider>
          <GraphiQLProvider
            key={schemaKey}
            fetcher={fetcher}
            schema={schema}
            defaultTabs={[{ query: DEFAULT_QUERY }]}
            plugins={[DOC_EXPLORER_PLUGIN]}
          >
            <div className="graphiql-container flex min-h-0 flex-1 overflow-hidden">
              {/* Sidebar - Left side */}
              <div className="flex h-full w-14 flex-col border-r border-fd-border bg-fd-muted/30">
                {/* View modes */}
                <button
                  type="button"
                  title="Source Code (TypeScript)"
                  onClick={() => setViewMode('code')}
                  className={`flex h-12 w-full items-center justify-center transition-colors ${
                    viewMode === 'code'
                      ? 'bg-fd-primary/10 text-fd-primary'
                      : 'text-fd-muted-foreground hover:bg-fd-muted hover:text-fd-foreground'
                  }`}
                >
                  <FileCode2 size={20} />
                </button>
                <button
                  type="button"
                  title="GraphQL Query"
                  onClick={() => setViewMode('graphql')}
                  className={`flex h-12 w-full items-center justify-center transition-colors ${
                    viewMode === 'graphql'
                      ? 'bg-fd-primary/10 text-fd-primary'
                      : 'text-fd-muted-foreground hover:bg-fd-muted hover:text-fd-foreground'
                  }`}
                >
                  <GraphqlPlain size={20} color="currentColor" />
                </button>
                {/* Spacer */}
                <div className="flex-1" />

                {/* Bottom actions */}
                <div className="relative">
                  <button
                    type="button"
                    title="Copy shareable link"
                    onClick={handleShare}
                    className={`flex h-12 w-full items-center justify-center transition-colors hover:bg-fd-muted hover:text-fd-foreground ${
                      shareStatus === 'copied'
                        ? 'text-green-500'
                        : shareStatus === 'error'
                          ? 'text-red-500'
                          : 'text-fd-muted-foreground'
                    }`}
                  >
                    {shareStatus === 'copied' ? <Check size={16} /> : <Share2 size={16} />}
                  </button>
                  {shareStatus === 'copied' && (
                    <div className="absolute left-14 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-fd-popover px-2 py-1 text-xs text-fd-foreground shadow-lg">
                      Link copied!
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  title="Reset"
                  onClick={handleReset}
                  className="flex h-12 w-full items-center justify-center text-fd-muted-foreground transition-colors hover:bg-fd-muted hover:text-fd-foreground"
                >
                  <RotateCcw size={16} />
                </button>
                <div className="my-1 border-t border-fd-border" />
                {/* Home link */}
                <Link
                  href="/"
                  title="Back to Pothos Docs"
                  className="flex h-12 w-full items-center justify-center text-fd-muted-foreground transition-colors hover:bg-fd-muted hover:text-fd-foreground"
                >
                  <Home size={20} />
                </Link>
              </div>

              {/* Main editor area */}
              <div className="min-h-0 flex-1 overflow-hidden">
                {viewMode === 'code' ? (
                  <div className="graphiql-container graphiql-editor-container h-full">
                    <div className="graphiql-main h-full">
                      {/* Header spans full width */}
                      <div className="graphiql-session-header">
                        <div className="graphiql-tabs">
                          <div className="graphiql-tab graphiql-tab-active">
                            <button type="button" className="graphiql-tab-button">
                              schema.ts
                            </button>
                          </div>
                        </div>
                        {/* Status indicator */}
                        <div className="ml-auto flex items-center gap-2 pr-2">
                          {compilerState.isCompiling && (
                            <span className="text-xs text-fd-muted-foreground">Compiling...</span>
                          )}
                          {!compilerState.isCompiling &&
                            !compilerState.error &&
                            compilerState.lastCompiledAt && (
                              <span className="text-xs text-green-500">✓</span>
                            )}
                          {compilerState.error && (
                            <span className="text-xs text-red-500">Error</span>
                          )}
                        </div>
                      </div>
                      {/* Content area - full width for code editor */}
                      <div className="graphiql-content">
                        <div className="graphiql-sessions graphiql-sessions-full">
                          {/* Error banner */}
                          {compilerState.error && (
                            <div className="border-b border-red-200 bg-red-50 px-4 py-2 dark:border-red-900 dark:bg-red-950">
                              <pre className="overflow-x-auto text-xs text-red-600 dark:text-red-400">
                                {compilerState.error}
                              </pre>
                            </div>
                          )}
                          <div className="graphiql-session" style={{ flex: 1, minHeight: 0 }}>
                            <SourceEditor
                              source={mainFile?.content || ''}
                              onChange={handleSourceChange}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <GraphQLEditor />
                )}
              </div>

              {/* Vertical pull-out tab */}
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setRightPanel(rightPanel ? null : 'schema')}
                  className={`group z-10 flex h-28 w-6 flex-col items-center justify-center rounded-l-lg border border-r-0 border-fd-border bg-fd-muted/70 transition-all hover:bg-fd-muted hover:translate-x-0 ${
                    rightPanel ? '' : 'translate-x-3'
                  }`}
                  title={rightPanel ? 'Collapse panel' : 'Expand panel'}
                >
                  {rightPanel ? (
                    <ChevronRight
                      size={14}
                      className="text-fd-muted-foreground group-hover:text-fd-foreground"
                    />
                  ) : (
                    <ChevronLeft
                      size={14}
                      className="text-fd-muted-foreground group-hover:text-fd-foreground"
                    />
                  )}
                  <span
                    className="mt-1 text-fd-muted-foreground group-hover:text-fd-foreground"
                    style={{
                      writingMode: 'vertical-rl',
                      textOrientation: 'mixed',
                      fontSize: '11px',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Schema
                  </span>
                </button>
              </div>

              {/* Right Panel - toggles between schema, docs, examples */}
              {rightPanel && (
                <div
                  className={`flex h-full flex-col border-l border-fd-border bg-fd-background ${rightPanel === 'docs' ? 'graphiql-container' : ''}`}
                  style={{ width: 320 }}
                >
                  {/* Panel tabs */}
                  <div className="flex items-center border-b border-fd-border bg-fd-muted/30">
                    <button
                      type="button"
                      onClick={() => setRightPanel('schema')}
                      className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${
                        rightPanel === 'schema'
                          ? 'border-b-2 border-fd-primary text-fd-foreground'
                          : 'text-fd-muted-foreground hover:text-fd-foreground'
                      }`}
                    >
                      <GitBranch size={14} />
                      Schema
                    </button>
                    <button
                      type="button"
                      onClick={() => setRightPanel('docs')}
                      className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${
                        rightPanel === 'docs'
                          ? 'border-b-2 border-fd-primary text-fd-foreground'
                          : 'text-fd-muted-foreground hover:text-fd-foreground'
                      }`}
                    >
                      <BookOpen size={14} />
                      Docs
                    </button>
                    <button
                      type="button"
                      onClick={() => setRightPanel('examples')}
                      className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${
                        rightPanel === 'examples'
                          ? 'border-b-2 border-fd-primary text-fd-foreground'
                          : 'text-fd-muted-foreground hover:text-fd-foreground'
                      }`}
                    >
                      <Lightbulb size={14} />
                      Examples
                    </button>
                    <div className="flex-1" />
                    <button
                      type="button"
                      onClick={() => setRightPanel(null)}
                      className="px-3 py-2 text-fd-muted-foreground hover:text-fd-foreground"
                    >
                      ×
                    </button>
                  </div>

                  {/* Panel content */}
                  <div className="min-h-0 flex-1 overflow-auto">
                    {rightPanel === 'schema' && (
                      <div className="schema-viewer h-full">
                        <SchemaViewer schemaSDL={compilerState.schemaSDL} />
                      </div>
                    )}
                    {rightPanel === 'docs' && (
                      <div className="graphiql-doc-explorer h-full">
                        {DOC_EXPLORER_PLUGIN.content && <DOC_EXPLORER_PLUGIN.content />}
                      </div>
                    )}
                    {rightPanel === 'examples' && (
                      <div className="p-2">
                        {examplesList.map((example) => (
                          <button
                            key={example.id}
                            type="button"
                            onClick={() => handleLoadExample(example.id)}
                            className="w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-fd-muted"
                          >
                            <div className="font-medium text-fd-foreground">{example.title}</div>
                            {example.description && (
                              <div className="mt-0.5 text-xs text-fd-muted-foreground">
                                {example.description}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </GraphiQLProvider>
        </Tooltip.Provider>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center text-fd-muted-foreground">
          {compilerState.isCompiling ? 'Compiling schema...' : 'Failed to compile schema'}
        </div>
      )}
    </div>
  );
}
