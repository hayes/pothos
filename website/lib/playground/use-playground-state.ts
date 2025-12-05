'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PlaygroundFile, PlaygroundTab } from '../../components/playground/types';
import {
  copyToClipboard,
  createShareableURL,
  getPlaygroundStateFromURL,
  setPlaygroundStateToURL,
  type PlaygroundURLState,
} from './url-state';

export interface UsePlaygroundStateOptions {
  initialFiles: PlaygroundFile[];
  initialQuery?: string;
  syncToURL?: boolean;
}

export interface UsePlaygroundStateResult {
  files: PlaygroundFile[];
  query: string;
  activeTab: PlaygroundTab;
  setFiles: (files: PlaygroundFile[]) => void;
  updateFile: (filename: string, content: string) => void;
  setQuery: (query: string) => void;
  setActiveTab: (tab: PlaygroundTab) => void;
  share: () => Promise<{ success: boolean; url?: string }>;
  reset: () => void;
  isFromURL: boolean;
}

export function usePlaygroundState({
  initialFiles,
  initialQuery = '',
  syncToURL = false,
}: UsePlaygroundStateOptions): UsePlaygroundStateResult {
  const [files, setFilesState] = useState<PlaygroundFile[]>(initialFiles);
  const [query, setQueryState] = useState<string>(initialQuery);
  const [activeTab, setActiveTabState] = useState<PlaygroundTab>('code');
  const [isFromURL, setIsFromURL] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized || !syncToURL) {
      setInitialized(true);
      return;
    }

    const urlState = getPlaygroundStateFromURL();
    if (urlState) {
      setFilesState(urlState.files);
      if (urlState.query) {
        setQueryState(urlState.query);
      }
      if (urlState.activeTab) {
        setActiveTabState(urlState.activeTab as PlaygroundTab);
      }
      setIsFromURL(true);
    }
    setInitialized(true);
  }, [syncToURL, initialized]);

  useEffect(() => {
    if (!syncToURL || !initialized) {
      return;
    }

    const state: PlaygroundURLState = {
      files,
      query: query || undefined,
      activeTab,
    };
    setPlaygroundStateToURL(state);
  }, [files, query, activeTab, syncToURL, initialized]);

  const setFiles = useCallback((newFiles: PlaygroundFile[]) => {
    setFilesState(newFiles);
  }, []);

  const updateFile = useCallback((filename: string, content: string) => {
    setFilesState((prev) => prev.map((f) => (f.filename === filename ? { ...f, content } : f)));
  }, []);

  const setQuery = useCallback((newQuery: string) => {
    setQueryState(newQuery);
  }, []);

  const setActiveTab = useCallback((tab: PlaygroundTab) => {
    setActiveTabState(tab);
  }, []);

  const share = useCallback(async () => {
    const state: PlaygroundURLState = {
      files,
      query: query || undefined,
      activeTab,
    };
    const url = createShareableURL(state);
    const success = await copyToClipboard(url);
    return { success, url };
  }, [files, query, activeTab]);

  const reset = useCallback(() => {
    setFilesState(initialFiles);
    setQueryState(initialQuery);
    setActiveTabState('code');
    setIsFromURL(false);
  }, [initialFiles, initialQuery]);

  return {
    files,
    query,
    activeTab,
    setFiles,
    updateFile,
    setQuery,
    setActiveTab,
    share,
    reset,
    isFromURL,
  };
}
