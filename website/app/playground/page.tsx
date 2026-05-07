'use client';

import { useTheme } from '@/components/Providers';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useUrlInit, useUrlSync } from '../../hooks/playground/useUrlSync';
import { ConsoleDrawer } from '../../components/playground/ConsoleDrawer/ConsoleDrawer';
import { ExamplesPicker } from '../../components/playground/ExamplesPicker/ExamplesPicker';
import { exampleMetadata } from '../../components/playground/examples';
import { OperationPane } from '../../components/playground/OperationPane/OperationPane';
import { ResponsePane } from '../../components/playground/ResponsePane/ResponsePane';
import { SchemaEditor } from '../../components/playground/SchemaEditor/SchemaEditor';
import { SchemaSidebar } from '../../components/playground/SchemaSidebar/SchemaSidebar';
import { StepperBar } from '../../components/playground/StepperBar/StepperBar';
import type { OverflowItem } from '../../components/playground/Toolbar/OverflowMenu';
import { Toolbar } from '../../components/playground/Toolbar/Toolbar';
import { useConsoleLogs } from '../../hooks/playground/useConsoleLogs';
import { useExampleLoader } from '../../hooks/playground/useExampleLoader';
import { useKeyboardShortcuts } from '../../hooks/playground/useKeyboardShortcuts';
import { useOperations } from '../../hooks/playground/useOperations';
import { usePlaygroundFiles } from '../../hooks/playground/usePlaygroundFiles';
import { useQueryRunner } from '../../hooks/playground/useQueryRunner';
import { useSchemaStatus } from '../../hooks/playground/useSchemaStatus';
import { copyToClipboard, createShareableURL } from '../../lib/playground/url-state';
import { usePlaygroundCompiler } from '../../lib/playground/use-playground-compiler';
import { defaultFiles, defaultOperations } from './defaults';

export default function PlaygroundPage() {
  // Initial state is the deterministic defaults — both server and client
  // render the same content for the first paint. The hash-based state
  // gets applied client-side via useUrlInit below.
  const filesState = usePlaygroundFiles(defaultFiles());
  const opsState = useOperations(defaultOperations());
  const exampleLoader = useExampleLoader();
  const runner = useQueryRunner();
  const console_ = useConsoleLogs();
  const { resolvedTheme, setTheme } = useTheme();

  const { state: compilerState } = usePlaygroundCompiler({
    files: filesState.files,
    debounceMs: 500,
    autoCompile: true,
  });

  // Mirror compile-time logs into the console drawer whenever they change.
  useEffect(() => {
    console_.replaceCompile(compilerState.consoleLogs, compilerState.error);
  }, [compilerState.consoleLogs, compilerState.error, console_.replaceCompile]);

  // UI: drawers / popovers / sketch name
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [sketchName, setSketchName] = useState('untitled sketch');
  const [shareLabel, setShareLabel] = useState('Share');
  const [responseSubTab, setResponseSubTab] = useState<'response' | 'trace'>('response');
  const [sdlActive, setSdlActive] = useState(false);

  // Hydrate from `window.location.hash` once after mount. Doing this
  // here (rather than in useState init) keeps the server's first paint
  // matching the client's first paint, so React doesn't fault.
  useUrlInit((initial) => {
    if (initial.files.length > 0) {
      filesState.setFiles(initial.files);
      filesState.setActiveIndex(0);
    }
    if (initial.operations.length > 0) {
      opsState.setOperations(initial.operations);
      opsState.setActiveIndex(0);
      opsState.markClean();
    }
  });

  useUrlSync({
    files: filesState.files,
    operations: opsState.operations,
    activeOperationIndex: opsState.activeIndex,
    ready: !compilerState.isCompiling || compilerState.schema !== null,
  });

  // Apply an ExampleLoaderResult — push files/ops into the hook state.
  // Used for both initial example loads and step navigation.
  const applyExampleResult = useCallback(
    (result: { files: typeof filesState.files; operations: typeof opsState.operations }) => {
      filesState.setFiles(result.files);
      filesState.setActiveIndex(0);
      opsState.setOperations(result.operations);
      opsState.setActiveIndex(0);
      opsState.setSubTab('query');
      opsState.markClean();
      runner.reset();
    },
    [filesState, opsState, runner],
  );

  const handlePickExample = useCallback(
    async (id: string) => {
      setExamplesOpen(false);
      const result = await exampleLoader.load(id);
      if (result) applyExampleResult(result);
    },
    [exampleLoader, applyExampleResult],
  );

  const handleStep = useCallback(
    async (index: number) => {
      const result = await exampleLoader.goToStep(index);
      if (result) applyExampleResult(result);
    },
    [exampleLoader, applyExampleResult],
  );

  // Mirror the loaded example's title into the sketch name whenever it changes.
  useEffect(() => {
    if (exampleLoader.loaded) setSketchName(exampleLoader.loaded.metadata.title);
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
        queries:
          opsState.operations.length > 1
            ? opsState.operations.map((op) => ({
                title: op.name,
                query: op.query,
                variables: op.variables || undefined,
              }))
            : undefined,
        viewMode: 'graphql',
      });
      const ok = await copyToClipboard(url);
      setShareLabel(ok ? 'Copied!' : 'Copy failed');
      window.setTimeout(() => setShareLabel('Share'), 1500);
    } catch {
      setShareLabel('Copy failed');
      window.setTimeout(() => setShareLabel('Share'), 1500);
    }
  }, [filesState.files, opsState.active, opsState.operations]);

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
          setSketchName('untitled sketch');
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
            copyToClipboard(compilerState.schemaSDL).catch(() => {});
          }
        },
      },
      {
        label: 'Toggle theme',
        onSelect: () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'),
      },
    ],
    [compilerState.schemaSDL, exampleLoader, filesState, opsState, resolvedTheme, runner, setTheme],
  );

  return (
    <div className="playground-shell grid grid-rows-[auto_auto_1fr_auto] h-screen min-h-[820px] bg-bm-bg text-bm-ink relative">
      <Toolbar
        sketchName={sketchName}
        onSketchRename={setSketchName}
        status={status}
        consoleCount={console_.logs.length}
        consoleHasErrors={console_.errorCount > 0}
        consoleOpen={consoleOpen}
        onToggleConsole={() => setConsoleOpen((s) => !s)}
        onShare={handleShare}
        shareLabel={shareLabel}
        running={runner.phase.kind === 'pending'}
        onRun={handleRun}
        examplesOpen={examplesOpen}
        onToggleExamples={() => setExamplesOpen((s) => !s)}
        examplesPicker={
          examplesOpen ? (
            <ExamplesPicker
              examples={exampleMetadata}
              onPick={handlePickExample}
              onClose={() => setExamplesOpen(false)}
            />
          ) : null
        }
        overflowOpen={overflowOpen}
        onToggleOverflow={() => setOverflowOpen((s) => !s)}
        overflowItems={overflowItems}
      />

      {exampleLoader.loaded && exampleLoader.loaded.steps.length > 1 ? (
        <StepperBar
          exampleTitle={exampleLoader.loaded.metadata.title}
          steps={exampleLoader.loaded.steps}
          index={exampleLoader.stepIndex}
          onSelect={(i) => {
            handleStep(i).catch(() => {});
          }}
          onExit={exampleLoader.exit}
        />
      ) : (
        <div />
      )}

      <div className="grid grid-cols-[280px_1fr_1fr] min-h-0">
        <SchemaSidebar
          files={filesState.files}
          activeIndex={filesState.activeIndex}
          sdlActive={sdlActive}
          onSelectFile={(i) => {
            setSdlActive(false);
            filesState.setActiveIndex(i);
          }}
          onSelectSdl={() => setSdlActive(true)}
          onAddFile={() => {
            setSdlActive(false);
            filesState.addFile();
          }}
          onRenameFile={filesState.renameFile}
          onRemoveFile={filesState.removeFile}
          schema={compilerState.schema}
          schemaSDL={compilerState.schemaSDL}
          isCompiling={compilerState.isCompiling}
        />

        <SchemaEditor
          files={filesState.files}
          activeIndex={filesState.activeIndex}
          sdlActive={sdlActive}
          schemaSDL={compilerState.schemaSDL}
          onChange={(i, content) => filesState.updateAt(i, content)}
        />

        <section className="grid grid-rows-[1fr_1fr] min-w-0 min-h-0">
          <OperationPane
            operations={opsState.operations}
            activeIndex={opsState.activeIndex}
            subTab={opsState.subTab}
            onSelectOperation={opsState.setActiveIndex}
            onCloseOperation={opsState.closeOperation}
            onAddOperation={opsState.addOperation}
            onSelectSubTab={opsState.setSubTab}
            onChangeQuery={opsState.setQuery}
            onChangeVariables={opsState.setVariables}
            onChangeHeaders={opsState.setHeaders}
            onRun={handleRun}
          />
          <ResponsePane
            phase={runner.phase}
            subTab={responseSubTab}
            onSelectSubTab={setResponseSubTab}
            trace={runner.trace}
          />
        </section>
      </div>

      {consoleOpen ? (
        <ConsoleDrawer
          logs={console_.logs}
          onClear={console_.clear}
          onClose={() => setConsoleOpen(false)}
        />
      ) : (
        <div />
      )}
    </div>
  );
}
