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
    <div
      className={`playground-shell grid grid-rows-[auto_auto_1fr_auto] h-screen bg-bm-bg text-bm-ink relative ${
        ui.embed ? '' : 'min-h-[820px]'
      }`}
    >
      <Toolbar
        embed={ui.embed}
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
        overflowOpen={ui.overflowOpen}
        onToggleOverflow={ui.toggleOverflow}
        overflowItems={ui.overflowItems}
      />

      {ui.loadedExample && ui.loadedExample.steps.length > 1 ? (
        <StepperBar
          exampleTitle={ui.loadedExample.metadata.title}
          steps={ui.loadedExample.steps}
          index={ui.stepIndex}
          onSelect={ui.onStepSelect}
          onExit={ui.exitExample}
        />
      ) : (
        <div />
      )}

      <PlaygroundLayout
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
            files={ui.files}
            activeIndex={ui.activeFileIndex}
            sdlActive={ui.sdlActive}
            schemaSDL={ui.schemaSDL}
            onChange={ui.onChangeFileAt}
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
            trace={ui.runnerTrace}
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
