'use client';

import { useCallback, useState } from 'react';
import type { PlaygroundFile } from '@/components/playground/types';

export interface PlaygroundFilesState {
  files: PlaygroundFile[];
  activeIndex: number;
  setFiles: (files: PlaygroundFile[]) => void;
  setActiveIndex: (index: number) => void;
  updateActive: (content: string) => void;
  updateAt: (index: number, content: string) => void;
  addFile: () => void;
  renameFile: (index: number, filename: string) => boolean;
  removeFile: (index: number) => void;
}

export function usePlaygroundFiles(initial: PlaygroundFile[]): PlaygroundFilesState {
  const [files, setFilesState] = useState<PlaygroundFile[]>(initial);
  const [activeIndex, setActiveIndex] = useState(0);

  const setFiles = useCallback((next: PlaygroundFile[]) => {
    setFilesState(next);
    setActiveIndex((idx) => Math.min(idx, Math.max(next.length - 1, 0)));
  }, []);

  const updateAt = useCallback((index: number, content: string) => {
    setFilesState((prev) => prev.map((f, i) => (i === index ? { ...f, content } : f)));
  }, []);

  const updateActive = useCallback(
    (content: string) => updateAt(activeIndex, content),
    [activeIndex, updateAt],
  );

  const addFile = useCallback(() => {
    setFilesState((prev) => {
      const base = 'new-file.ts';
      let name = base;
      let n = 1;
      while (prev.some((f) => f.filename === name)) {
        n++;
        name = `new-file-${n}.ts`;
      }
      const next = [...prev, { filename: name, content: '// New file\n' }];
      setActiveIndex(next.length - 1);
      return next;
    });
  }, []);

  const renameFile = useCallback((index: number, filename: string): boolean => {
    const trimmed = filename.trim();
    if (!trimmed) {
      return false;
    }
    let ok = true;
    setFilesState((prev) => {
      if (prev.some((f, i) => i !== index && f.filename === trimmed)) {
        ok = false;
        return prev;
      }
      return prev.map((f, i) => (i === index ? { ...f, filename: trimmed } : f));
    });
    return ok;
  }, []);

  const removeFile = useCallback((index: number) => {
    setFilesState((prev) => {
      if (prev.length <= 1) {
        return prev;
      }
      const next = prev.filter((_, i) => i !== index);
      setActiveIndex((cur) =>
        cur === index ? Math.max(0, index - 1) : cur > index ? cur - 1 : cur,
      );
      return next;
    });
  }, []);

  return {
    files,
    activeIndex,
    setFiles,
    setActiveIndex,
    updateActive,
    updateAt,
    addFile,
    renameFile,
    removeFile,
  };
}
