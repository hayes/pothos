'use client';

import type { Monaco } from '@monaco-editor/react';
import { useTheme } from '@/components/Providers';
import { useCallback, useEffect, useState } from 'react';
import { PaletteEditor } from '../../components/theme-editor/PaletteEditor';
import { MODE_PRESETS, type Mode } from '../../components/theme-editor/palettes';
import { PreviewSample } from '../../components/theme-editor/PreviewSample';
import { SAMPLES } from '../../components/theme-editor/samples';
import {
  definePaletteTheme,
  type EditorBaseColors,
  type PaletteSlots,
  registerPothosMonacoThemes,
} from '../../lib/playground/monaco-theme';

const PREVIEW_THEME = 'pothos-theme-editor-preview';

export default function ThemeEditorPage() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<Mode>('dark');
  const [palette, setPalette] = useState<PaletteSlots>(MODE_PRESETS.dark.palette);
  const [base, setBase] = useState<EditorBaseColors>(MODE_PRESETS.dark.base);
  const [monaco, setMonaco] = useState<Monaco | null>(null);
  const [copied, setCopied] = useState(false);

  // After mount, sync the initial mode to the site's resolved theme.
  // Doing this in an effect avoids a hydration mismatch — the server
  // can't know what the client's next-themes resolved to.
  useEffect(() => {
    setMounted(true);
    const initial: Mode = resolvedTheme === 'light' ? 'light' : 'dark';
    setMode(initial);
    setPalette(MODE_PRESETS[initial].palette);
    setBase(MODE_PRESETS[initial].base);
  }, [resolvedTheme]);

  // Re-define the preview theme on every palette/base/mode change.
  useEffect(() => {
    if (!monaco) return;
    definePaletteTheme(monaco, PREVIEW_THEME, palette, base, MODE_PRESETS[mode].inheritFrom);
    monaco.editor.setTheme(PREVIEW_THEME);
  }, [monaco, palette, base, mode]);

  const handleBeforeMount = useCallback((m: Monaco) => {
    registerPothosMonacoThemes(m);
    setMonaco(m);
  }, []);

  const switchMode = (next: Mode) => {
    setMode(next);
    setPalette(MODE_PRESETS[next].palette);
    setBase(MODE_PRESETS[next].base);
  };

  const handleCopyJSON = async () => {
    const out = { name: 'My Pothos Theme', mode, base, palette };
    try {
      await navigator.clipboard.writeText(JSON.stringify(out, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore clipboard failures
    }
  };

  return (
    <div className="grid grid-cols-[320px_1fr] h-screen min-h-[820px] bg-bm-bg text-bm-ink">
      <PaletteEditor
        palette={palette}
        base={base}
        mode={mode}
        onPaletteChange={setPalette}
        onBaseChange={setBase}
      />

      <main className="grid grid-rows-[auto_1fr] min-h-0">
        <header className="flex items-center px-6 h-12 border-b border-bm-line bg-bm-bg gap-3">
          <span className="font-serif text-[18px] tracking-[-0.01em]">Theme editor</span>
          {mounted && (
            <span className="text-bm-ink-muted text-[12px]">
              Live preview · {mode} base
            </span>
          )}

          <div className="ml-2 inline-flex rounded border border-bm-line overflow-hidden text-[12px]">
            {(['light', 'dark'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`px-3 py-1.5 transition-colors ${
                  mode === m
                    ? 'bg-bm-ink text-bm-bg'
                    : 'text-bm-ink-soft hover:bg-bm-surface-alt'
                }`}
              >
                {m === 'light' ? 'Light' : 'Dark'}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => switchMode(mode)}
            title="Reset to preset"
            className="text-[12px] px-3 py-1.5 rounded border border-bm-line text-bm-ink-soft hover:bg-bm-surface-alt"
          >
            Reset
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
