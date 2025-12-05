'use client';

import * as graphql from 'graphql';
import type { GraphQLSchema } from 'graphql';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlaygroundFile } from '../../components/playground/types';
import { compileAndExecute, type ExecutionResult, type PlaygroundModules } from './execution-engine';
import { pothosModule } from './pothos-bundle';

export interface CompilerState {
  isCompiling: boolean;
  schema: GraphQLSchema | null;
  schemaSDL: string | null;
  error: string | null;
  lastCompiledAt: number | null;
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
  });

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

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

    setState((prev) => ({ ...prev, isCompiling: true, error: null }));

    try {
      const result: ExecutionResult = await compileAndExecute(
        mainFile.content,
        modules,
        mainFile.filename
      );

      if (result.success && result.schema && result.schemaSDL) {
        setState({
          isCompiling: false,
          schema: result.schema,
          schemaSDL: result.schemaSDL,
          error: null,
          lastCompiledAt: Date.now(),
        });
      } else {
        setState((prev) => ({
          ...prev,
          isCompiling: false,
          error: result.error || 'Unknown compilation error',
        }));
      }
    } catch (err) {
      const error = err as Error;
      setState((prev) => ({
        ...prev,
        isCompiling: false,
        error: error.message,
      }));
    }
  }, [files]);

  const reset = useCallback(() => {
    setState({
      isCompiling: true,
      schema: null,
      schemaSDL: null,
      error: null,
      lastCompiledAt: null,
    });
  }, []);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (autoCompile) {
        compile();
      }
      return;
    }

    if (!autoCompile) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      compile();
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [files, compile, debounceMs, autoCompile]);

  return { state, compile, reset };
}
