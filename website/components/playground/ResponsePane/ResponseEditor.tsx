'use client';

import Editor from '@monaco-editor/react';
import { useEditorTheme } from '../../../hooks/playground/useEditorTheme';

interface Props {
  body: string;
}

export function ResponseEditor({ body }: Props) {
  const { theme, beforeMount: registerThemes } = useEditorTheme();
  return (
    <Editor
      height="100%"
      language="json"
      value={body}
      theme={theme}
      beforeMount={registerThemes}
      options={{
        readOnly: true,
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
        folding: true,
        renderLineHighlight: 'none',
        padding: { top: 16, bottom: 16 },
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
      }}
    />
  );
}
