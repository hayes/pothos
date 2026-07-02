'use client';

import { type GraphQLError, type GraphQLSchema, graphql, parse } from 'graphql';
import { useCallback, useState } from 'react';
import type { ResponsePhase } from '@/components/playground/ResponsePane/types';
import { getQueryCursor } from '@/lib/playground/active-query-cursor';
import { captureConsoleAsync } from '@/lib/playground/console-capture';
import { errorMessage } from '@/lib/playground/error-message';
import type { ConsoleMessage } from '@/lib/playground/execution-engine';
import {
  getExtensionPanels,
  resetExtensionPanels,
} from '@/lib/playground/extension-panels-slot';
import { type ExtensionPanel, isExtensionPanel } from '@/lib/playground/playground-panels';

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
  panels: ExtensionPanel[];
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
    throw new Error(`${what} parse error: ${errorMessage(err)}`);
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
  panels: ExtensionPanel[];
  lastLogs: ConsoleMessage[];
  run: (args: RunArgs) => Promise<RunResult>;
  reset: () => void;
}

export function useQueryRunner(): QueryRunner {
  const [phase, setPhase] = useState<ResponsePhase>({ kind: 'idle' });
  const [panels, setPanels] = useState<ExtensionPanel[]>([]);
  const [lastLogs, setLastLogs] = useState<ConsoleMessage[]>([]);

  const run = useCallback(
    async ({ schema, query, variables, context }: RunArgs): Promise<RunResult> => {
      if (!schema) {
        const errPhase = errorPhase('Schema not ready');
        setPhase(errPhase);
        return { phase: errPhase, panels: [], logs: [] };
      }

      setPhase({ kind: 'pending' });

      let parsedVars: Record<string, unknown> | undefined;
      try {
        parsedVars = parseVariables(variables);
      } catch (err) {
        const errPhase = errorPhase(errorMessage(err));
        setPhase(errPhase);
        return { phase: errPhase, panels: [], logs: [] };
      }

      let contextValue: Record<string, unknown> = {};
      try {
        const parsedContext = parseObjectLiteral(context ?? '', 'Context');
        if (parsedContext) {
          contextValue = parsedContext;
        }
      } catch (err) {
        const errPhase = errorPhase(errorMessage(err));
        setPhase(errPhase);
        return { phase: errPhase, panels: [], logs: [] };
      }

      const operationName = pickOperationName(query, getQueryCursor());

      // Reset the side-channel panel slot before every run. Examples
      // can register middleware that pushes panels (SQL captures, trace
      // events, ...) into this slot during resolver execution; we read
      // it back below and merge it with the explicit
      // `extensions.playgroundPanels` field on the response.
      resetExtensionPanels();

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

      // graphql-js wraps thrown resolver errors and `JSON.stringify`
      // drops `originalError` (it's non-enumerable). Surface the
      // underlying Error + stack in the Console drawer so users can see
      // where their resolver actually blew up. Without this, the
      // response panel shows "Cannot read property X of undefined" with
      // no file/line and no way to find the source.
      const errorLogs: ConsoleMessage[] = [];
      for (const err of result.errors ?? []) {
        const original = (err as { originalError?: Error }).originalError;
        const path = err.path?.length ? ` at ${err.path.join('.')}` : '';
        const stack = original?.stack ?? err.stack;
        errorLogs.push({
          type: 'error',
          args: [`GraphQL error${path}: ${err.message}`, stack ?? ''],
          timestamp: Date.now(),
        });
      }
      const allLogs = [...(logs as ConsoleMessage[]), ...errorLogs];

      // Pull in playground panels from two sources:
      //   1. The side-channel slot (panels pushed by execution-path
      //      middleware that can't reach the GraphQL result — e.g. an
      //      ORM's SQL capture, request-tracing instrumentation).
      //   2. Any `extensions.playgroundPanels` the executed schema
      //      surfaced itself — the explicit contract a plugin can use
      //      to attach panels via the GraphQL response.
      const capturedPanels = [...getExtensionPanels()];
      const userPanels = extractUserPanels(result.extensions);
      const allPanels = [...capturedPanels, ...userPanels];

      // The Response tab shows the GraphQL body without the
      // `playgroundPanels` blob — that data is already surfaced via
      // the SQL / ORM tabs, and inlining the (potentially large) SQL
      // text into the JSON body would just bury the actual data the
      // user came to see. Any *other* `extensions` fields the schema
      // emits stay on the response.
      const resultForBody: Record<string, unknown> = { ...result };
      if (
        result.extensions &&
        typeof result.extensions === 'object' &&
        'playgroundPanels' in result.extensions
      ) {
        const { playgroundPanels: _omit, ...keep } = result.extensions as Record<string, unknown>;
        if (Object.keys(keep).length > 0) {
          resultForBody.extensions = keep;
        } else {
          delete resultForBody.extensions;
        }
      }

      const body = JSON.stringify(resultForBody, null, 2);
      const sizeBytes = new Blob([body]).size;
      const errorCount = countErrors(result.errors);

      const next: ResponsePhase =
        errorCount > 0
          ? { kind: 'error', status: 200, durationMs, errorCount, body }
          : { kind: 'success', status: 200, durationMs, sizeBytes, body };

      setPhase(next);
      setPanels(allPanels);
      setLastLogs(allLogs);
      return { phase: next, panels: allPanels, logs: allLogs };
    },
    [],
  );

  const reset = useCallback(() => {
    setPhase({ kind: 'idle' });
    setPanels([]);
    setLastLogs([]);
  }, []);

  return { phase, panels, lastLogs, run, reset };
}

function extractUserPanels(extensions: unknown): ExtensionPanel[] {
  if (!extensions || typeof extensions !== 'object') {
    return [];
  }
  const raw = (extensions as Record<string, unknown>).playgroundPanels;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(isExtensionPanel);
}
