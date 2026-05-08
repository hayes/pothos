'use client';

import type { Monaco } from '@monaco-editor/react';
import cuttingLight from './themes/cutting-light.json';
import forestDark from './themes/forest-dark.json';

type ThemeData = Parameters<Monaco['editor']['defineTheme']>[1];
type ThemeRule = ThemeData['rules'][number];

/**
 * VS Code theme JSON shape — only the bits we use here.
 */
interface VSCodeTokenColor {
  scope?: string | string[];
  settings: {
    foreground?: string;
    background?: string;
    fontStyle?: string;
  };
}

interface VSCodeThemeJSON {
  colors: Record<string, string>;
  tokenColors: VSCodeTokenColor[];
}

const FOREST_DARK_THEME = 'pothos-forest-dark';
const CUTTING_LIGHT_THEME = 'pothos-cutting-light';

let registered = false;

function stripHash(hex: string): string {
  return hex.replace(/^#/, '').slice(0, 6);
}

/**
 * Convert VS Code's `tokenColors` into Monaco rules.
 *
 * VS Code uses TextMate scopes (`entity.name.function`,
 * `support.type.property-name`, etc.). Monaco's built-in tokenizers
 * emit a simpler token vocabulary (`keyword`, `string`, `type`,
 * `identifier`, optionally suffixed with `.ts`/`.graphql`/`.json`),
 * so most VS Code scopes don't actually fire inside Monaco. We still
 * include them — they're harmless and help if a language pack ships
 * TextMate-based grammars — and overlay the Monaco-native rules below.
 */
function vsCodeRules(json: VSCodeThemeJSON): ThemeRule[] {
  const out: ThemeRule[] = [];
  for (const tc of json.tokenColors) {
    if (!tc.scope) {
      continue;
    }
    const scopes = Array.isArray(tc.scope) ? tc.scope : [tc.scope];
    for (const scope of scopes) {
      const rule: ThemeRule = { token: scope };
      if (tc.settings.foreground) {
        rule.foreground = stripHash(tc.settings.foreground);
      }
      if (tc.settings.background) {
        rule.background = stripHash(tc.settings.background);
      }
      if (tc.settings.fontStyle) {
        rule.fontStyle = tc.settings.fontStyle;
      }
      out.push(rule);
    }
  }
  return out;
}

export interface PaletteSlots {
  comment: string;
  keyword: string;
  string: string;
  number: string;
  type: string;
  fn: string;
  variable: string;
  delimiter: string;
  regexp: string;
  decorator: string;
  attribute: string;
  tag: string;
}

export interface EditorBaseColors {
  background: string;
  foreground: string;
  lineNumber: string;
  lineNumberActive: string;
  selection: string;
  cursor: string;
}

/**
 * Rules that target Monaco's built-in language tokens directly.
 * These are what actually show up for the languages the playground uses
 * (typescript / graphql / json / markdown).
 */
function monacoRules(p: PaletteSlots): ThemeRule[] {
  const langs = ['', '.ts', '.tsx', '.js', '.jsx', '.graphql', '.json', '.css', '.scss', '.html'];
  const rules: ThemeRule[] = [];

  const add = (token: string, foreground: string, fontStyle?: string) => {
    const rule: ThemeRule = { token, foreground };
    if (fontStyle) {
      rule.fontStyle = fontStyle;
    }
    rules.push(rule);
  };

  for (const suffix of langs) {
    add(`comment${suffix}`, p.comment, 'italic');
    add(`keyword${suffix}`, p.keyword);
    add(`string${suffix}`, p.string);
    add(`string.escape${suffix}`, p.number);
    add(`string.invalid${suffix}`, p.delimiter);
    add(`string.key${suffix}`, p.type); // JSON keys
    add(`string.value${suffix}`, p.string); // JSON values
    add(`number${suffix}`, p.number);
    add(`number.float${suffix}`, p.number);
    add(`number.hex${suffix}`, p.number);
    add(`number.binary${suffix}`, p.number);
    add(`number.octal${suffix}`, p.number);
    add(`type${suffix}`, p.type);
    add(`type.identifier${suffix}`, p.type);
    add(`identifier${suffix}`, p.variable);
    add(`delimiter${suffix}`, p.delimiter);
    add(`delimiter.bracket${suffix}`, p.delimiter);
    add(`delimiter.parenthesis${suffix}`, p.delimiter);
    add(`delimiter.square${suffix}`, p.delimiter);
    add(`delimiter.angle${suffix}`, p.delimiter);
    add(`punctuation${suffix}`, p.delimiter);
    add(`operator${suffix}`, p.keyword);
    add(`regexp${suffix}`, p.regexp);
    add(`tag${suffix}`, p.tag);
    add(`attribute.name${suffix}`, p.attribute);
    add(`attribute.value${suffix}`, p.string);
    add(`metatag${suffix}`, p.tag);
    add(`metatag.content${suffix}`, p.tag);
    add(`annotation${suffix}`, p.decorator);
    add(`predefined${suffix}`, p.type); // built-ins like console
    add(`constructor${suffix}`, p.type);
    add(`namespace${suffix}`, p.type);
  }

  // Monaco's "keyword.json" emits for true/false/null
  add('keyword.json', p.number);

  return rules;
}

const FOREST_PALETTE: PaletteSlots = {
  comment: '5e7064',
  keyword: 'e8a87c',
  string: 'a8d488',
  number: 'f0c890',
  type: '88c0d0',
  fn: 'd4a8c8',
  variable: 'e8efe2',
  delimiter: '7a8e80',
  regexp: 'f0c890',
  decorator: 'f0c890',
  attribute: 'd4a8c8',
  tag: 'e8a87c',
};

/* Cutting (light) — re-tuned to lean botanical:
 *  - type / interface / parameter: deep teal-green (#2d6e5a) instead of
 *    steel blue, so types echo the foliage palette rather than reading
 *    as steely IDE-blue.
 *  - variable / property text: softer charcoal (#3a3f38) instead of
 *    near-black ink (#1a201b), so non-token code doesn't feel oppressive
 *    against the warm cream page.
 *  - JSON keys (which use the type color) get the same teal-green for
 *    consistency in the response pane.
 */
const CUTTING_PALETTE: PaletteSlots = {
  comment: '9a9a8a',
  keyword: '7a3a2f',
  string: '3d6b3a',
  number: '9a6a1c',
  type: '2d6e5a',
  fn: '6a4a7a',
  variable: '3a3f38',
  delimiter: '7a8076',
  regexp: '9a6a1c',
  decorator: '9a6a1c',
  attribute: '6a4a7a',
  tag: '7a3a2f',
};

function buildTheme(
  json: VSCodeThemeJSON,
  palette: PaletteSlots,
  base: 'vs' | 'vs-dark',
): ThemeData {
  return {
    base,
    inherit: true,
    // Order matters — the more-specific Monaco rules go last so they
    // override any VS Code scope rules that might collide.
    rules: [...vsCodeRules(json), ...monacoRules(palette)],
    colors: json.colors,
  };
}

export function registerPothosMonacoThemes(monaco: Monaco): void {
  if (registered) {
    return;
  }
  monaco.editor.defineTheme(
    FOREST_DARK_THEME,
    buildTheme(forestDark as VSCodeThemeJSON, FOREST_PALETTE, 'vs-dark'),
  );
  monaco.editor.defineTheme(
    CUTTING_LIGHT_THEME,
    buildTheme(cuttingLight as VSCodeThemeJSON, CUTTING_PALETTE, 'vs'),
  );
  registered = true;
}

export function pothosThemeFor(resolvedTheme: string | undefined): string {
  return resolvedTheme === 'light' ? CUTTING_LIGHT_THEME : FOREST_DARK_THEME;
}

/**
 * Define a Monaco theme from a palette + base editor colors. Re-defining
 * a theme of the same name replaces it, so the editor preview can update
 * live as the theme-editor sliders move.
 */
export function definePaletteTheme(
  monaco: Monaco,
  name: string,
  palette: PaletteSlots,
  base: EditorBaseColors,
  inheritFrom: 'vs' | 'vs-dark',
): void {
  const colors: Record<string, string> = {
    'editor.background': base.background,
    'editor.foreground': base.foreground,
    'editorLineNumber.foreground': base.lineNumber,
    'editorLineNumber.activeForeground': base.lineNumberActive,
    'editor.selectionBackground': base.selection,
    'editorCursor.foreground': base.cursor,
  };
  monaco.editor.defineTheme(name, {
    base: inheritFrom,
    inherit: true,
    rules: monacoRules(palette),
    colors,
  });
}

export const FOREST_PALETTE_PRESET = FOREST_PALETTE;
export const CUTTING_PALETTE_PRESET = CUTTING_PALETTE;
