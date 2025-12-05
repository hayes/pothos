'use client';

import { createContext, useContext, type ReactNode } from 'react';

interface PlaygroundContextValue {
  source: string;
  schemaSDL: string | null;
  onSourceChange?: (source: string) => void;
  readOnly: boolean;
}

const PlaygroundContext = createContext<PlaygroundContextValue | null>(null);

export function usePlaygroundContext(): PlaygroundContextValue {
  const context = useContext(PlaygroundContext);
  if (!context) {
    throw new Error('usePlaygroundContext must be used within PlaygroundProvider');
  }
  return context;
}

interface PlaygroundProviderProps {
  children: ReactNode;
  source: string;
  schemaSDL: string | null;
  onSourceChange?: (source: string) => void;
  readOnly?: boolean;
}

export function PlaygroundProvider({
  children,
  source,
  schemaSDL,
  onSourceChange,
  readOnly = false,
}: PlaygroundProviderProps) {
  return (
    <PlaygroundContext.Provider value={{ source, schemaSDL, onSourceChange, readOnly }}>
      {children}
    </PlaygroundContext.Provider>
  );
}
