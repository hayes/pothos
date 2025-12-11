'use client';

import type { GraphQLSchema } from 'graphql';
import * as graphql from 'graphql';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlaygroundFile } from '../../components/playground/types';
import {
  type ConsoleMessage,
  compileAndExecute,
  type ExecutionResult,
  type PlaygroundModules,
} from './execution-engine';
import { pothosModule } from './pothos-bundle';

// Re-export ConsoleMessage for external use
export type { ConsoleMessage };

export interface CompilerState {
  isCompiling: boolean;
  schema: GraphQLSchema | null;
  schemaSDL: string | null;
  error: string | null;
  lastCompiledAt: number | null;
  consoleLogs: ConsoleMessage[];
}

export interface UsePlaygroundCompilerOptions {
  files: PlaygroundFile[];
  debounceMs?: number;
  autoCompile?: boolean;
}

export interface UsePlaygroundCompilerResult {
  state: CompilerState;
  compile: () => Promise<void>;
  reset: () => void;
}

// Use local bundle for now since Next.js/Turbopack doesn't support dynamic imports of external URLs
// The types from auto-typings will still come from CDN and should work correctly
const modules: PlaygroundModules = {
  '@pothos/core': pothosModule,
  graphql: graphql,
};

export function usePlaygroundCompiler({
  files,
  debounceMs = 500,
  autoCompile = true,
}: UsePlaygroundCompilerOptions): UsePlaygroundCompilerResult {
  const [state, setState] = useState<CompilerState>({
    isCompiling: true,
    schema: null,
    schemaSDL: null,
    error: null,
    lastCompiledAt: null,
    consoleLogs: [],
  });

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);
  const prevFilesRef = useRef(files);
  // Track compilation version to ignore stale results
  const currentCompilationRef = useRef<number>(0);

  const compile = useCallback(async () => {
    const mainFile = files.find((f) => f.filename === 'schema.ts') || files[0];
    if (!mainFile) {
      setState((prev) => ({
        ...prev,
        error: 'No schema file found',
        isCompiling: false,
      }));
      return;
    }

    // Increment compilation version to track this specific compilation
    const compilationId = ++currentCompilationRef.current;

    setState((prev) => ({ ...prev, isCompiling: true, error: null }));

    try {
      // Use new multi-file API if multiple files, otherwise legacy API
      const result: ExecutionResult =
        files.length > 1
          ? await compileAndExecute({
              files: files.map((f) => ({ filename: f.filename, content: f.content })),
              modules,
            })
          : await compileAndExecute(mainFile.content, modules, mainFile.filename);

      // Only update state if this is still the latest compilation
      // This prevents race conditions where older compilations finish after newer ones
      if (compilationId === currentCompilationRef.current) {
        if (result.success && result.schema && result.schemaSDL) {
          setState({
            isCompiling: false,
            schema: result.schema,
            schemaSDL: result.schemaSDL,
            error: null,
            lastCompiledAt: Date.now(),
            consoleLogs: result.consoleLogs || [],
          });
        } else {
          setState((prev) => ({
            ...prev,
            isCompiling: false,
            error: result.error || 'Unknown compilation error',
            consoleLogs: result.consoleLogs || [],
          }));
        }
      }
      // If compilationId doesn't match, silently ignore stale results
    } catch (err) {
      // Only update error state if this is still the latest compilation
      if (compilationId === currentCompilationRef.current) {
        const error = err as Error;
        setState((prev) => ({
          ...prev,
          isCompiling: false,
          error: error.message,
        }));
      }
    }
  }, [files]);

  const reset = useCallback(() => {
    // Cancel any pending compilation
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    setState({
      isCompiling: true,
      schema: null,
      schemaSDL: null,
      error: null,
      lastCompiledAt: null,
      consoleLogs: [],
    });
  }, []);

  useEffect(() => {
    // Handle first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (autoCompile) {
        compile();
      }
      return;
    }

    // Skip if auto-compile disabled or files unchanged
    if (!autoCompile || prevFilesRef.current === files) {
      return;
    }

    prevFilesRef.current = files;

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set pending state immediately
    setState((prev) => ({ ...prev, isCompiling: true }));

    // Start new debounce timer
    debounceTimerRef.current = setTimeout(() => {
      compile();
    }, debounceMs);

    // Cleanup function - clear timer on unmount or before next effect
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [files, debounceMs, autoCompile, compile]);

  return { state, compile, reset };
}
