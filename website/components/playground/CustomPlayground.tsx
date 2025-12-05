'use client';

import { GraphiQLProvider, Tooltip } from '@graphiql/react';
import '@graphiql/react/style.css';
import type { Fetcher } from '@graphiql/toolkit';
import Editor, { useMonaco } from '@monaco-editor/react';
import { graphql, GraphQLError, printSchema, type GraphQLSchema } from 'graphql';
import { useCallback, useEffect, useMemo, useState, type FC } from 'react';
import { usePlaygroundCompiler } from '../../lib/playground/use-playground-compiler';
import {
  copyToClipboard,
  createShareableURL,
  getPlaygroundStateFromURL,
  setPlaygroundStateToURL,
  type ViewMode,
} from '../../lib/playground/url-state';
import { GraphQLEditor } from './GraphQLEditor';
import type { PlaygroundExample, PlaygroundFile } from './types';

interface CustomPlaygroundProps {
  example: PlaygroundExample;
  height?: string;
  editable?: boolean;
}

function useTheme() {
  const [theme, setTheme] = useState<'vs-dark' | 'light'>('vs-dark');

  useEffect(() => {
    const updateTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setTheme(isDark ? 'vs-dark' : 'light');
    };
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return theme;
}

function createFetcher(schemaRef: { current: GraphQLSchema | null }): Fetcher {
  return async ({ query, variables, operationName }) => {
    if (!schemaRef.current) {
      return { errors: [new GraphQLError('Schema not ready')] };
    }
    return graphql({
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
  readOnly?: boolean;
}

const SourceEditor: FC<SourceEditorProps> = ({ source, onChange, readOnly }) => {
  const theme = useTheme();
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
        readOnly,
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
        folding: true,
        renderLineHighlight: 'line',
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
        padding: { top: 12, bottom: 12 },
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
  const theme = useTheme();

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
        fontSize: 13,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
        folding: true,
        renderLineHighlight: 'none',
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
        padding: { top: 12, bottom: 12 },
      }}
    />
  );
};

interface SidebarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  schemaSDL: string | null;
}

const Sidebar: FC<SidebarProps> = ({ viewMode, onViewModeChange, schemaSDL }) => {
  const [showSchema, setShowSchema] = useState(true);

  return (
    <div className="flex h-full w-12 flex-col border-l border-fd-border bg-fd-muted/30">
      <button
        type="button"
        title="Source Code (TypeScript)"
        onClick={() => onViewModeChange('code')}
        className={`flex h-10 w-full items-center justify-center transition-colors ${
          viewMode === 'code'
            ? 'bg-fd-primary/10 text-fd-primary'
            : 'text-fd-muted-foreground hover:bg-fd-muted hover:text-fd-foreground'
        }`}
      >
        <CodeIcon />
      </button>
      <button
        type="button"
        title="GraphQL Query"
        onClick={() => onViewModeChange('graphql')}
        className={`flex h-10 w-full items-center justify-center transition-colors ${
          viewMode === 'graphql'
            ? 'bg-fd-primary/10 text-fd-primary'
            : 'text-fd-muted-foreground hover:bg-fd-muted hover:text-fd-foreground'
        }`}
      >
        <GraphQLIcon />
      </button>
      <div className="my-2 border-t border-fd-border" />
      <button
        type="button"
        title="Schema SDL"
        onClick={() => setShowSchema(!showSchema)}
        className={`flex h-10 w-full items-center justify-center transition-colors ${
          showSchema
            ? 'bg-fd-primary/10 text-fd-primary'
            : 'text-fd-muted-foreground hover:bg-fd-muted hover:text-fd-foreground'
        }`}
      >
        <SchemaIcon />
      </button>

      {showSchema && (
        <div className="fixed right-12 top-0 z-50 h-full w-80 border-l border-fd-border bg-fd-background shadow-lg">
          <div className="flex h-10 items-center justify-between border-b border-fd-border px-3">
            <span className="text-sm font-medium">Schema SDL</span>
            <button
              type="button"
              onClick={() => setShowSchema(false)}
              className="text-fd-muted-foreground hover:text-fd-foreground"
            >
              ×
            </button>
          </div>
          <div className="h-[calc(100%-40px)]">
            <SchemaViewer schemaSDL={schemaSDL} />
          </div>
        </div>
      )}
    </div>
  );
};

// TypeScript code icon with angle brackets and TS
const CodeIcon: FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M4 12l4-4M4 12l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <text x="12" y="15" fontSize="8" fontWeight="bold" fill="currentColor" fontFamily="system-ui" textAnchor="middle">TS</text>
    <path d="M20 12l-4-4M20 12l-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Official GraphQL logo - hexagon with nodes
const GraphQLIcon: FC = () => (
  <svg width="18" height="18" viewBox="0 0 100 100" fill="currentColor">
    <path fillRule="evenodd" clipRule="evenodd" d="M50 6.90308L87.323 28.4515V71.5484L50 93.0968L12.677 71.5484V28.4515L50 6.90308ZM16.8647 30.8693V62.5251L44.2795 15.0414L16.8647 30.8693ZM50 13.5086L18.3975 68.2457H81.6025L50 13.5086ZM77.4148 72.4334H22.5852L50 88.2613L77.4148 72.4334ZM83.1353 62.5765L55.6831 15.0414L83.1353 30.8693V62.5765Z" />
    <circle cx="50" cy="9.3209" r="8.82" />
    <circle cx="85.2292" cy="29.6605" r="8.82" />
    <circle cx="85.2292" cy="70.3396" r="8.82" />
    <circle cx="50" cy="90.6791" r="8.82" />
    <circle cx="14.7659" cy="70.3396" r="8.82" />
    <circle cx="14.7659" cy="29.6605" r="8.82" />
  </svg>
);

// Schema/structure icon - tree diagram
const SchemaIcon: FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="6" height="6" rx="1" />
    <rect x="15" y="8" width="6" height="4" rx="1" />
    <rect x="15" y="16" width="6" height="4" rx="1" />
    <path d="M9 6h3v6h3" />
    <path d="M12 12v6h3" />
  </svg>
);

export function CustomPlayground({
  example,
  height = '600px',
  editable = true,
}: CustomPlaygroundProps) {
  // Initialize state from URL if available
  const initialUrlState = typeof window !== 'undefined' ? getPlaygroundStateFromURL() : null;

  const [files, setFiles] = useState<PlaygroundFile[]>(example.files);
  const [viewMode, setViewMode] = useState<ViewMode>(initialUrlState?.viewMode ?? 'code');
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  // Sync viewMode to URL
  useEffect(() => {
    setPlaygroundStateToURL({ files, viewMode });
  }, [files, viewMode]);

  const { state: compilerState, compile } = usePlaygroundCompiler({
    files,
    debounceMs: 500,
    autoCompile: true,
  });

  const handleSourceChange = useCallback((content: string) => {
    setFiles((prev) => prev.map((f) => (f.filename === 'schema.ts' ? { ...f, content } : f)));
  }, []);

  const handleShare = useCallback(async () => {
    const url = createShareableURL({ files, viewMode });
    const success = await copyToClipboard(url);
    setShareStatus(success ? 'copied' : 'error');
    setTimeout(() => setShareStatus('idle'), 2000);
  }, [files, viewMode]);

  const schema = compilerState.schema;
  const schemaRef = useMemo(() => ({ current: schema }), [schema]);
  schemaRef.current = schema;

  const fetcher = useMemo(() => createFetcher(schemaRef), [schemaRef]);

  const schemaKey = useMemo(() => {
    if (!schema) return 'none';
    try {
      return printSchema(schema);
    } catch {
      return String(Date.now());
    }
  }, [schema]);

  const mainFile = files.find((f) => f.filename === 'schema.ts') || files[0];

  return (
    <div
      className="not-prose my-6 overflow-hidden rounded-lg border border-fd-border"
      style={{ height }}
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-fd-border bg-fd-muted/30 px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="font-medium text-fd-foreground">{example.title}</span>
            {example.description && (
              <span className="text-sm text-fd-muted-foreground">— {example.description}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {compilerState.isCompiling && (
              <span className="text-xs text-fd-muted-foreground">Compiling...</span>
            )}
            {compilerState.error && (
              <span className="text-xs text-red-500" title={compilerState.error}>
                Error
              </span>
            )}
            {!compilerState.isCompiling && !compilerState.error && compilerState.lastCompiledAt && (
              <span className="text-xs text-green-600">✓</span>
            )}
            <button
              type="button"
              onClick={() => compile()}
              disabled={compilerState.isCompiling}
              className="rounded bg-fd-primary px-2 py-1 text-xs text-fd-primary-foreground transition-colors hover:bg-fd-primary/90 disabled:opacity-50"
            >
              Compile
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="rounded border border-fd-border bg-fd-background px-2 py-1 text-xs text-fd-foreground transition-colors hover:bg-fd-muted"
            >
              {shareStatus === 'copied' ? '✓ Copied!' : shareStatus === 'error' ? 'Error' : 'Share'}
            </button>
          </div>
        </div>

        {/* Error banner */}
        {compilerState.error && (
          <div className="border-b border-red-200 bg-red-50 px-4 py-2 dark:border-red-900 dark:bg-red-950">
            <pre className="overflow-x-auto text-xs text-red-600 dark:text-red-400">
              {compilerState.error}
            </pre>
          </div>
        )}

        {/* Main content */}
        <div className="flex min-h-0 flex-1">
          {schema ? (
            <Tooltip.Provider>
              <GraphiQLProvider
                key={schemaKey}
                fetcher={fetcher}
                schema={schema}
                defaultTabs={example.defaultQuery ? [{ query: example.defaultQuery }] : undefined}
              >
                <div className="graphiql-container flex h-full w-full">
                  <div className="flex min-h-0 flex-1 flex-col">
                    {viewMode === 'code' && (
                      <div className="flex items-center gap-2 border-b border-fd-border bg-fd-muted/20 px-3 py-1.5">
                        <span className="text-xs font-medium text-fd-muted-foreground">schema.ts</span>
                      </div>
                    )}
                    <div className="min-h-0 flex-1">
                      {viewMode === 'code' ? (
                        <SourceEditor
                          source={mainFile?.content || ''}
                          onChange={handleSourceChange}
                          readOnly={!editable}
                        />
                      ) : (
                        <GraphQLEditor />
                      )}
                    </div>
                  </div>
                  <Sidebar
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    schemaSDL={compilerState.schemaSDL}
                  />
                </div>
            </GraphiQLProvider>
          </Tooltip.Provider>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-fd-muted-foreground">
              {compilerState.isCompiling ? 'Compiling schema...' : 'Failed to compile schema'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
