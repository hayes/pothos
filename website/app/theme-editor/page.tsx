'use client';

import type { Monaco } from '@monaco-editor/react';
import { useTheme } from 'next-themes';
import { useCallback, useEffect, useState } from 'react';
import { PaletteEditor } from '../../components/theme-editor/PaletteEditor';
import { PreviewSample } from '../../components/theme-editor/PreviewSample';
import { SAMPLES } from '../../components/theme-editor/samples';
import {
  CUTTING_PALETTE_PRESET,
  definePaletteTheme,
  type EditorBaseColors,
  FOREST_PALETTE_PRESET,
  type PaletteSlots,
  registerPothosMonacoThemes,
} from '../../lib/playground/monaco-theme';

const PREVIEW_THEME = 'pothos-theme-editor-preview';

const FOREST_BASE: EditorBaseColors = {
  background: '#142019',
  foreground: '#e8efe2',
  lineNumber: '#3a4c40',
  lineNumberActive: '#8aa890',
  selection: '#284032',
  cursor: '#e8c08a',
};

const CUTTING_BASE: EditorBaseColors = {
  background: '#fbfaf5',
  foreground: '#1a201b',
  lineNumber: '#c8c4b8',
  lineNumberActive: '#7a8076',
  selection: '#e3e8d6',
  cursor: '#3d6b3a',
};

export default function ThemeEditorPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';

  const [palette, setPalette] = useState<PaletteSlots>(
    isDark ? FOREST_PALETTE_PRESET : CUTTING_PALETTE_PRESET,
  );
  const [base, setBase] = useState<EditorBaseColors>(isDark ? FOREST_BASE : CUTTING_BASE);
  const [monaco, setMonaco] = useState<Monaco | null>(null);
  const [copied, setCopied] = useState(false);

  // Re-define the preview theme on every palette/base change. Monaco
  // accepts re-definition of the same theme name; existing editors using
  // it pick up the new colors after a setTheme().
  useEffect(() => {
    if (!monaco) return;
    definePaletteTheme(monaco, PREVIEW_THEME, palette, base, isDark ? 'vs-dark' : 'vs');
    monaco.editor.setTheme(PREVIEW_THEME);
  }, [monaco, palette, base, isDark]);

  // First PreviewSample uses this to capture Monaco; subsequent samples
  // share the same Monaco instance the loader returns.
  const handleBeforeMount = useCallback((m: Monaco) => {
    registerPothosMonacoThemes(m);
    setMonaco(m);
  }, []);

  const loadPreset = (which: 'forest' | 'cutting') => {
    if (which === 'forest') {
      setPalette(FOREST_PALETTE_PRESET);
      setBase(FOREST_BASE);
    } else {
      setPalette(CUTTING_PALETTE_PRESET);
      setBase(CUTTING_BASE);
    }
  };

  const handleCopyJSON = async () => {
    const out = { name: 'My Pothos Theme', base, palette };
    try {
      await navigator.clipboard.writeText(JSON.stringify(out, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // fall back: do nothing — UI only flips on success
    }
  };

  return (
    <div className="grid grid-cols-[320px_1fr] h-screen min-h-[820px] bg-bm-bg text-bm-ink">
      <PaletteEditor
        palette={palette}
        base={base}
        onPaletteChange={setPalette}
        onBaseChange={setBase}
      />

      <main className="grid grid-rows-[auto_1fr] min-h-0">
        <header className="flex items-center px-6 h-12 border-b border-bm-line bg-bm-bg gap-3">
          <span className="font-serif text-[18px] tracking-[-0.01em]">Theme editor</span>
          <span className="text-bm-ink-muted text-[12px]">
            Live preview · {isDark ? 'dark' : 'light'} base
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => loadPreset('cutting')}
            className="text-[12px] px-3 py-1.5 rounded border border-bm-line text-bm-ink-soft hover:bg-bm-surface-alt"
          >
            Load Cutting
          </button>
          <button
            type="button"
            onClick={() => loadPreset('forest')}
            className="text-[12px] px-3 py-1.5 rounded border border-bm-line text-bm-ink-soft hover:bg-bm-surface-alt"
          >
            Load Forest
          </button>
          <button
            type="button"
            onClick={handleCopyJSON}
            className="text-[12px] px-3 py-1.5 rounded font-medium bg-bm-ink text-bm-bg hover:opacity-90"
          >
            {copied ? 'Copied!' : 'Copy JSON'}
          </button>
        </header>

        <div className="overflow-auto px-6 py-6 grid gap-4 min-h-0">
          {SAMPLES.map((s, i) => (
            <PreviewSample
              key={s.language}
              sample={s}
              themeName={PREVIEW_THEME}
              beforeMount={i === 0 ? handleBeforeMount : undefined}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
