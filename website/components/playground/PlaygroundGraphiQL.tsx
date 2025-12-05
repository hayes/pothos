'use client';

import type { Fetcher } from '@graphiql/toolkit';
import { GraphiQL } from 'graphiql';
import { graphql, printSchema, type GraphQLSchema } from 'graphql';
import 'graphiql/style.css';
import { useCallback, useMemo, useState } from 'react';
import { usePlaygroundCompiler } from '../../lib/playground/use-playground-compiler';
import { copyToClipboard, createShareableURL } from '../../lib/playground/url-state';
import { playgroundPlugins, sourcePlugin } from './graphiql-plugins';
import { PlaygroundProvider } from './PlaygroundContext';
import type { PlaygroundExample, PlaygroundFile } from './types';

interface PlaygroundGraphiQLProps {
  example: PlaygroundExample;
  height?: string;
  editable?: boolean;
}

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

export function PlaygroundGraphiQL({
  example,
  height = '600px',
  editable = true,
}: PlaygroundGraphiQLProps) {
  const [files, setFiles] = useState<PlaygroundFile[]>(example.files);
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>('idle');

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
              Run
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

        {/* GraphiQL */}
        <div className="playground-graphiql min-h-0 flex-1">
          <PlaygroundProvider
            source={mainFile?.content || ''}
            schemaSDL={compilerState.schemaSDL}
            onSourceChange={editable ? handleSourceChange : undefined}
            readOnly={!editable}
          >
            {schema ? (
              <GraphiQL
                key={schemaKey}
                fetcher={fetcher}
                schema={schema}
                defaultQuery={example.defaultQuery}
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
    </div>
  );
}
