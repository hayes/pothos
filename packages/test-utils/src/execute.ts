import {
  type ExecutionArgs,
  type ExecutionResult,
  execute as stableExecute,
  versionInfo,
} from 'graphql';

// graphql 17 split incremental delivery (`@defer`/`@stream`) out of the stable `execute`, which now
// throws on any schema that *declares* those directives — even for operations that don't use them.
// To keep the existing single-result test snapshots working on both graphql 16 and 17, this helper
// routes through `experimentalExecuteIncrementally` on 17 and collapses any incremental payloads
// back into one complete result, matching how graphql 16 resolved everything in a single response.
//
// On 16 there is nothing to do: `execute` ignores `@defer`/`@stream` and returns a complete result.
export async function execute(args: ExecutionArgs): Promise<ExecutionResult> {
  if (versionInfo.major < 17) {
    return stableExecute(args) as Promise<ExecutionResult>;
  }

  // `experimentalExecuteIncrementally` only exists on graphql 17; load it off the namespace so the
  // module still resolves on 16 (where the named export is absent), and cast through `unknown`
  // since graphql 16's types don't declare it.
  const graphql = (await import('graphql')) as unknown as {
    experimentalExecuteIncrementally: (
      args: ExecutionArgs,
    ) => Promise<ExecutionResult | Incrementalish>;
  };

  const result = await graphql.experimentalExecuteIncrementally(args);

  if (!isIncremental(result)) {
    return result as ExecutionResult;
  }

  return collectIncremental(result);
}

interface PendingResult {
  id: string;
  path: ReadonlyArray<string | number>;
}

interface IncrementalPayload {
  id: string;
  subPath?: ReadonlyArray<string | number>;
  data?: Record<string, unknown>;
  items?: unknown[];
  errors?: readonly unknown[];
}

interface CompletedResult {
  id: string;
  errors?: readonly unknown[];
}

interface SubsequentResult {
  pending?: readonly PendingResult[];
  incremental?: readonly IncrementalPayload[];
  completed?: readonly CompletedResult[];
  hasNext: boolean;
}

interface Incrementalish {
  initialResult: ExecutionResult & { pending?: readonly PendingResult[] };
  subsequentResults: AsyncGenerator<SubsequentResult, void, void>;
}

function isIncremental(result: unknown): result is Incrementalish {
  return typeof result === 'object' && result !== null && 'initialResult' in result;
}

// Reassemble graphql 17's incremental delivery stream into a single complete ExecutionResult.
// Each `pending` entry maps an `id` to the path its later payloads attach to; defer payloads carry
// `data` to deep-merge at that path, stream payloads carry `items` to append to the list there.
// A deferred/streamed group whose resolver throws reports its error via `completed[].errors` (not
// `incremental[].errors`), so those are collected too — otherwise a failing fragment would produce
// a false-passing `{ data }` result instead of `{ data, errors }`.
async function collectIncremental(result: Incrementalish): Promise<ExecutionResult> {
  // Preserve a `null` root (a non-null field error propagating to the root) rather than coercing it
  // to `{}`, so the collapsed result matches what graphql 16's `execute` returns.
  const data = (result.initialResult.data === undefined ? {} : result.initialResult.data) as Record<
    string,
    unknown
  > | null;
  const errors = [...((result.initialResult.errors ?? []) as unknown[])];
  const pathById = new Map<string, ReadonlyArray<string | number>>();

  const registerPending = (pending?: readonly PendingResult[]) => {
    for (const entry of pending ?? []) {
      pathById.set(entry.id, entry.path);
    }
  };

  registerPending(result.initialResult.pending);

  for await (const chunk of result.subsequentResults) {
    registerPending(chunk.pending);

    for (const entry of chunk.completed ?? []) {
      if (entry.errors) {
        errors.push(...entry.errors);
      }
    }

    for (const payload of chunk.incremental ?? []) {
      const basePath = pathById.get(payload.id) ?? [];
      const fullPath = [...basePath, ...(payload.subPath ?? [])];

      if (payload.errors) {
        errors.push(...payload.errors);
      }

      if (payload.items !== undefined) {
        const list = valueAtPath(data, fullPath);
        if (Array.isArray(list)) {
          list.push(...payload.items);
        }
      } else if (payload.data != null) {
        const target = valueAtPath(data, fullPath);
        if (target && typeof target === 'object') {
          deepMerge(target as Record<string, unknown>, payload.data);
        }
      }
    }
  }

  return errors.length > 0 ? { data, errors: errors as ExecutionResult['errors'] } : { data };
}

function valueAtPath(root: unknown, path: ReadonlyArray<string | number>): unknown {
  let current = root;
  for (const key of path) {
    if (current == null) {
      return undefined;
    }
    current = (current as Record<string | number, unknown>)[key];
  }
  return current;
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key of Object.keys(source)) {
    const value = source[key];
    const existing = target[key];

    if (
      value != null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      existing != null &&
      typeof existing === 'object' &&
      !Array.isArray(existing)
    ) {
      deepMerge(existing as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      target[key] = value;
    }
  }
}
