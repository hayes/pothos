'use client';

import Editor from '@monaco-editor/react';
import { useRef } from 'react';
import { useEditorTheme } from '@/hooks/playground/useEditorTheme';

interface Props {
  value: string;
  onChange: (next: string) => void;
  onRun: () => void;
}

export function VariablesEditor({ value, onChange, onRun }: Props) {
  const { theme, beforeMount: registerThemes } = useEditorTheme();

  // See QueryEditor — Monaco's `addCommand` only captures the onRun
  // passed at mount, so we route through a ref to read the latest one.
  const onRunRef = useRef(onRun);
  onRunRef.current = onRun;

  return (
    <Editor
      height="100%"
      language="json"
      value={value || '{\n  \n}'}
      theme={theme}
      onChange={(v) => v !== undefined && onChange(v)}
      beforeMount={registerThemes}
      onMount={(editor, monaco) => {
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
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
      }}
    />
  );
}
