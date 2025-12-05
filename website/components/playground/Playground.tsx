'use client';

import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';
import { usePlaygroundCompiler } from '../../lib/playground/use-playground-compiler';
import { copyToClipboard, createShareableURL } from '../../lib/playground/url-state';
import { SchemaViewer } from './SchemaViewer';
import type { PlaygroundExample, PlaygroundFile, PlaygroundTab } from './types';

const MonacoEditor = dynamic(() => import('./MonacoEditor').then((m) => m.MonacoEditor), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-fd-muted-foreground">
      Loading editor...
    </div>
  ),
});

const GraphiQLPanel = dynamic(() => import('./GraphiQLPanel').then((m) => m.GraphiQLPanel), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-fd-muted-foreground">
      Loading GraphiQL...
    </div>
  ),
});

interface PlaygroundProps {
  example: PlaygroundExample;
  defaultTab?: PlaygroundTab;
  height?: string;
  editable?: boolean;
  liveCompile?: boolean;
  showShare?: boolean;
}

const tabs: { id: PlaygroundTab; label: string }[] = [
  { id: 'code', label: 'Code' },
  { id: 'schema', label: 'Schema' },
  { id: 'graphiql', label: 'GraphiQL' },
];

export function Playground({
  example,
  defaultTab = 'code',
  height = '500px',
  editable = true,
  liveCompile = true,
  showShare = true,
}: PlaygroundProps) {
  const [activeTab, setActiveTab] = useState<PlaygroundTab>(defaultTab);
  const [files, setFiles] = useState<PlaygroundFile[]>(example.files);
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const { state: compilerState, compile } = usePlaygroundCompiler({
    files,
    debounceMs: 500,
    autoCompile: liveCompile,
  });

  const handleContentChange = useCallback((filename: string, content: string) => {
    setFiles((prev) => prev.map((f) => (f.filename === filename ? { ...f, content } : f)));
  }, []);

  const handleShare = useCallback(async () => {
    const url = createShareableURL({ files, activeTab });
    const success = await copyToClipboard(url);
    setShareStatus(success ? 'copied' : 'error');
    setTimeout(() => setShareStatus('idle'), 2000);
  }, [files, activeTab]);

  return (
    <div
      className="not-prose my-6 overflow-hidden rounded-lg border border-fd-border bg-fd-card"
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
            {editable && liveCompile && (
              <button
                type="button"
                onClick={() => compile()}
                disabled={compilerState.isCompiling}
                className="rounded bg-fd-primary px-2 py-1 text-xs text-fd-primary-foreground transition-colors hover:bg-fd-primary/90 disabled:opacity-50"
              >
                Run
              </button>
            )}
            {showShare && (
              <button
                type="button"
                onClick={handleShare}
                className="rounded border border-fd-border bg-fd-background px-2 py-1 text-xs text-fd-foreground transition-colors hover:bg-fd-muted"
              >
                {shareStatus === 'copied' ? '✓ Copied!' : shareStatus === 'error' ? 'Error' : 'Share'}
              </button>
            )}
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

        {/* Tabs */}
        <div className="flex border-b border-fd-border bg-fd-muted/20">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-fd-primary text-fd-foreground'
                  : 'text-fd-muted-foreground hover:text-fd-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1">
          {activeTab === 'code' && (
            <MonacoEditor
              files={files}
              readOnly={!editable}
              onContentChange={handleContentChange}
            />
          )}
          {activeTab === 'schema' && <SchemaViewer schema={compilerState.schemaSDL || ''} />}
          {activeTab === 'graphiql' && (
            <GraphiQLPanel schema={compilerState.schema} defaultQuery={example.defaultQuery} />
          )}
        </div>
      </div>
    </div>
  );
}
