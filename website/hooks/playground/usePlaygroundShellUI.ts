'use client';

import type { GraphQLSchema } from 'graphql';
import type { ReactNode } from 'react';
import { createElement, useCallback, useEffect, useMemo, useState } from 'react';
import { defaultFiles, defaultOperations } from '@/app/playground/defaults';
import type { ConsoleLogEntry } from '@/components/playground/ConsoleDrawer/types';
import { ExamplesPicker } from '@/components/playground/ExamplesPicker/ExamplesPicker';
import { exampleMetadata } from '@/components/playground/examples';
import type {
  HeaderEntry,
  Operation,
  OperationSubTab,
} from '@/components/playground/OperationPane/types';
import type { ResponsePhase, TraceRow } from '@/components/playground/ResponsePane/types';
import type { OverflowItem } from '@/components/playground/Toolbar/OverflowMenu';
import type { SchemaStatus } from '@/components/playground/Toolbar/StatusPill';
import type { PlaygroundFile } from '@/components/playground/types';
import { copyToClipboard } from '@/lib/clipboard';
import { createShareableURL } from '@/lib/playground/url-state';
import { useConsoleLogs } from './useConsoleLogs';
import type { LoadedExample } from './useExampleLoader';
import { useExampleLoader } from './useExampleLoader';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useOperations } from './useOperations';
import { usePlaygroundCompiler } from './usePlaygroundCompiler';
import { usePlaygroundFiles } from './usePlaygroundFiles';
import { useQueryRunner } from './useQueryRunner';
import { useSchemaStatus } from './useSchemaStatus';
import { useUrlBootstrap } from './useUrlBootstrap';
import { useUrlSync } from './useUrlSync';

/**
 * File-related action setters consumed by the SchemaSidebar. Grouping
 * them flattens the page's prop spread.
 */
export interface SchemaSidebarActions {
  selectFile: (index: number) => void;
  selectSdl: () => void;
  addFile: () => void;
  renameFile: (index: number, filename: string) => boolean;
  removeFile: (index: number) => void;
}

export interface OperationPaneActions {
  setActiveIndex: (index: number) => void;
  closeOperation: (index: number) => void;
  addOperation: () => void;
  setSubTab: (tab: OperationSubTab) => void;
  setQuery: (next: string) => void;
  setVariables: (next: string) => void;
  setHeaders: (next: HeaderEntry[]) => void;
  setContext: (next: string) => void;
}

export interface PlaygroundShellUI {
  // Toolbar inputs
  embed: boolean;
  sketchName: string;
  setSketchName: (next: string) => void;
  status: SchemaStatus;
  consoleCount: number;
  consoleHasErrors: boolean;
  consoleOpen: boolean;
  toggleConsole: () => void;
  onShare: () => void;
  shareLabel: string;
  running: boolean;
  onRun: () => void;
  examplesOpen: boolean;
  toggleExamples: () => void;
  examplesPicker: ReactNode;
  overflowOpen: boolean;
  toggleOverflow: () => void;
  overflowItems: OverflowItem[];

  // Stepper inputs
  loadedExample: LoadedExample | null;
  stepIndex: number;
  exitExample: () => void;
  /** Wraps `goToStep` and pipes any error into the console drawer. */
  onStepSelect: (index: number) => void;

  // Schema sidebar inputs
  files: PlaygroundFile[];
  activeFileIndex: number;
  sdlActive: boolean;
  fileActions: SchemaSidebarActions;
  schema: GraphQLSchema | null;
  schemaSDL: string | null;
  isCompiling: boolean;

  // Editor inputs
  onChangeFileAt: (index: number, content: string) => void;

  // Operation pane inputs
  operations: Operation[];
  activeOperationIndex: number;
  operationSubTab: OperationSubTab;
  operationActions: OperationPaneActions;

  // Response pane inputs
  runnerPhase: ResponsePhase;
  runnerTrace: TraceRow[];
  responseSubTab: 'response' | 'trace';
  setResponseSubTab: (tab: 'response' | 'trace') => void;

  // Console drawer inputs
  consoleLogs: ConsoleLogEntry[];
  clearConsole: () => void;
  closeConsole: () => void;
}

/**
 * Single coordinator hook for the playground page. Owns all local UI
 * state (drawers, picker, sketch name, share label, response sub-tab,
 * sdl-active), the URL bootstrap, every imperative handler the page
 * fires, and the two effects that mirror compiler outputs into the
 * console drawer + monaco-graphql.
 *
 * The page itself becomes a thin layout composition over the returned
 * surface — no hooks, no handlers, no effects beyond what JSX needs.
 */
export function usePlaygroundShellUI(): PlaygroundShellUI {
  const filesState = usePlaygroundFiles(defaultFiles());
  const opsState = useOperations(defaultOperations());
  const exampleLoader = useExampleLoader();
  const runner = useQueryRunner();
  const console_ = useConsoleLogs();

  const { state: compilerState } = usePlaygroundCompiler({
    files: filesState.files,
    debounceMs: 500,
    autoCompile: true,
  });

  // Mirror compile-time logs into the console drawer whenever they change.
  useEffect(() => {
    console_.replaceCompile(compilerState.consoleLogs, compilerState.error);
  }, [compilerState.consoleLogs, compilerState.error, console_.replaceCompile]);

  // Push the latest compiled schema into monaco-graphql so the query
  // editor's autocomplete/hover/diagnostics reflect what the user just
  // built. Lazy-loaded so the language worker doesn't sit in the
  // initial bundle.
  useEffect(() => {
    const schema = compilerState.schema;
    if (!schema) {
      return;
    }
    let cancelled = false;
    import('@/lib/playground/setup-monaco-graphql')
      .then(({ setGraphQLSchema }) => {
        if (cancelled) {
          return;
        }
        setGraphQLSchema(schema);
      })
      .catch((err) => {
        // monaco-graphql is best-effort — autocomplete/diagnostics
        // degrade gracefully if the lazy chunk fails to load. Log so
        // it's visible in devtools.
        import('@/lib/playground/logger').then(({ monacoLogger }) => {
          monacoLogger.warn('setGraphQLSchema failed:', err);
        });
      });
    return () => {
      cancelled = true;
    };
  }, [compilerState.schema]);

  // UI: drawers / popovers / sketch name. The default `untitled sketch`
  // is the placeholder for the rename input on the standalone page;
  // in embed mode the URL bootstrap clears it so we never show the
  // placeholder inside the iframe (the example title that mirrors in
  // via the loader is what users actually see).
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [sketchName, setSketchName] = useState('untitled sketch');
  const [shareLabel, setShareLabel] = useState('Share');
  const [responseSubTab, setResponseSubTab] = useState<'response' | 'trace'>('response');
  const [sdlActive, setSdlActive] = useState(false);

  // Apply an ExampleLoaderResult — push files/ops into the hook state.
  // Used for both initial example loads and step navigation.
  // `queryOverride` (optional) replaces the first operation's `query`
  // before pushing — this is how `?example=…&query=…` URLs survive the
  // race with the example's own setOperations write.
  const applyExampleResult = useCallback(
    (result: { files: PlaygroundFile[]; operations: Operation[] }, queryOverride?: string) => {
      filesState.setFiles(result.files);
      filesState.setActiveIndex(0);
      const operations =
        queryOverride !== undefined && result.operations.length > 0
          ? result.operations.map((op, i) => (i === 0 ? { ...op, query: queryOverride } : op))
          : result.operations;
      opsState.setOperations(operations);
      opsState.setActiveIndex(0);
      opsState.setSubTab('query');
      opsState.markClean();
      runner.reset();
    },
    [filesState, opsState, runner],
  );

  const { embed } = useUrlBootstrap({
    filesState,
    opsState,
    exampleLoader,
    applyExampleResult,
    setSketchName,
  });

  useUrlSync({
    files: filesState.files,
    operations: opsState.operations,
    activeOperationIndex: opsState.activeIndex,
    activeFileIndex: filesState.activeIndex,
    step: exampleLoader.stepIndex || undefined,
    ready: !compilerState.isCompiling || compilerState.schema !== null,
  });

  const handlePickExample = useCallback(
    async (id: string) => {
      setExamplesOpen(false);
      const result = await exampleLoader.load(id);
      if (result) {
        applyExampleResult(result);
      }
    },
    [exampleLoader, applyExampleResult],
  );

  const handleStep = useCallback(
    async (index: number) => {
      const result = await exampleLoader.goToStep(index);
      if (result) {
        applyExampleResult(result);
      }
    },
    [exampleLoader, applyExampleResult],
  );

  // Mirror the loaded example's title into the sketch name whenever it changes.
  useEffect(() => {
    if (exampleLoader.loaded) {
      setSketchName(exampleLoader.loaded.metadata.title);
    }
  }, [exampleLoader.loaded]);

  const status = useSchemaStatus({
    state: compilerState,
    onErrorClick: () => setConsoleOpen(true),
  });

  const handleRun = useCallback(async () => {
    const result = await runner.run({
      schema: compilerState.schema,
      query: opsState.active.query,
      variables: opsState.active.variables,
      context: opsState.active.context,
    });
    if (result.logs.length > 0) {
      console_.push(result.logs, 'query');
    }
    opsState.markClean();
  }, [runner, compilerState.schema, opsState, console_]);

  useKeyboardShortcuts({ onRun: handleRun });

  const handleShare = useCallback(async () => {
    try {
      const url = createShareableURL({
        files: filesState.files,
        query: opsState.active.query,
        variables: opsState.active.variables || undefined,
        context: opsState.active.context || undefined,
        queries:
          opsState.operations.length > 1
            ? opsState.operations.map((op) => ({
                title: op.name,
                query: op.query,
                variables: op.variables || undefined,
                context: op.context || undefined,
              }))
            : undefined,
        activeFileIndex: filesState.activeIndex,
        step: exampleLoader.stepIndex || undefined,
        viewMode: 'graphql',
      });
      const ok = await copyToClipboard(url);
      setShareLabel(ok ? 'Copied!' : 'Copy failed');
      window.setTimeout(() => setShareLabel('Share'), 1500);
    } catch {
      setShareLabel('Copy failed');
      window.setTimeout(() => setShareLabel('Share'), 1500);
    }
  }, [
    filesState.files,
    filesState.activeIndex,
    opsState.active,
    opsState.operations,
    exampleLoader.stepIndex,
  ]);

  const overflowItems = useMemo<OverflowItem[]>(
    () => [
      {
        label: 'Restore defaults',
        onSelect: () => {
          filesState.setFiles(defaultFiles());
          opsState.setOperations(defaultOperations());
          opsState.setActiveIndex(0);
          exampleLoader.exit();
          runner.reset();
          setSketchName(embed ? '' : 'untitled sketch');
          // Drop the hash so `useUrlSync` doesn't immediately re-encode
          // the freshly-restored defaults back into a long URL.
          if (typeof window !== 'undefined') {
            window.history.replaceState(
              null,
              '',
              window.location.pathname + window.location.search,
            );
          }
        },
      },
      {
        label: 'Format document',
        shortcut: '⌥⇧F',
        onSelect: () => {
          const fmt = (window as Window & { __monacoFormatHandler?: () => void })
            .__monacoFormatHandler;
          fmt?.();
        },
      },
      {
        label: 'Copy generated SDL',
        onSelect: () => {
          if (compilerState.schemaSDL) {
            copyToClipboard(compilerState.schemaSDL).then(() => {});
          }
        },
      },
    ],
    [compilerState.schemaSDL, embed, exampleLoader, filesState, opsState, runner],
  );

  // Stepper -> any error from goToStep gets surfaced to the console drawer.
  const onStepSelect = useCallback(
    (i: number) => {
      handleStep(i).catch((err) => {
        console_.push([{ type: 'error', args: [String(err)], timestamp: Date.now() }], 'compile');
      });
    },
    [handleStep, console_],
  );

  const fileActions = useMemo<SchemaSidebarActions>(
    () => ({
      selectFile: (i) => {
        setSdlActive(false);
        filesState.setActiveIndex(i);
      },
      selectSdl: () => setSdlActive(true),
      addFile: () => {
        setSdlActive(false);
        filesState.addFile();
      },
      renameFile: filesState.renameFile,
      removeFile: filesState.removeFile,
    }),
    [filesState],
  );

  const operationActions = useMemo<OperationPaneActions>(
    () => ({
      setActiveIndex: opsState.setActiveIndex,
      closeOperation: opsState.closeOperation,
      addOperation: opsState.addOperation,
      setSubTab: opsState.setSubTab,
      setQuery: opsState.setQuery,
      setVariables: opsState.setVariables,
      setHeaders: opsState.setHeaders,
      setContext: opsState.setContext,
    }),
    [opsState],
  );

  // Render the picker once so page.tsx doesn't duplicate the JSX glue.
  const examplesPicker = examplesOpen
    ? createElement(ExamplesPicker, {
        examples: exampleMetadata,
        onPick: handlePickExample,
        onClose: () => setExamplesOpen(false),
      })
    : null;

  return {
    embed,
    sketchName,
    setSketchName,
    status,
    consoleCount: console_.logs.length,
    consoleHasErrors: console_.errorCount > 0,
    consoleOpen,
    toggleConsole: () => setConsoleOpen((s) => !s),
    onShare: handleShare,
    shareLabel,
    running: runner.phase.kind === 'pending',
    onRun: handleRun,
    examplesOpen,
    toggleExamples: () => setExamplesOpen((s) => !s),
    examplesPicker,
    overflowOpen,
    toggleOverflow: () => setOverflowOpen((s) => !s),
    overflowItems,

    loadedExample: exampleLoader.loaded,
    stepIndex: exampleLoader.stepIndex,
    exitExample: exampleLoader.exit,
    onStepSelect,

    files: filesState.files,
    activeFileIndex: filesState.activeIndex,
    sdlActive,
    fileActions,
    schema: compilerState.schema,
    schemaSDL: compilerState.schemaSDL,
    isCompiling: compilerState.isCompiling,

    onChangeFileAt: filesState.updateAt,

    operations: opsState.operations,
    activeOperationIndex: opsState.activeIndex,
    operationSubTab: opsState.subTab,
    operationActions,

    runnerPhase: runner.phase,
    runnerTrace: runner.trace,
    responseSubTab,
    setResponseSubTab,

    consoleLogs: console_.logs,
    clearConsole: console_.clear,
    closeConsole: () => setConsoleOpen(false),
  };
}
