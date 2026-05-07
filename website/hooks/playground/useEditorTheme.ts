'use client';

import type { Monaco } from '@monaco-editor/react';
import { useTheme } from 'next-themes';
import { useCallback } from 'react';
import { pothosThemeFor, registerPothosMonacoThemes } from '../../lib/playground/monaco-theme';

interface EditorThemeBinding {
  /** Current Monaco theme name to pass to <Editor theme={...}> */
  theme: string;
  /** Pass to <Editor beforeMount={...}> so the theme is defined before
   *  Monaco creates the editor and tries to apply it. */
  beforeMount: (monaco: Monaco) => void;
}

/**
 * Returns the Monaco theme name for the current site theme plus a
 * `beforeMount` handler that registers the Pothos themes synchronously
 * before Monaco creates the editor — needed because Monaco silently
 * falls back to vs-dark if the named theme isn't defined yet.
 */
export function useEditorTheme(): EditorThemeBinding {
  const { resolvedTheme } = useTheme();
  const beforeMount = useCallback((monaco: Monaco) => {
    registerPothosMonacoThemes(monaco);
  }, []);
  return { theme: pothosThemeFor(resolvedTheme), beforeMount };
}
