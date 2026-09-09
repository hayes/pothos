/**
 * Generic contract for playground response panels surfaced via the
 * GraphQL response's `extensions.playgroundPanels` field. The
 * playground's response pane scans extensions for entries matching this
 * shape and renders one extra tab per top-level panel. Panels with a
 * `tabs` array render their content under a second-level tab strip;
 * panels with `content`/`language` render a single editor.
 *
 * Designed to be plugin-agnostic — any Pothos plugin (or piece of user
 * code) can populate this field to surface debugging UI in the
 * playground without changes to the response pane.
 */

export type PanelLanguage = 'sql' | 'json' | 'typescript' | 'graphql' | 'text';

export interface ExtensionSubPanel {
  name: string;
  language: PanelLanguage;
  content: string;
}

export interface ExtensionPanel {
  name: string;
  language?: PanelLanguage;
  content?: string;
  tabs?: ExtensionSubPanel[];
}

export function isExtensionPanel(value: unknown): value is ExtensionPanel {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const v = value as Record<string, unknown>;
  if (typeof v.name !== 'string') {
    return false;
  }
  if (Array.isArray(v.tabs)) {
    return v.tabs.every(
      (t) =>
        t != null &&
        typeof t === 'object' &&
        typeof (t as Record<string, unknown>).name === 'string' &&
        typeof (t as Record<string, unknown>).language === 'string' &&
        typeof (t as Record<string, unknown>).content === 'string',
    );
  }
  return typeof v.content === 'string' && typeof v.language === 'string';
}
