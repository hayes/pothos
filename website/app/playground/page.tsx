'use client';

import { ConsoleDrawer } from '@/components/playground/ConsoleDrawer/ConsoleDrawer';
import { OperationPane } from '@/components/playground/OperationPane/OperationPane';
import { ResponsePane } from '@/components/playground/ResponsePane/ResponsePane';
import { SchemaEditor } from '@/components/playground/SchemaEditor/SchemaEditor';
import { SchemaSidebar } from '@/components/playground/SchemaSidebar/SchemaSidebar';
import { StepperBar } from '@/components/playground/StepperBar/StepperBar';
import { PlaygroundLayout } from '@/components/playground/shell/PlaygroundLayout';
import { Toolbar } from '@/components/playground/Toolbar/Toolbar';
import { usePlaygroundShellUI } from '@/hooks/playground/usePlaygroundShellUI';

export default function PlaygroundPage() {
  const ui = usePlaygroundShellUI();

  return (
    <div className="playground-shell grid grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)_auto] h-dvh w-full min-w-0 overflow-x-clip bg-bm-bg text-bm-ink relative">
      <div>
        <Toolbar
          embed={ui.embed}
          overlay={ui.overlay}
          sketchName={ui.sketchName}
          onSketchRename={ui.setSketchName}
          status={ui.status}
          consoleCount={ui.consoleCount}
          consoleHasErrors={ui.consoleHasErrors}
          consoleOpen={ui.consoleOpen}
          onToggleConsole={ui.toggleConsole}
          onShare={ui.onShare}
          shareLabel={ui.shareLabel}
          running={ui.running}
          onRun={ui.onRun}
          examplesOpen={ui.examplesOpen}
          onToggleExamples={ui.toggleExamples}
          examplesPicker={ui.examplesPicker}
          hasExamples={ui.hasExamples}
          overflowOpen={ui.overflowOpen}
          onToggleOverflow={ui.toggleOverflow}
          overflowItems={ui.overflowItems}
        />
        {ui.executionBlocked && (
          <div role="status" className="border-b border-bm-line bg-bm-surface-alt p-3 text-sm">
            <p>
              Review this shared code before running it. It can access this page and make network
              requests. Only run code you trust.
            </p>
            <button
              type="button"
              className="mt-2 rounded bg-bm-ink px-3 py-1.5 text-bm-bg"
              onClick={ui.allowExecution}
            >
              Trust and build schema
            </button>
          </div>
        )}
        {ui.loadedExample && ui.loadedExample.steps.length > 1 ? (
          <StepperBar
            exampleTitle={ui.loadedExample.metadata.title}
            steps={ui.loadedExample.steps}
            index={ui.stepIndex}
            pendingIndex={ui.pendingStepIndex}
            onSelect={ui.onStepSelect}
            onExit={ui.exitExample}
          />
        ) : (
          <div />
        )}

        {ui.loadedExample && (
          <aside
            aria-label="Example guide"
            className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-bm-line bg-bm-surface-alt px-4 py-2 text-sm"
          >
            <p className="min-w-0 flex-[1_1_32rem] leading-relaxed">
              {ui.loadedExample.steps.length > 1 && (
                <strong className="sm:hidden">
                  {ui.loadedExample.steps[ui.stepIndex]?.title}.{' '}
                </strong>
              )}
              {ui.loadedExample.steps[ui.stepIndex]?.description ??
                ui.loadedExample.metadata.description}
            </p>
            <div className="flex shrink-0 gap-3 text-xs">
              {ui.loadedExample.metadata.relatedDocs?.[0] && (
                <a
                  className="underline"
                  href={ui.loadedExample.metadata.relatedDocs[0]}
                  target={ui.embed ? '_parent' : undefined}
                >
                  Read the guide
                </a>
              )}
              <button
                type="button"
                className="underline"
                onClick={() => {
                  const url = new URL(window.location.href);
                  url.hash = '';
                  window.location.assign(url.toString());
                }}
              >
                Reset example
              </button>
            </div>
          </aside>
        )}
      </div>

      <PlaygroundLayout
        hideSidebar={ui.hideSidebar}
        sidebar={
          <SchemaSidebar
            files={ui.files}
            activeIndex={ui.activeFileIndex}
            sdlActive={ui.sdlActive}
            onSelectFile={ui.fileActions.selectFile}
            onSelectSdl={ui.fileActions.selectSdl}
            onAddFile={ui.fileActions.addFile}
            onRenameFile={ui.fileActions.renameFile}
            onRemoveFile={ui.fileActions.removeFile}
            schema={ui.schema}
            isCompiling={ui.isCompiling}
          />
        }
        editor={
          <SchemaEditor
            showTabs={ui.hideSidebar}
            files={ui.files}
            activeIndex={ui.activeFileIndex}
            sdlActive={ui.sdlActive}
            schemaSDL={ui.schemaSDL}
            onChange={ui.onChangeFileAt}
            onSelectFile={ui.fileActions.selectFile}
            onSelectSdl={ui.fileActions.selectSdl}
          />
        }
        ops={
          <OperationPane
            operations={ui.operations}
            activeIndex={ui.activeOperationIndex}
            subTab={ui.operationSubTab}
            onSelectOperation={ui.operationActions.setActiveIndex}
            onCloseOperation={ui.operationActions.closeOperation}
            onAddOperation={ui.operationActions.addOperation}
            onSelectSubTab={ui.operationActions.setSubTab}
            onChangeQuery={ui.operationActions.setQuery}
            onChangeVariables={ui.operationActions.setVariables}
            onChangeHeaders={ui.operationActions.setHeaders}
            onChangeContext={ui.operationActions.setContext}
            onRun={ui.onRun}
          />
        }
        response={
          <ResponsePane
            phase={ui.runnerPhase}
            subTab={ui.responseSubTab}
            onSelectSubTab={ui.setResponseSubTab}
            panels={ui.runnerPanels}
          />
        }
      />

      {ui.consoleOpen ? (
        <ConsoleDrawer logs={ui.consoleLogs} onClear={ui.clearConsole} onClose={ui.closeConsole} />
      ) : (
        <div />
      )}
    </div>
  );
}
