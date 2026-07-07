'use client';

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { PlaygroundFile } from '@/components/playground/types';

export type ViewMode = 'code' | 'graphql';

export interface PlaygroundURLState {
  files: PlaygroundFile[];
  query?: string;
  variables?: string;
  /**
   * JSON-or-JS-literal string passed as `contextValue` to graphql() at
   * run time. Parsed on the runner side; stored verbatim here so the
   * editor view round-trips through the hash.
   */
  context?: string;
  /** Multiple query tabs for GraphiQL */
  queries?: Array<{ title?: string; query: string; variables?: string; context?: string }>;
  activeTab?: string;
  activeFileIndex?: number;
  viewMode?: ViewMode;
  settings?: PlaygroundSettings;
  /** Current step index for multi-step examples */
  step?: number;
}

export interface PlaygroundSettings {
  autoCompile?: boolean;
  debounceMs?: number;
  theme?: 'light' | 'dark' | 'auto';
  fontSize?: number;
  [key: string]: unknown; // Allow future extensions
}

const URL_STATE_VERSION = 3;

// Version 1 format (for backward compatibility - compressed JSON)
interface EncodedStateV1 {
  v: 1;
  f: { n: string; c: string }[];
  q?: string;
  t?: string;
  m?: 'c' | 'g'; // viewMode: 'c' = code, 'g' = graphql
}

// Version 2 format (backward compatibility - compressed JSON)
interface EncodedStateV2 {
  v: 2;
  f: { n: string; c: string; l?: string }[]; // Added optional language
  q?: string;
  vars?: string; // GraphQL variables
  t?: string;
  m?: 'c' | 'g'; // viewMode: 'c' = code, 'g' = graphql
  s?: PlaygroundSettings; // Settings object
}

// Version 3 format (current - human-readable URL params)
// Uses URLSearchParams format: view=graphql&query=...&code=...
// Only code/files are compressed, metadata is readable

export function encodePlaygroundState(state: PlaygroundURLState): string {
  // V3 format: Human-readable URLSearchParams with compressed code
  const params = new URLSearchParams();

  // Add version for future compatibility
  params.set('v', '3');

  // Add readable metadata
  if (state.viewMode) {
    params.set('view', state.viewMode);
  }

  // Always save query (even if empty) to preserve example default queries
  if (state.query !== undefined) {
    params.set('query', state.query);
  }

  if (state.variables) {
    params.set('vars', state.variables);
  }

  if (state.context) {
    // Compressed because JS-literal context values may contain `&` / `=` /
    // newlines that don't survive a raw URL param.
    params.set('ctx', compressToEncodedURIComponent(state.context));
  }

  // Save multiple query tabs if present
  if (state.queries && state.queries.length > 0) {
    const queriesJson = JSON.stringify(state.queries);
    const compressedQueries = compressToEncodedURIComponent(queriesJson);
    params.set('queries', compressedQueries);
  }

  if (state.activeTab) {
    params.set('tab', state.activeTab);
  }

  if (state.activeFileIndex !== undefined && state.activeFileIndex > 0) {
    params.set('file', state.activeFileIndex.toString());
  }

  if (state.step !== undefined && state.step > 0) {
    params.set('step', state.step.toString());
  }

  // Add settings as readable params
  if (state.settings) {
    if (state.settings.theme) {
      params.set('theme', state.settings.theme);
    }
    if (state.settings.fontSize) {
      params.set('fontSize', state.settings.fontSize.toString());
    }
    if (state.settings.autoCompile !== undefined) {
      params.set('autoCompile', state.settings.autoCompile.toString());
    }
    if (state.settings.debounceMs !== undefined) {
      params.set('debounceMs', state.settings.debounceMs.toString());
    }
  }

  // Compress and encode files (this is the only non-readable part)
  const filesData = state.files.map((f) => ({
    n: f.filename,
    c: f.content,
    ...(f.language && { l: f.language }),
  }));
  const filesJson = JSON.stringify(filesData);
  const compressedFiles = compressToEncodedURIComponent(filesJson);
  params.set('code', compressedFiles);

  return params.toString();
}

export function decodePlaygroundState(hash: string): PlaygroundURLState | null {
  try {
    // Try to parse as URLSearchParams first (v3 format)
    const params = new URLSearchParams(hash);
    const version = params.get('v');

    if (version === '3') {
      // V3 format: Human-readable params
      return decodeV3State(params);
    }

    // Fallback to compressed format (v1/v2)
    const decompressed = decompressFromEncodedURIComponent(hash);
    if (!decompressed) {
      return null;
    }

    const decoded = JSON.parse(decompressed) as { v: number };

    // Handle version migrations
    if (decoded.v === 1) {
      return migrateV1ToV2(decoded as EncodedStateV1);
    }

    if (decoded.v === 2) {
      return decodeV2State(decoded as EncodedStateV2);
    }

    // Unknown version
    console.warn(
      `[Playground] Unknown URL state version: ${decoded.v}. Current version: ${URL_STATE_VERSION}`,
    );
    return null;
  } catch (err) {
    console.error('[Playground] Failed to decode URL state:', err);
    return null;
  }
}

function decodeV3State(params: URLSearchParams): PlaygroundURLState | null {
  try {
    // Decode compressed files
    const compressedFiles = params.get('code');
    if (!compressedFiles) {
      return null;
    }

    const filesJson = decompressFromEncodedURIComponent(compressedFiles);
    if (!filesJson) {
      return null;
    }

    const filesData = JSON.parse(filesJson) as Array<{ n: string; c: string; l?: string }>;
    const files: PlaygroundFile[] = filesData.map((f) => ({
      filename: f.n,
      content: f.c,
      ...(f.l && { language: f.l as 'typescript' | 'graphql' }),
    }));

    // Parse readable metadata
    const state: PlaygroundURLState = { files };

    const viewMode = params.get('view');
    if (viewMode === 'code' || viewMode === 'graphql') {
      state.viewMode = viewMode;
    }

    const query = params.get('query');
    if (query) {
      state.query = query;
    }

    const vars = params.get('vars');
    if (vars) {
      state.variables = vars;
    }

    const compressedCtx = params.get('ctx');
    if (compressedCtx) {
      const ctx = decompressFromEncodedURIComponent(compressedCtx);
      if (ctx) {
        state.context = ctx;
      }
    }

    // Decode multiple query tabs if present
    const compressedQueries = params.get('queries');
    if (compressedQueries) {
      try {
        const queriesJson = decompressFromEncodedURIComponent(compressedQueries);
        if (queriesJson) {
          state.queries = JSON.parse(queriesJson) as Array<{
            title?: string;
            query: string;
            variables?: string;
            context?: string;
          }>;
        }
      } catch (err) {
        console.error('[Playground] Failed to decode queries:', err);
      }
    }

    const tab = params.get('tab');
    if (tab) {
      state.activeTab = tab;
    }

    const fileIndex = params.get('file');
    if (fileIndex) {
      const index = Number.parseInt(fileIndex, 10);
      if (!Number.isNaN(index) && index >= 0) {
        state.activeFileIndex = index;
      }
    }

    const stepIndex = params.get('step');
    if (stepIndex) {
      const index = Number.parseInt(stepIndex, 10);
      if (!Number.isNaN(index) && index >= 0) {
        state.step = index;
      }
    }

    // Parse settings
    const theme = params.get('theme');
    const fontSize = params.get('fontSize');
    const autoCompile = params.get('autoCompile');
    const debounceMs = params.get('debounceMs');

    if (theme || fontSize || autoCompile || debounceMs) {
      state.settings = {};
      if (theme && (theme === 'light' || theme === 'dark' || theme === 'auto')) {
        state.settings.theme = theme;
      }
      if (fontSize) {
        state.settings.fontSize = Number.parseInt(fontSize, 10);
      }
      if (autoCompile) {
        state.settings.autoCompile = autoCompile === 'true';
      }
      if (debounceMs) {
        state.settings.debounceMs = Number.parseInt(debounceMs, 10);
      }
    }

    return state;
  } catch (err) {
    console.error('[Playground] Failed to decode v3 state:', err);
    return null;
  }
}

function migrateV1ToV2(state: EncodedStateV1): PlaygroundURLState {
  console.info('[Playground] Migrating URL state from v1 to v2');
  return {
    files: state.f.map((f) => ({
      filename: f.n,
      content: f.c,
    })),
    query: state.q,
    activeTab: state.t,
    viewMode: state.m === 'c' ? 'code' : state.m === 'g' ? 'graphql' : undefined,
  };
}

function decodeV2State(state: EncodedStateV2): PlaygroundURLState {
  return {
    files: state.f.map((f) => ({
      filename: f.n,
      content: f.c,
      ...(f.l && { language: f.l as 'typescript' | 'graphql' }),
    })),
    query: state.q,
    variables: state.vars,
    activeTab: state.t,
    viewMode: state.m === 'c' ? 'code' : state.m === 'g' ? 'graphql' : undefined,
    settings: state.s,
  };
}

export function getPlaygroundStateFromURL(): PlaygroundURLState | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const hash = window.location.hash.slice(1);
  if (!hash) {
    return null;
  }

  return decodePlaygroundState(hash);
}

export function setPlaygroundStateToURL(state: PlaygroundURLState): void {
  if (typeof window === 'undefined') {
    return;
  }

  // Preserve search params (`?example=foo&step=2`) — those are
  // example/step identity, owned by `setExampleInUrl`. Rebuilding
  // from `pathname + hash` would silently drop them, breaking
  // shared links like `?example=foo&step=2#code=…`.
  const encoded = encodePlaygroundState(state);
  const url = new URL(window.location.href);
  url.hash = encoded;
  window.history.replaceState(null, '', url.toString());
}

export function createShareableURL(state: PlaygroundURLState, baseURL?: string): string {
  const encoded = encodePlaygroundState(state);
  // Preserve `?example=foo&step=2` from the current URL so shared
  // links reproduce the loaded example identity AND the user's edits
  // (the hash payload). Falls back to the base URL when called from
  // SSR.
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    if (baseURL) {
      url.protocol = new URL(baseURL).protocol;
      url.host = new URL(baseURL).host;
    }
    url.hash = encoded;
    return url.toString();
  }
  const base = baseURL ?? '';
  return `${base}/playground#${encoded}`;
}
