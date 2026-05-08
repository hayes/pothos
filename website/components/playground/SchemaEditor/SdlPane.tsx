'use client';

import Editor from '@monaco-editor/react';
import { useEditorTheme } from '@/hooks/playground/useEditorTheme';

interface Props {
  schemaSDL: string | null;
}

const HEADER = `# Generated from schema.ts — do not edit
# Pothos prints this from the runtime schema.

`;

export function SdlPane({ schemaSDL }: Props) {
  const { theme: editorTheme, beforeMount: registerThemes } = useEditorTheme();

  if (!schemaSDL) {
    return (
      <div className="flex h-full items-center justify-center text-bm-ink-muted text-[13px]">
        Compiling schema…
      </div>
    );
  }

  return (
    <Editor
      height="100%"
      language="graphql"
      value={`${HEADER}${schemaSDL}`}
      theme={editorTheme}
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
        folding: false,
        renderLineHighlight: 'none',
        padding: { top: 16, bottom: 16 },
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
      }}
    />
  );
}
