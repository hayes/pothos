'use client';

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { PlaygroundFile } from '../../components/playground/types';

export interface PlaygroundURLState {
  files: PlaygroundFile[];
  query?: string;
  activeTab?: string;
}

const URL_STATE_VERSION = 1;

interface EncodedState {
  v: number;
  f: { n: string; c: string }[];
  q?: string;
  t?: string;
}

export function encodePlaygroundState(state: PlaygroundURLState): string {
  const encoded: EncodedState = {
    v: URL_STATE_VERSION,
    f: state.files.map((f) => ({ n: f.filename, c: f.content })),
  };

  if (state.query) {
    encoded.q = state.query;
  }
  if (state.activeTab) {
    encoded.t = state.activeTab;
  }

  const json = JSON.stringify(encoded);
  return compressToEncodedURIComponent(json);
}

export function decodePlaygroundState(hash: string): PlaygroundURLState | null {
  try {
    const decompressed = decompressFromEncodedURIComponent(hash);
    if (!decompressed) {
      return null;
    }

    const decoded: EncodedState = JSON.parse(decompressed);

    if (decoded.v !== URL_STATE_VERSION) {
      console.warn(`[Playground] URL state version mismatch: ${decoded.v} !== ${URL_STATE_VERSION}`);
    }

    return {
      files: decoded.f.map((f) => ({
        filename: f.n,
        content: f.c,
      })),
      query: decoded.q,
      activeTab: decoded.t,
    };
  } catch (err) {
    console.error('[Playground] Failed to decode URL state:', err);
    return null;
  }
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
