'use client';

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { PlaygroundFile } from '../../components/playground/types';

export type ViewMode = 'code' | 'graphql';

export interface PlaygroundURLState {
  files: PlaygroundFile[];
  query?: string;
  variables?: string;
  activeTab?: string;
  viewMode?: ViewMode;
  settings?: PlaygroundSettings;
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

  if (state.query) {
    params.set('query', state.query);
  }

  if (state.variables) {
    params.set('vars', state.variables);
  }

  if (state.activeTab) {
    params.set('tab', state.activeTab);
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

    const tab = params.get('tab');
    if (tab) {
      state.activeTab = tab;
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

  const encoded = encodePlaygroundState(state);
  const newURL = `${window.location.pathname}#${encoded}`;
  window.history.replaceState(null, '', newURL);
}

export function createShareableURL(state: PlaygroundURLState, baseURL?: string): string {
  const encoded = encodePlaygroundState(state);
  const base = baseURL || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/playground#${encoded}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }
}
