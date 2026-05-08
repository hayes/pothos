'use client';

import Editor, { type Monaco } from '@monaco-editor/react';
import { useRef } from 'react';
import { useEditorTheme } from '@/hooks/playground/useEditorTheme';

function relaxJsonDiagnostics(monaco: Monaco): void {
  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: false,
    allowComments: true,
    schemas: [],
  });
}

interface Props {
  value: string;
  onChange: (next: string) => void;
  onRun: () => void;
}

/**
 * JSON editor for the GraphQL `contextValue`. The string is parsed at
 * run time; an empty value means "no fields" (an empty `{}` is supplied
 * to the resolver so plugins like `scope-auth` that read symbols off
 * context don't trip on `undefined`).
 */
export function ContextEditor({ value, onChange, onRun }: Props) {
  const { theme, beforeMount: registerThemes } = useEditorTheme();

  const onRunRef = useRef(onRun);
  onRunRef.current = onRun;

  return (
    <Editor
      height="100%"
      language="json"
      value={value}
      theme={theme}
      onChange={(v) => v !== undefined && onChange(v)}
      beforeMount={(monaco) => {
        registerThemes(monaco);
        relaxJsonDiagnostics(monaco);
      }}
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
        fixedOverflowWidgets: true,
      }}
    />
  );
}
