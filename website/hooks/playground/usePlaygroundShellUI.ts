'use client';

import type { GraphQLSchema } from 'graphql';
import type { ReactNode } from 'react';
import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { defaultFiles, defaultOperations } from '@/app/playground/defaults';
import { useTheme } from '@/components/Providers';
import type { ConsoleLogEntry } from '@/components/playground/ConsoleDrawer/types';
import { ExamplesPicker } from '@/components/playground/ExamplesPicker/ExamplesPicker';
import { exampleMetadata } from '@/components/playground/examples';
import type {
  HeaderEntry,
  Operation,
  OperationSubTab,
} from '@/components/playground/OperationPane/types';
import type { ResponsePhase } from '@/components/playground/ResponsePane/types';
import type { OverflowItem } from '@/components/playground/Toolbar/OverflowMenu';
import type { SchemaStatus } from '@/components/playground/Toolbar/StatusPill';
import type { PlaygroundFile } from '@/components/playground/types';
import { copyToClipboard } from '@/lib/clipboard';
import type { ExtensionPanel } from '@/lib/playground/playground-panels';
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
import { useExampleBaseline, useUrlHashSync } from './useUrlSync';

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
  /** Step index whose bundle is currently fetching, if any. The
   *  StepperBar shows a spinner on this row so a slow load isn't
   *  invisible. `null` when nothing is in flight. */
  pendingStepIndex: number | null;
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
  runnerPanels: ExtensionPanel[];
  responseSubTab: string;
  setResponseSubTab: (tab: string) => void;

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
  const { theme, setTheme } = useTheme();
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
  const [responseSubTab, setResponseSubTab] = useState<string>('response');
  const [sdlActive, setSdlActive] = useState(false);

  // Example "pristine content" baseline. Lives in React state so
  // useUrlHashSync re-evaluates the moment it changes. The baseline is
  // set ONLY by `applyExampleResult` (or cleared on exit) — no effect
  // tries to derive it from state transitions, which is what
  // previously made selecting a query tab read as an "edit" and write
  // a stale hash.
  const {
    baseline,
    captureFromExample,
    resetToDefaults: resetBaseline,
  } = useExampleBaseline(defaultFiles, defaultOperations);

  // Apply an ExampleLoaderResult — push files/ops into the hook state.
  // Used for both initial example loads and step navigation.
  // `queryOverride` (optional) replaces the first operation's `query`
  // before pushing — this is how `?example=…&query=…` URLs survive the
  // race with the example's own setOperations write.
  //
  // The baseline is captured from `result` (NOT from the override-
  // adjusted state) so a `?example=…&query=…` URL counts the
  // overridden query as an edit and writes a hash on first render.
  const applyExampleResult = useCallback(
    (
      result: {
        files: PlaygroundFile[];
        operations: Operation[];
        defaultActive?: number;
      },
      queryOverride?: string,
    ) => {
      filesState.setFiles(result.files);
      // `defaultActive` lets multi-step examples open with the most
      // relevant file focused (e.g. a "relations" step focuses
      // models/user.ts). Falls back to the first file.
      const activeIndex =
        typeof result.defaultActive === 'number' &&
        result.defaultActive >= 0 &&
        result.defaultActive < result.files.length
          ? result.defaultActive
          : 0;
      filesState.setActiveIndex(activeIndex);
      const operations =
        queryOverride !== undefined && result.operations.length > 0
          ? result.operations.map((op, i) => (i === 0 ? { ...op, query: queryOverride } : op))
          : result.operations;
      opsState.setOperations(operations);
      opsState.setActiveIndex(0);
      opsState.setSubTab('query');
      opsState.markClean();
      runner.reset();
      captureFromExample(result.files, result.operations);
    },
    [filesState, opsState, runner, captureFromExample],
  );

  const { embed } = useUrlBootstrap({
    filesState,
    opsState,
    exampleLoader,
    applyExampleResult,
    setSketchName,
    captureBaseline: captureFromExample,
  });

  useUrlHashSync({
    files: filesState.files,
    operations: opsState.operations,
    activeOperationIndex: opsState.activeIndex,
    activeFileIndex: filesState.activeIndex,
    step: exampleLoader.stepIndex || undefined,
    baseline,
  });

  // `?op=<n>` (1-indexed) tracks the active query tab in search
  // params so refreshing or sharing a link restores the tab. Doesn't
  // affect the hash — selecting a tab is a navigation action, not an
  // edit. `op=1` is the implicit default and stays out of the URL.
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const url = new URL(window.location.href);
    if (opsState.activeIndex > 0) {
      url.searchParams.set('op', String(opsState.activeIndex + 1));
    } else {
      url.searchParams.delete('op');
    }
    window.history.replaceState(null, '', url.toString());
  }, [opsState.activeIndex]);

  // Theme in URL: `?theme=light` / `?theme=dark`. `system` is the
  // default and stays implicit. Read once on mount (URL > localStorage
  // > system); subsequent changes from the toolbar's theme switcher
  // mirror back to the URL so a shared link reproduces the look.
  const themeBootstrapRef = useRef(false);
  useEffect(() => {
    if (themeBootstrapRef.current) {
      return;
    }
    themeBootstrapRef.current = true;
    if (typeof window === 'undefined') {
      return;
    }
    const urlTheme = new URL(window.location.href).searchParams.get('theme');
    if (urlTheme === 'light' || urlTheme === 'dark' || urlTheme === 'system') {
      setTheme(urlTheme);
    }
  }, [setTheme]);
  useEffect(() => {
    if (!themeBootstrapRef.current) {
      return; // wait for bootstrap so we don't echo localStorage
    }
    if (typeof window === 'undefined') {
      return;
    }
    const url = new URL(window.location.href);
    if (theme === 'light' || theme === 'dark') {
      url.searchParams.set('theme', theme);
    } else {
      url.searchParams.delete('theme');
    }
    window.history.replaceState(null, '', url.toString());
  }, [theme]);

  // Sync the URL's `?example=<id>` (and optional `&step=<n>`) search
  // params when the loaded example or step changes via the picker or
  // stepper, and clear any stale hash. useUrlHashSync's baseline-tracking
  // then keeps the URL hash-free until the user actually edits —
  // so the URL stays at the short, shareable `?example=foo&step=2` form.
  const setExampleInUrl = useCallback((id: string | null, stepIndex: number | null = null) => {
    if (typeof window === 'undefined') {
      return;
    }
    const url = new URL(window.location.href);
    if (id) {
      const baseId = id.replace(/-step-\d+$/, '');
      url.searchParams.set('example', baseId);
    } else {
      url.searchParams.delete('example');
    }
    if (stepIndex !== null && stepIndex > 0) {
      // 1-indexed in the URL since the StepperBar labels are 1-based;
      // 0 (the default first step) stays implicit.
      url.searchParams.set('step', String(stepIndex + 1));
    } else {
      url.searchParams.delete('step');
    }
    url.hash = '';
    window.history.replaceState(null, '', url.toString());
  }, []);

  const handlePickExample = useCallback(
    async (id: string) => {
      setExamplesOpen(false);
      const result = await exampleLoader.load(id);
      if (result) {
        applyExampleResult(result);
        // Picking from the menu always loads step 1 by default.
        setExampleInUrl(id, 0);
      }
    },
    [exampleLoader, applyExampleResult, setExampleInUrl],
  );

  // Tracks which step index the user JUST clicked. Stays set through:
  //   1. the example-bundle fetch (`goToStep`),
  //   2. the React commit that swaps files/operations in,
  //   3. the schema recompile that the new files trigger.
  // The StepperBar reads it to spin the pending row and disable
  // clicks until everything settles, so a slow load doesn't look
  // broken.
  const [pendingStepIndex, setPendingStepIndex] = useState<number | null>(null);
  // True after we've kicked off a step load and are waiting for the
  // compiler to cycle (isCompiling true → false). Without this flag
  // the next-tick effect couldn't distinguish "compile fired because
  // of step click" from "compile fired because of unrelated edit".
  const awaitingCompileRef = useRef(false);

  const handleStep = useCallback(
    async (index: number) => {
      setPendingStepIndex(index);
      awaitingCompileRef.current = true;
      try {
        const result = await exampleLoader.goToStep(index);
        if (result && exampleLoader.loaded) {
          applyExampleResult(result);
          setExampleInUrl(exampleLoader.loaded.baseId, index);
        }
      } catch (err) {
        // Bundle fetch failed — clear the spinner so the bar isn't
        // stuck on a doomed pending state.
        setPendingStepIndex(null);
        awaitingCompileRef.current = false;
        throw err;
      }
    },
    [exampleLoader, applyExampleResult, setExampleInUrl],
  );

  // Clear `pendingStepIndex` once the compiler has actually cycled.
  // `awaitingCompileRef` gates this so unrelated compile cycles
  // (the user typing in the editor) don't prematurely clear a
  // pending step that hasn't finished its own compile yet.
  const sawCompilingRef = useRef(false);
  useEffect(() => {
    if (!awaitingCompileRef.current) {
      return;
    }
    if (compilerState.isCompiling) {
      sawCompilingRef.current = true;
      return;
    }
    if (sawCompilingRef.current) {
      sawCompilingRef.current = false;
      awaitingCompileRef.current = false;
      setPendingStepIndex(null);
    }
  }, [compilerState.isCompiling]);

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
          resetBaseline();
          runner.reset();
          setSketchName(embed ? '' : 'untitled sketch');
          // Drop the hash so useUrlHashSync doesn't write the fresh
          // defaults back into a long URL (no baseline → no writes).
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
    [compilerState.schemaSDL, embed, exampleLoader, filesState, opsState, runner, resetBaseline],
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
    pendingStepIndex,
    exitExample: () => {
      exampleLoader.exit();
      resetBaseline();
      // Clear `?example=`/`&step=` so the URL stops claiming an
      // example is active. Hash is untouched — the user keeps their
      // current edits as a manual sketch.
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('example');
        url.searchParams.delete('step');
        window.history.replaceState(null, '', url.toString());
      }
    },
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
    runnerPanels: runner.panels,
    responseSubTab,
    setResponseSubTab,

    consoleLogs: console_.logs,
    clearConsole: console_.clear,
    closeConsole: () => setConsoleOpen(false),
  };
}
