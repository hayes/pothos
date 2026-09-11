'use client';

import Editor from '@monaco-editor/react';
import { useEffect, useRef } from 'react';
import { useEditorTheme } from '@/hooks/playground/useEditorTheme';
import { setQueryCursor } from '@/lib/playground/active-query-cursor';

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
  const cursorCleanup = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      cursorCleanup.current?.();
      setQueryCursor(null);
    },
    [],
  );

  return (
    <Editor
      height="100%"
      language="graphql"
      value={value}
      theme={theme}
      onChange={(v) => v !== undefined && onChange(v)}
      beforeMount={registerThemes}
      onMount={(editor, monaco) => {
        const updateCursor = () => {
          const model = editor.getModel();
          const position = editor.getPosition();
          setQueryCursor(model && position ? model.getOffsetAt(position) : null);
        };
        updateCursor();
        const listener = editor.onDidChangeCursorPosition(updateCursor);
        cursorCleanup.current = () => listener.dispose();
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => onRunRef.current());
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
        scrollbar: {
          alwaysConsumeMouseWheel: false,
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
        },
      }}
    />
  );
}
