'use client';

import { type GraphQLError, type GraphQLSchema, graphql } from 'graphql';
import { useCallback, useState } from 'react';
import type { ResponsePhase, TraceRow } from '../../components/playground/ResponsePane/types';
import { captureConsoleAsync } from '../../lib/playground/console-capture';
import type { ConsoleMessage } from '../../lib/playground/use-playground-compiler';

interface RunArgs {
  schema: GraphQLSchema | null;
  query: string;
  variables: string;
  headers?: [string, string][];
}

interface RunResult {
  phase: ResponsePhase;
  trace: TraceRow[];
  logs: ConsoleMessage[];
}

function parseVariables(raw: string): Record<string, unknown> | undefined {
  if (!raw.trim()) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    throw new Error('Variables must be valid JSON');
  }
}

function countErrors(errors?: readonly GraphQLError[]): number {
  return errors?.length ?? 0;
}

export interface QueryRunner {
  phase: ResponsePhase;
  trace: TraceRow[];
  lastLogs: ConsoleMessage[];
  run: (args: RunArgs) => Promise<RunResult>;
  reset: () => void;
}

export function useQueryRunner(): QueryRunner {
  const [phase, setPhase] = useState<ResponsePhase>({ kind: 'idle' });
  const [trace, setTrace] = useState<TraceRow[]>([]);
  const [lastLogs, setLastLogs] = useState<ConsoleMessage[]>([]);

  const run = useCallback(async ({ schema, query, variables }: RunArgs): Promise<RunResult> => {
    if (!schema) {
      const errPhase: ResponsePhase = {
        kind: 'error',
        status: 0,
        durationMs: 0,
        errorCount: 1,
        body: JSON.stringify({ errors: [{ message: 'Schema not ready' }] }, null, 2),
      };
      setPhase(errPhase);
      return { phase: errPhase, trace: [], logs: [] };
    }

    setPhase({ kind: 'pending' });

    let parsedVars: Record<string, unknown> | undefined;
    try {
      parsedVars = parseVariables(variables);
    } catch (err) {
      const errPhase: ResponsePhase = {
        kind: 'error',
        status: 0,
        durationMs: 0,
        errorCount: 1,
        body: JSON.stringify({ errors: [{ message: (err as Error).message }] }, null, 2),
      };
      setPhase(errPhase);
      return { phase: errPhase, trace: [], logs: [] };
    }

    const start = performance.now();
    const { result, logs } = await captureConsoleAsync(async () =>
      graphql({ schema, source: query, variableValues: parsedVars }),
    );
    const durationMs = performance.now() - start;

    const body = JSON.stringify(result, null, 2);
    const sizeBytes = new Blob([body]).size;
    const errorCount = countErrors(result.errors);

    const next: ResponsePhase =
      errorCount > 0
        ? { kind: 'error', status: 200, durationMs, errorCount, body }
        : { kind: 'success', status: 200, durationMs, sizeBytes, body };

    setPhase(next);
    setTrace([]);
    setLastLogs(logs as ConsoleMessage[]);
    return { phase: next, trace: [], logs: logs as ConsoleMessage[] };
  }, []);

  const reset = useCallback(() => {
    setPhase({ kind: 'idle' });
    setTrace([]);
    setLastLogs([]);
  }, []);

  return { phase, trace, lastLogs, run, reset };
}
