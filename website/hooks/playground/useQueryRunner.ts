'use client';

import { type GraphQLError, type GraphQLSchema, graphql, parse } from 'graphql';
import { useCallback, useState } from 'react';
import type { ResponsePhase, TraceRow } from '@/components/playground/ResponsePane/types';
import { getQueryCursor } from '@/lib/playground/active-query-cursor';
import { captureConsoleAsync } from '@/lib/playground/console-capture';
import type { ConsoleMessage } from '@/lib/playground/execution-engine';

interface RunArgs {
  schema: GraphQLSchema | null;
  query: string;
  variables: string;
  /** JSON object string supplied as graphql-js's `contextValue`. */
  context?: string;
  headers?: [string, string][];
}

interface RunResult {
  phase: ResponsePhase;
  trace: TraceRow[];
  logs: ConsoleMessage[];
}

function errorPhase(message: string): ResponsePhase {
  return {
    kind: 'error',
    status: 0,
    durationMs: 0,
    errorCount: 1,
    body: JSON.stringify({ errors: [{ message }] }, null, 2),
  };
}

/**
 * Parse a JS object literal. We just eval the input as an expression
 * (wrapped in parens so `{ … }` reads as an object, not a block) — the
 * playground already runs user code via `new Function` for the schema,
 * so this isn't a new trust surface. Accepts everything JS does:
 * unquoted keys, single quotes, trailing commas, comments, `undefined`.
 */
function parseObjectLiteral(raw: string, what: string): Record<string, unknown> | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    const value = new Function(`"use strict"; return (${trimmed});`)();
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    throw new Error(`${what} must be an object`);
  } catch (err) {
    throw new Error(`${what} parse error: ${(err as Error).message}`);
  }
}

function parseVariables(raw: string): Record<string, unknown> | undefined {
  return parseObjectLiteral(raw, 'Variables');
}

/**
 * When a query document holds multiple operations, graphql-js refuses
 * to execute it without an explicit `operationName`. Resolve which one
 * to run: the operation whose source range contains the editor's caret
 * if known, otherwise the first named operation. Returns `undefined`
 * for single-operation or anonymous documents (graphql-js handles both
 * fine).
 */
function pickOperationName(source: string, cursorOffset: number | null): string | undefined {
  let doc: ReturnType<typeof parse>;
  try {
    doc = parse(source);
  } catch {
    // Let graphql-js surface the parse error during execute().
    return undefined;
  }
  const ops = doc.definitions.filter((d) => d.kind === 'OperationDefinition');
  if (ops.length <= 1) {
    return undefined;
  }

  if (cursorOffset != null) {
    const atCursor = ops.find(
      (op) => op.loc && cursorOffset >= op.loc.start && cursorOffset <= op.loc.end,
    );
    if (atCursor && 'name' in atCursor && atCursor.name) {
      return atCursor.name.value;
    }
  }

  const firstNamed = ops.find((op) => 'name' in op && op.name);
  if (firstNamed && 'name' in firstNamed && firstNamed.name) {
    return firstNamed.name.value;
  }
  return undefined;
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

  const run = useCallback(
    async ({ schema, query, variables, context }: RunArgs): Promise<RunResult> => {
      if (!schema) {
        const errPhase = errorPhase('Schema not ready');
        setPhase(errPhase);
        return { phase: errPhase, trace: [], logs: [] };
      }

      setPhase({ kind: 'pending' });

      let parsedVars: Record<string, unknown> | undefined;
      try {
        parsedVars = parseVariables(variables);
      } catch (err) {
        const errPhase = errorPhase((err as Error).message);
        setPhase(errPhase);
        return { phase: errPhase, trace: [], logs: [] };
      }

      let contextValue: Record<string, unknown> = {};
      try {
        const parsedContext = parseObjectLiteral(context ?? '', 'Context');
        if (parsedContext) {
          contextValue = parsedContext;
        }
      } catch (err) {
        const errPhase = errorPhase((err as Error).message);
        setPhase(errPhase);
        return { phase: errPhase, trace: [], logs: [] };
      }

      const operationName = pickOperationName(query, getQueryCursor());

      const start = performance.now();
      const { result, logs } = await captureConsoleAsync(async () =>
        graphql({
          schema,
          source: query,
          variableValues: parsedVars,
          operationName,
          // Plugins like `scope-auth` stash per-request state on the
          // context using a Symbol key, so an object is required here
          // even when the user hasn't supplied one — the Context tab
          // feeds this.
          contextValue,
        }),
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
    },
    [],
  );

  const reset = useCallback(() => {
    setPhase({ kind: 'idle' });
    setTrace([]);
    setLastLogs([]);
  }, []);

  return { phase, trace, lastLogs, run, reset };
}
