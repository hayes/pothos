import {
  CUTTING_PALETTE_PRESET,
  type EditorBaseColors,
  FOREST_PALETTE_PRESET,
  type PaletteSlots,
} from '@/lib/playground/monaco-theme';

/**
 * Editor base colors for the two known presets — match the values in
 * lib/playground/themes/{forest-dark,cutting-light}.json so a "Load
 * preset" reproduces the bundled theme exactly.
 */
export const FOREST_BASE: EditorBaseColors = {
  background: '#142019',
  foreground: '#e8efe2',
  lineNumber: '#3a4c40',
  lineNumberActive: '#8aa890',
  selection: '#284032',
  cursor: '#e8c08a',
};

export const CUTTING_BASE: EditorBaseColors = {
  background: '#fbfaf5',
  foreground: '#1a201b',
  lineNumber: '#c8c4b8',
  lineNumberActive: '#7a8076',
  selection: '#e3e8d6',
  cursor: '#3d6b3a',
};

export type Mode = 'light' | 'dark';

export interface ModePreset {
  mode: Mode;
  inheritFrom: 'vs' | 'vs-dark';
  palette: PaletteSlots;
  base: EditorBaseColors;
}

export const MODE_PRESETS: Record<Mode, ModePreset> = {
  light: {
    mode: 'light',
    inheritFrom: 'vs',
    palette: CUTTING_PALETTE_PRESET,
    base: CUTTING_BASE,
  },
  dark: {
    mode: 'dark',
    inheritFrom: 'vs-dark',
    palette: FOREST_PALETTE_PRESET,
    base: FOREST_BASE,
  },
};

/**
 * Site palette swatches — exposed in the color picker as quick-picks so
 * users can grab the same colors the rest of the design uses.
 *
 * Names are display labels, not token names; the leading section split
 * just helps organize the popover.
 */
export interface PaletteSwatch {
  name: string;
  hex: string;
}

export interface PaletteGroup {
  label: string;
  swatches: PaletteSwatch[];
}

const LIGHT_GROUPS: PaletteGroup[] = [
  {
    label: 'Paper chrome',
    swatches: [
      { name: 'bg', hex: 'f7f6f1' },
      { name: 'surface', hex: 'ffffff' },
      { name: 'surfaceAlt', hex: 'efece4' },
      { name: 'ink', hex: '1a201b' },
      { name: 'inkSoft', hex: '3b4239' },
      { name: 'inkMuted', hex: '6f7268' },
      { name: 'line', hex: 'dcd8cc' },
      { name: 'lineSoft', hex: 'e8e4d8' },
    ],
  },
  {
    label: 'Cutting syntax',
    swatches: [
      { name: 'editorBg', hex: 'fbfaf5' },
      { name: 'comment', hex: '9a9a8a' },
      { name: 'keyword', hex: '7a3a2f' },
      { name: 'string', hex: '3d6b3a' },
      { name: 'number', hex: '9a6a1c' },
      { name: 'type', hex: '2d6e5a' },
      { name: 'fn', hex: '6a4a7a' },
      { name: 'variable', hex: '3a3f38' },
      { name: 'delimiter', hex: '7a8076' },
      { name: 'lineno', hex: 'c8c4b8' },
    ],
  },
  {
    label: 'Accents',
    swatches: [
      { name: 'green', hex: '3d6b3a' },
      { name: 'teal', hex: '2e5d6e' },
      { name: 'umber', hex: '7a4a2a' },
      { name: 'plum', hex: '4a3a7a' },
      { name: 'danger', hex: 'c14a3d' },
      { name: 'warn', hex: 'a05a2c' },
    ],
  },
];

const DARK_GROUPS: PaletteGroup[] = [
  {
    label: 'Conservatory chrome',
    swatches: [
      { name: 'bg (pine)', hex: '142019' },
      { name: 'surface', hex: '1a2820' },
      { name: 'surfaceAlt', hex: '1f3026' },
      { name: 'ink', hex: 'e8efe2' },
      { name: 'inkSoft', hex: 'a8b8a8' },
      { name: 'inkMuted', hex: '7a8a7a' },
      { name: 'line', hex: '243228' },
      { name: 'lineSoft', hex: '1c2820' },
    ],
  },
  {
    label: 'Forest syntax',
    swatches: [
      { name: 'editorBg', hex: '142019' },
      { name: 'comment', hex: '5e7064' },
      { name: 'keyword', hex: 'e8a87c' },
      { name: 'string', hex: 'a8d488' },
      { name: 'number', hex: 'f0c890' },
      { name: 'type', hex: '88c0d0' },
      { name: 'fn', hex: 'd4a8c8' },
      { name: 'variable', hex: 'e8efe2' },
      { name: 'delimiter', hex: '7a8e80' },
      { name: 'lineno', hex: '3a4c40' },
    ],
  },
  {
    label: 'Accents',
    swatches: [
      { name: 'moss', hex: '7fc69b' },
      { name: 'moss-bright', hex: 'a8d488' },
      { name: 'cursor', hex: 'e8c08a' },
      { name: 'danger', hex: 'dc6e5a' },
      { name: 'warn', hex: 'e8a87c' },
    ],
  },
];

export function paletteGroupsFor(mode: Mode): PaletteGroup[] {
  return mode === 'light' ? LIGHT_GROUPS : DARK_GROUPS;
}
