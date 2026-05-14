/**
 * Per-request batching for `prismaNode.load`.
 *
 * Calls that share a `(typeName, pathKey(info.path))` originated from
 * the same schema location in the same operation and so share a
 * selection set by GraphQL semantics — coalesce into one orm-client
 * query that uses `Collection.where(idIn).all()`. Different paths get
 * separate batches.
 *
 * @internal
 */
import { createContextCache } from '@pothos/core';
import type { GraphQLResolveInfo } from 'graphql';
import type { Apply } from './apply';

interface Path {
  readonly prev: Path | undefined;
  readonly key: string | number;
  readonly typename: string | undefined;
}

// Numeric segments (list indexes) drop so all elements of a list share
// one key. Aliases become the segment (`a: node` → `Query.a`).
export function pathKey(path: Path): string {
  const segments: string[] = [];
  let p: Path | undefined = path;
  while (p !== undefined) {
    if (typeof p.key === 'string') {
      segments.push(p.key);
    }
    p = p.prev;
  }
  segments.reverse();
  return segments.join('.');
}

export function idKeyFromRow(row: Record<string, unknown>, idFields: readonly string[]): string {
  if (idFields.length === 1) {
    return String(row[idFields[0]!]);
  }
  return JSON.stringify(idFields.map((f) => row[f]));
}

export function idKeyFromParsed(parsed: unknown, idFields: readonly string[]): string {
  if (idFields.length === 1) {
    return String(parsed);
  }
  if (Array.isArray(parsed)) {
    return JSON.stringify(parsed);
  }
  return String(parsed);
}

interface BatchEntry<IDShape> {
  parsedId: IDShape;
  info: GraphQLResolveInfo;
  resolve: (row: unknown) => void;
  reject: (err: unknown) => void;
}

interface BatchGroup<IDShape> {
  entries: BatchEntry<IDShape>[];
  runner: NodeBatchRunner<IDShape>;
}

interface BatchState<IDShape> {
  groups: Map<string, BatchGroup<IDShape>>;
  scheduled: boolean;
}

// Each group stores its own runner — the user's load callback varies
// by prismaNode type, so interleaved types must each run with their
// own runner, not the first one that arrived.
const batchCache = createContextCache(
  (_ctx: object): BatchState<unknown> => ({ groups: new Map(), scheduled: false }),
);

interface NodeBatchCollection {
  where: (predicate: unknown) => NodeBatchCollection;
}

export interface NodeBatchRunner<IDShape> {
  collection: (ctx: unknown) => NodeBatchCollection;
  buildIdPredicate: (ids: IDShape[]) => (model: Record<string, unknown>) => unknown;
  buildApply: (info: GraphQLResolveInfo) => Apply;
  idFields: readonly string[];
  brandRow?: (row: object) => void;
  typeName: string;
}

export function enqueueNodeLoad<IDShape>(
  context: object,
  groupKey: string,
  parsedId: IDShape,
  info: GraphQLResolveInfo,
  runner: NodeBatchRunner<IDShape>,
): Promise<unknown> {
  const state = batchCache(context) as BatchState<IDShape>;
  return new Promise<unknown>((resolve, reject) => {
    const entry: BatchEntry<IDShape> = { parsedId, info, resolve, reject };
    const existing = state.groups.get(groupKey);
    if (existing) {
      existing.entries.push(entry);
    } else {
      state.groups.set(groupKey, { entries: [entry], runner });
    }
    if (!state.scheduled) {
      state.scheduled = true;
      queueMicrotask(() => flush(state, context));
    }
  });
}

async function flush<IDShape>(state: BatchState<IDShape>, context: unknown): Promise<void> {
  // Snapshot then clear so any further enqueues from sync resolvers
  // after our resolutions start a fresh batch.
  const groups = state.groups;
  state.groups = new Map();
  state.scheduled = false;

  await Promise.all(
    [...groups.values()].map(async ({ entries, runner }) => {
      try {
        const apply = runner.buildApply(entries[0]!.info);
        const ids = entries.map((e) => e.parsedId);
        const base = runner.collection(context);
        const filtered = base.where(runner.buildIdPredicate(ids));
        const applied = apply(filtered) as unknown as {
          all: () => Promise<readonly unknown[]>;
        };
        const result = await applied.all();
        const rows = (Array.isArray(result) ? result : []) as object[];
        const byId = new Map<string, object>();
        for (const row of rows) {
          if (row && typeof row === 'object') {
            byId.set(idKeyFromRow(row as Record<string, unknown>, runner.idFields), row);
          }
        }
        for (const entry of entries) {
          const key = idKeyFromParsed(entry.parsedId, runner.idFields);
          const row = byId.get(key) ?? null;
          if (row && runner.brandRow) {
            runner.brandRow(row);
          }
          entry.resolve(row);
        }
      } catch (err) {
        for (const entry of entries) {
          entry.reject(err);
        }
      }
    }),
  );
}
