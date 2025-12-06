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
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  Download,
  FileCode2,
  GitBranch,
  Home,
  Lightbulb,
  RotateCcw,
  Share2,
  Sparkles,
  Terminal,
} from 'lucide-react';
import Link from 'next/link';
import { type FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConsolePanel } from '../../components/playground/ConsolePanel';
import { examples as examplesList, getExample } from '../../components/playground/examples';
import { GraphQLEditor } from '../../components/playground/GraphQLEditor';
import type { PlaygroundFile } from '../../components/playground/types';
import { captureConsoleAsync } from '../../lib/playground/console-capture';
import { generateSchemaKey } from '../../lib/playground/hash-utils';
import { clearSchemaCache } from '../../lib/playground/schema-cache';
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

function createFetcher(
  schemaRef: { current: GraphQLSchema | null },
  onConsoleLogs: (
    logs: Array<{ type: 'log' | 'warn' | 'error' | 'info'; args: unknown[] }>,
  ) => void,
): Fetcher {
  return async ({ query, variables, operationName }) => {
    // Capture schema reference to prevent race conditions
    // where schemaRef.current could become null between check and use
    const schema = schemaRef.current;

    if (!schema) {
      return { errors: [new GraphQLError('Schema not ready')] };
    }

    // Use safe console capture utility
    const { result, logs } = await captureConsoleAsync(async () => {
      return await graphql({
        schema, // Use captured schema reference (guaranteed non-null)
        source: query,
        variableValues: variables,
        operationName,
      });
    });

    // Send captured logs to the parent
    if (logs.length > 0) {
      onConsoleLogs(logs);
    }

    return result;
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
  const editorRef = useRef<
    Parameters<NonNullable<Parameters<typeof Editor>[0]['onMount']>>[0] | null
  >(null);

  useEffect(() => {
    if (monaco && !typesLoaded) {
      import('../../lib/playground/setup-monaco').then(({ setupMonacoForPothos }) => {
        setupMonacoForPothos(monaco);
        setTypesLoaded(true);
      });
    }
  }, [monaco, typesLoaded]);

  // Load plugin types when source code changes
  useEffect(() => {
    if (monaco && typesLoaded && source) {
      import('../../lib/playground/setup-monaco').then(({ loadPluginTypes }) => {
        loadPluginTypes(source);
      });
    }
  }, [monaco, typesLoaded, source]);

  // Expose format function globally
  useEffect(() => {
    if (editorRef.current) {
      (window as typeof window & { __monacoFormatHandler?: () => void }).__monacoFormatHandler =
        () => {
          editorRef.current?.getAction('editor.action.formatDocument')?.run();
        };
    }
  }, []);

  return (
    <Editor
      height="100%"
      language="typescript"
      path="file:///playground/schema.ts"
      value={source}
      theme={theme}
      onChange={(value) => value !== undefined && onChange(value)}
      onMount={(editor) => {
        editorRef.current = editor;
      }}
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
        scrollbar: {
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
          vertical: 'visible',
          horizontal: 'visible',
        },
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
        <div className="text-center">
          <div className="text-sm">Compiling schema...</div>
        </div>
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
  const [isEmbedMode, setIsEmbedMode] = useState(false);
  const [leftPanel, setLeftPanel] = useState<'docs' | 'examples' | null>(null);
  const [showBottomPanel, setShowBottomPanel] = useState(false);
  const [bottomPanelTab, setBottomPanelTab] = useState<'schema' | 'console'>('console');
  const [showGraphQLBottomPanel, setShowGraphQLBottomPanel] = useState(false);
  const [graphQLBottomPanelTab, setGraphQLBottomPanelTab] = useState<
    'variables' | 'schema' | 'console'
  >('variables');
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [initialized, setInitialized] = useState(false);
  const prevSchemaRef = useRef<GraphQLSchema | null>(null);
  const [queryConsoleLogs, setQueryConsoleLogs] = useState<
    Array<{ type: 'log' | 'warn' | 'error' | 'info'; args: unknown[]; timestamp: number }>
  >([]);
  const [currentQuery, setCurrentQuery] = useState<string>(DEFAULT_QUERY);
  const [currentVariables, setCurrentVariables] = useState<string>('');

  // Initialize from URL (hash-based state or query parameters for backward compatibility)
  useEffect(() => {
    if (initialized) {
      return;
    }

    async function initializePlayground() {
      // First check for hash-based state (new format)
      const urlState = getPlaygroundStateFromURL();
      if (urlState) {
        setFiles(urlState.files);
        if (urlState.viewMode) {
          setViewMode(urlState.viewMode);
        }
        if (urlState.query) {
          setCurrentQuery(urlState.query);
        }
        if (urlState.variables) {
          setCurrentVariables(urlState.variables);
        }
        setInitialized(true);
        return;
      }

      // Fallback to query parameters for backward compatibility and special modes
      const params = new URLSearchParams(window.location.search);
      const exampleId = params.get('example');
      const codeParam = params.get('code');
      const queryParam = params.get('query');
      const embedParam = params.get('embed') || params.get('overlay');

      // Check for embed/overlay mode
      if (embedParam === 'true') {
        setIsEmbedMode(true);
      }

      if (exampleId) {
        // Load example from registry asynchronously
        const example = await getExample(exampleId);
        if (example) {
          setFiles(example.files);
          setCurrentQuery(queryParam ? atob(decodeURIComponent(queryParam)) : example.defaultQuery);
          setViewMode(queryParam ? 'graphql' : 'code');
        }
      } else if (codeParam) {
        // Load custom code from parameter
        try {
          const decodedCode = decodeURIComponent(atob(codeParam));
          setFiles([{ filename: 'schema.ts', content: decodedCode }]);
          if (queryParam) {
            setCurrentQuery(atob(decodeURIComponent(queryParam)));
            setViewMode('graphql');
          }
        } catch (err) {
          console.error('[Playground] Failed to decode code parameter:', err);
        }
      }

      setInitialized(true);
    }

    initializePlayground();
  }, [initialized]);

  // Sync state to URL
  useEffect(() => {
    if (initialized) {
      setPlaygroundStateToURL({
        files,
        viewMode,
        query: currentQuery !== DEFAULT_QUERY ? currentQuery : undefined,
        variables: currentVariables || undefined,
      });
    }
  }, [files, viewMode, currentQuery, currentVariables, initialized]);

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
      const url = createShareableURL({
        files,
        viewMode,
        query: currentQuery !== DEFAULT_QUERY ? currentQuery : undefined,
        variables: currentVariables || undefined,
      });
      const result = await copyToClipboard(url);

      if (result.success) {
        setShareStatus('copied');
      } else {
        setShareStatus('error');
        console.error('[Share] Failed to copy:', result.error);
      }
    } catch (err) {
      setShareStatus('error');
      console.error('[Share] Unexpected error:', err);
    }
    setTimeout(() => setShareStatus('idle'), 2000);
  }, [files, viewMode, currentQuery, currentVariables]);

  const handleReset = () => {
    setFiles([{ filename: 'schema.ts', content: DEFAULT_CODE }]);
    setCurrentQuery(DEFAULT_QUERY);
    setCurrentVariables('');
    window.history.replaceState(null, '', '/playground');
  };

  const handleQueryChange = useCallback((query: string, variables?: string) => {
    setCurrentQuery(query);
    setCurrentVariables(variables || '');
  }, []);

  const handleLoadExample = async (exampleId: string) => {
    const example = await getExample(exampleId);
    if (example) {
      prevSchemaRef.current = null; // Force schema version increment on next compile
      setCurrentQuery(example.defaultQuery); // Set the query for defaultTabs
      setFiles(example.files); // This will trigger schema recompile and key change

      // Open schema panel based on view mode and screen size
      if (viewMode === 'graphql') {
        // In GraphQL view, always open bottom panel with schema
        setGraphQLBottomPanelTab('schema');
        setShowGraphQLBottomPanel(true);
      } else if (window.innerWidth < 1280) {
        // In code editor on small screens, open bottom panel with schema
        setBottomPanelTab('schema');
        setShowBottomPanel(true);
      }

      window.history.replaceState(null, '', '/playground');
    }
  };

  const schema = compilerState.schema;

  // Track schema changes by object identity
  useEffect(() => {
    if (schema && schema !== prevSchemaRef.current) {
      prevSchemaRef.current = schema;
      // Clear query logs when schema changes
      setQueryConsoleLogs([]);
    }
  }, [schema]);

  const fetcherSchemaRef = useMemo(() => ({ current: schema }), [schema]);
  fetcherSchemaRef.current = schema;

  const handleQueryConsoleLogs = useCallback(
    (logs: Array<{ type: 'log' | 'warn' | 'error' | 'info'; args: unknown[] }>) => {
      const timestampedLogs = logs.map((log) => ({
        ...log,
        timestamp: Date.now(),
      }));
      setQueryConsoleLogs((prev) => [...prev, ...timestampedLogs]);
    },
    [],
  );

  const fetcher = useMemo(
    () => createFetcher(fetcherSchemaRef, handleQueryConsoleLogs),
    [fetcherSchemaRef, handleQueryConsoleLogs],
  );

  // Create a hash of schema SDL for GraphiQL's localStorage key
  // Using DJB2 hash algorithm for better distribution and performance
  const schemaKey = useMemo(() => {
    return generateSchemaKey(compilerState.schemaSDL);
  }, [compilerState.schemaSDL]);

  // Track previous schema key to clean up old data without destroying all GraphiQL state
  const prevSchemaKeyRef = useRef<string>('none');

  // Clear GraphiQL localStorage for previous schema when schema changes
  // This preserves user settings while cleaning up old tabs/history
  useEffect(() => {
    if (schemaKey !== 'none' && prevSchemaKeyRef.current !== schemaKey) {
      const prevKey = prevSchemaKeyRef.current;

      // Only clear localStorage entries for the previous schema
      // This approach preserves GraphiQL settings and other schemas
      if (prevKey !== 'none') {
        const keysToRemove: string[] = [];

        // Find all keys belonging to the previous schema
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          // GraphiQL uses keys like "graphiql:tabState" - we clear all to reset state
          // but we could be more selective by only clearing tabs/history
          if (key?.startsWith('graphiql:')) {
            keysToRemove.push(key);
          }
        }

        // Remove old data
        for (const key of keysToRemove) {
          localStorage.removeItem(key);
        }

        if (keysToRemove.length > 0) {
          console.log(
            `[Playground] Cleaned up ${keysToRemove.length} localStorage entries for schema change`,
          );
        }
      }

      prevSchemaKeyRef.current = schemaKey;
    }
  }, [schemaKey]);

  const mainFile = files.find((f) => f.filename === 'schema.ts') || files[0];

  // Combine schema and query console logs
  const allConsoleLogs = useMemo(
    () =>
      [...compilerState.consoleLogs, ...queryConsoleLogs].sort((a, b) => a.timestamp - b.timestamp),
    [compilerState.consoleLogs, queryConsoleLogs],
  );

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
            defaultTabs={[{ query: currentQuery }]}
            plugins={[DOC_EXPLORER_PLUGIN]}
            shouldPersistHeaders={false}
          >
            <div className="graphiql-container flex min-h-0 flex-1 overflow-hidden">
              {/* Left Sidebar - Narrow icon bar (hidden in embed mode) */}
              {!isEmbedMode && (
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

                  <div className="my-2 border-t border-fd-border" />

                  {/* Panel toggles */}
                  <button
                    type="button"
                    title="Documentation"
                    onClick={() => setLeftPanel(leftPanel === 'docs' ? null : 'docs')}
                    className={`flex h-12 w-full items-center justify-center transition-colors ${
                      leftPanel === 'docs'
                        ? 'bg-fd-primary/10 text-fd-primary'
                        : 'text-fd-muted-foreground hover:bg-fd-muted hover:text-fd-foreground'
                    }`}
                  >
                    <BookOpen size={18} />
                  </button>
                  <button
                    type="button"
                    title="Examples"
                    onClick={() => setLeftPanel(leftPanel === 'examples' ? null : 'examples')}
                    className={`flex h-12 w-full items-center justify-center transition-colors ${
                      leftPanel === 'examples'
                        ? 'bg-fd-primary/10 text-fd-primary'
                        : 'text-fd-muted-foreground hover:bg-fd-muted hover:text-fd-foreground'
                    }`}
                  >
                    <Lightbulb size={18} />
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
              )}

              {/* Left Panel - Docs, Examples, Console */}
              {leftPanel && (
                <div
                  className={`flex h-full flex-col border-r border-fd-border bg-fd-background ${leftPanel === 'docs' ? 'graphiql-container' : ''}`}
                  style={{ width: 320 }}
                >
                  <div className="flex items-center justify-between border-b border-fd-border bg-fd-muted/30 px-3 py-2">
                    <span className="text-sm font-medium text-fd-foreground">
                      {leftPanel === 'docs' && 'Documentation'}
                      {leftPanel === 'examples' && 'Examples'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLeftPanel(null)}
                      className="text-fd-muted-foreground hover:text-fd-foreground"
                    >
                      ×
                    </button>
                  </div>

                  <div className="min-h-0 flex-1 overflow-auto">
                    {leftPanel === 'docs' && (
                      <div className="graphiql-doc-explorer h-full">
                        {DOC_EXPLORER_PLUGIN.content && <DOC_EXPLORER_PLUGIN.content />}
                      </div>
                    )}
                    {leftPanel === 'examples' && (
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

              {/* Main editor area */}
              <div className="min-h-0 flex-1 overflow-hidden">
                {/* Code editor - keep mounted but hide with CSS */}
                <div
                  className="graphiql-container graphiql-editor-container flex h-full flex-col"
                  style={{ display: viewMode === 'code' ? 'flex' : 'none' }}
                >
                  <div className="graphiql-main flex min-h-0 flex-1 flex-col">
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
                        {compilerState.error && <span className="text-xs text-red-500">Error</span>}
                      </div>
                    </div>
                    {/* Content area - split view with code editor and SDL */}
                    <div className="graphiql-content flex min-h-0 flex-1">
                      {/* Left side - Code editor */}
                      <div className="graphiql-sessions flex min-h-0 flex-1 flex-col overflow-hidden rounded-tr-lg">
                        {/* Error banner */}
                        {compilerState.error && (
                          <div className="border-b border-red-200 bg-red-50 px-4 py-2 dark:border-red-900 dark:bg-red-950">
                            <pre className="overflow-x-auto text-xs text-red-600 dark:text-red-400">
                              {compilerState.error}
                            </pre>
                          </div>
                        )}
                        <div
                          className="graphiql-session relative"
                          style={{ flex: 1, minHeight: 0 }}
                        >
                          <SourceEditor
                            source={mainFile?.content || ''}
                            onChange={handleSourceChange}
                          />
                          {/* Floating toolbar */}
                          <div className="graphiql-toolbar">
                            <button
                              type="button"
                              className="graphiql-toolbar-button"
                              onClick={() => {
                                const handler = (
                                  window as typeof window & { __monacoFormatHandler?: () => void }
                                ).__monacoFormatHandler;
                                if (handler) {
                                  handler();
                                }
                              }}
                              title="Format code (Shift-Alt-F)"
                            >
                              <Sparkles size={16} />
                            </button>
                            <button
                              type="button"
                              className="graphiql-toolbar-button"
                              onClick={async () => {
                                const result = await copyToClipboard(mainFile?.content || '');
                                if (!result.success) {
                                  console.error('[Playground] Failed to copy code:', result.error);
                                }
                              }}
                              title="Copy code"
                            >
                              <Copy size={16} />
                            </button>
                            <button
                              type="button"
                              className="graphiql-toolbar-button"
                              onClick={async () => {
                                await clearSchemaCache();
                                console.log('[Playground] Schema cache cleared');
                              }}
                              title="Clear compilation cache"
                            >
                              <Database size={16} />
                            </button>
                            <div className="graphiql-toolbar-divider" />
                            <button
                              type="button"
                              className="graphiql-toolbar-button"
                              onClick={async () => {
                                const url = createShareableURL({
                                  files,
                                  query: currentQuery,
                                  variables: currentVariables,
                                  viewMode,
                                });
                                const result = await copyToClipboard(url);
                                if (result.success) {
                                  console.log('[Playground] URL copied to clipboard');
                                } else {
                                  console.error('[Playground] Failed to copy URL:', result.error);
                                }
                              }}
                              title="Copy shareable URL"
                            >
                              <Share2 size={16} />
                            </button>
                            <button
                              type="button"
                              className="graphiql-toolbar-button"
                              onClick={() => {
                                if (!compilerState.schemaSDL) {
                                  return;
                                }
                                const blob = new Blob([compilerState.schemaSDL], {
                                  type: 'text/plain',
                                });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = 'schema.graphql';
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                              }}
                              title="Download schema SDL"
                              disabled={!compilerState.schemaSDL}
                            >
                              <Download size={16} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Right side - Schema SDL split view (hidden on small screens, shown in bottom panel instead) */}
                      <div
                        className="hidden flex-col border-l border-fd-border xl:flex"
                        style={{ width: 400 }}
                      >
                        <SchemaViewer schemaSDL={compilerState.schemaSDL} />
                      </div>
                    </div>

                    {/* Bottom panel toggle and content */}
                    <div className="flex min-h-0 flex-col">
                      <div className="graphiql-editor-tools">
                        <div className="graphiql-editor-tools-tabs">
                          {/* Show Schema SDL tab only on small screens where the split view is hidden */}
                          <button
                            type="button"
                            className={`graphiql-editor-tools-tab xl:hidden ${showBottomPanel && bottomPanelTab === 'schema' ? 'graphiql-editor-tools-tab-active' : ''}`}
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
                        {bottomPanelTab === 'schema' && (
                          <div className="schema-viewer flex-1">
                            <SchemaViewer schemaSDL={compilerState.schemaSDL} />
                          </div>
                        )}
                        {bottomPanelTab === 'console' && <ConsolePanel messages={allConsoleLogs} />}
                      </div>
                    </div>
                  </div>
                </div>

                {/* GraphQL query builder - keep mounted but hide with CSS */}
                <div
                  className="h-full"
                  style={{ display: viewMode === 'graphql' ? 'block' : 'none' }}
                >
                  <GraphQLEditor
                    schemaSDL={compilerState.schemaSDL}
                    consoleLogs={allConsoleLogs}
                    showBottomPanel={showGraphQLBottomPanel}
                    setShowBottomPanel={setShowGraphQLBottomPanel}
                    bottomPanelTab={graphQLBottomPanelTab}
                    setBottomPanelTab={setGraphQLBottomPanelTab}
                    onQueryChange={handleQueryChange}
                  />
                </div>
              </div>
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
