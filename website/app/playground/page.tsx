'use client';

import type { Fetcher } from '@graphiql/toolkit';
import { GraphiQL } from 'graphiql';
import { graphql, printSchema, type GraphQLSchema } from 'graphql';
import 'graphiql/style.css';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { examplesList } from '../../components/playground/examples';
import { playgroundPlugins, sourcePlugin } from '../../components/playground/graphiql-plugins';
import { PlaygroundProvider } from '../../components/playground/PlaygroundContext';
import type { PlaygroundFile } from '../../components/playground/types';
import { usePlaygroundCompiler } from '../../lib/playground/use-playground-compiler';
import {
  copyToClipboard,
  createShareableURL,
  getPlaygroundStateFromURL,
} from '../../lib/playground/url-state';

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

const DEFAULT_QUERY = `query {
  hello(name: "Pothos")
}`;

function createFetcher(schemaRef: { current: GraphQLSchema | null }): Fetcher {
  return async ({ query, variables, operationName }) => {
    if (!schemaRef.current) {
      return { errors: [{ message: 'Schema not ready' }] };
    }
    const result = await graphql({
      schema: schemaRef.current,
      source: query,
      variableValues: variables,
      operationName,
    });
    return result;
  };
}

export default function PlaygroundPage() {
  const [files, setFiles] = useState<PlaygroundFile[]>([
    { filename: 'schema.ts', content: DEFAULT_CODE },
  ]);
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;
    const urlState = getPlaygroundStateFromURL();
    if (urlState) {
      setFiles(urlState.files);
    }
    setInitialized(true);
  }, [initialized]);

  const { state: compilerState, compile } = usePlaygroundCompiler({
    files,
    debounceMs: 500,
    autoCompile: true,
  });

  const handleSourceChange = useCallback((content: string) => {
    setFiles((prev) => prev.map((f) => (f.filename === 'schema.ts' ? { ...f, content } : f)));
  }, []);

  const handleShare = useCallback(async () => {
    const url = createShareableURL({ files });
    const success = await copyToClipboard(url);
    setShareStatus(success ? 'copied' : 'error');
    setTimeout(() => setShareStatus('idle'), 2000);
  }, [files]);

  const handleReset = () => {
    setFiles([{ filename: 'schema.ts', content: DEFAULT_CODE }]);
    window.history.replaceState(null, '', '/playground');
  };

  const handleLoadExample = (exampleId: string) => {
    const example = examplesList.find((e) => e.id === exampleId);
    if (example) {
      setFiles(example.files);
      window.history.replaceState(null, '', '/playground');
    }
  };

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

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-fd-background text-fd-foreground">
        <div className="text-fd-muted-foreground">Loading playground...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-fd-background text-fd-foreground">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-fd-border px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-semibold text-fd-foreground hover:text-fd-primary">
            Pothos GraphQL
          </Link>
          <span className="text-fd-muted-foreground">/</span>
          <span className="font-medium">Playground</span>
          <select
            value=""
            onChange={(e) => handleLoadExample(e.target.value)}
            className="ml-4 rounded border border-fd-border bg-fd-background px-2 py-1 text-sm text-fd-foreground"
          >
            <option value="" disabled>
              Load example...
            </option>
            {examplesList.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.title}
              </option>
            ))}
          </select>
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
            className="rounded bg-fd-primary px-3 py-1.5 text-sm text-fd-primary-foreground transition-colors hover:bg-fd-primary/90 disabled:opacity-50"
          >
            Run
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="rounded border border-fd-border bg-fd-background px-3 py-1.5 text-sm text-fd-foreground transition-colors hover:bg-fd-muted"
          >
            {shareStatus === 'copied' ? '✓ Copied!' : shareStatus === 'error' ? 'Error' : 'Share'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="rounded border border-fd-border bg-fd-background px-3 py-1.5 text-sm text-fd-foreground transition-colors hover:bg-fd-muted"
          >
            Reset
          </button>
        </div>
      </header>

      {/* Error banner */}
      {compilerState.error && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 dark:border-red-900 dark:bg-red-950">
          <pre className="overflow-x-auto text-xs text-red-600 dark:text-red-400">
            {compilerState.error}
          </pre>
        </div>
      )}

      {/* GraphiQL */}
      <div className="playground-graphiql min-h-0 flex-1">
        <PlaygroundProvider
          source={mainFile?.content || ''}
          schemaSDL={compilerState.schemaSDL}
          onSourceChange={handleSourceChange}
          readOnly={false}
        >
          {schema ? (
            <GraphiQL
              key={schemaKey}
              fetcher={fetcher}
              schema={schema}
              defaultQuery={DEFAULT_QUERY}
              plugins={playgroundPlugins}
              visiblePlugin={sourcePlugin}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-fd-muted-foreground">
              {compilerState.isCompiling ? 'Compiling schema...' : 'Failed to compile schema'}
            </div>
          )}
        </PlaygroundProvider>
      </div>
    </div>
  );
}
