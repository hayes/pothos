'use client';

import Editor from '@monaco-editor/react';
import { useRef } from 'react';
import { useEditorTheme } from '../../../hooks/playground/useEditorTheme';

interface Props {
  value: string;
  onChange: (next: string) => void;
  onRun: () => void;
}

export function QueryEditor({ value, onChange, onRun }: Props) {
  const { theme, beforeMount: registerThemes } = useEditorTheme();

  // Monaco's `addCommand` registers a single handler that captures
  // whatever `onRun` was passed at mount time. The page recreates
  // `handleRun` whenever `compilerState.schema` updates, so a frozen
  // closure means Cmd+Enter executes against the schema snapshot from
  // first mount (typically null). Funnel through a ref so the command
  // always reads the latest callback.
  const onRunRef = useRef(onRun);
  onRunRef.current = onRun;

  return (
    <Editor
      height="100%"
      language="graphql"
      value={value}
      theme={theme}
      onChange={(v) => v !== undefined && onChange(v)}
      beforeMount={registerThemes}
      onMount={(editor, monaco) => {
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () =>
          onRunRef.current(),
        );
      }}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
        padding: { top: 16, bottom: 16 },
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
      }}
    />
  );
}
