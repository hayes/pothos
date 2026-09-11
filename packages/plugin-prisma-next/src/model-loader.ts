import {
  encodeCursorTuple,
  isThenable,
  type MaybePromise,
  PothosValidationError,
} from '@pothos/core';
import { cacheKey, Plan, type PlayedPlan, setRowFieldMapping } from '@pothos/selection-mapper';
import { and, or } from '@prisma/orm-family-sql/orm-client';
import type { GraphQLResolveInfo } from 'graphql';
import type { AnyContract } from './types.js';
import {
  emit,
  type MapperCollection,
  type PrismaNextNode,
  type PrismaNextSpec,
  prismaNextAdapter,
} from './utils/adapter.js';
import { getCollectionPaginationState } from './utils/collection-state.js';
import { getIdentityFields, type PrismaNextModel } from './utils/model.js';

type Row = Record<string, unknown>;
type Played = PlayedPlan<PrismaNextModel, PrismaNextSpec, PrismaNextNode>;
interface Pending {
  promise: Promise<Row>;
  resolve: (row: Row) => void;
  reject: (error: unknown) => void;
}
interface Batch {
  root: PrismaNextNode;
  parents: Map<object, Pending>;
}
interface KeyColumn {
  eq(value: unknown): never;
  in(values: unknown[]): never;
}

/** Request-local compatible selection batches, following the Prisma and Drizzle loaders. */
export class ModelLoader {
  private readonly adapter;
  private readonly identity: readonly string[];
  private readonly selections = new Map<string, MaybePromise<Played>>();
  private readonly staged = new Set<Batch>();

  constructor(
    private readonly context: object,
    contract: AnyContract,
    private readonly modelName: string,
    private readonly collection: () => MapperCollection | undefined,
    private readonly skipDeferredFragments: boolean,
  ) {
    this.adapter = prismaNextAdapter(contract, true);
    this.identity = getIdentityFields(contract, modelName);
  }

  loadSelection(info: GraphQLResolveInfo, parent: object): Promise<Row> {
    const key = cacheKey(info.parentType.name, info.path);
    let selection = this.selections.get(key);
    if (!selection) {
      selection = Plan.forParentRow(this.adapter, this.context, info, this.skipDeferredFragments);
      this.selections.set(key, selection);
    }
    const load = (played: Played) =>
      this.stage(played, parent).then((row) => {
        const mapping = played.mappings[`${info.parentType.name}@${info.path.key}`];
        if (mapping) {
          setRowFieldMapping(this.context, info, mapping, row);
        }
        return row;
      });
    return isThenable(selection) ? Promise.resolve(selection).then(load) : load(selection);
  }

  private stage(played: Played, parent: object): Promise<Row> {
    for (const batch of this.staged) {
      if (this.adapter.canMergeNode(batch.root, played.root)) {
        this.adapter.mergeNode(batch.root, played.root);
        return this.addParent(batch, parent);
      }
    }
    const root = this.adapter.createNode(played.root.model);
    this.adapter.mergeNode(root, played.root);
    const batch: Batch = { root, parents: new Map() };
    this.staged.add(batch);
    const result = this.addParent(batch, parent);
    // Wait through asynchronous select callbacks, as the Drizzle loader does.
    setTimeout(() => {
      this.staged.delete(batch);
      this.flush(batch).catch((error) => {
        for (const pending of batch.parents.values()) {
          pending.reject(error);
        }
      });
    }, 0);
    return result;
  }

  private addParent(batch: Batch, parent: object): Promise<Row> {
    let pending = batch.parents.get(parent);
    if (!pending) {
      let resolve!: Pending['resolve'];
      let reject!: Pending['reject'];
      const promise = new Promise<Row>((yes, no) => {
        resolve = yes;
        reject = no;
      });
      pending = { promise, resolve, reject };
      batch.parents.set(parent, pending);
    }
    return pending.promise;
  }

  private key(row: Row): string {
    return encodeCursorTuple(
      this.identity.map((field) => {
        const value = row[field];
        if (
          value &&
          typeof value === 'object' &&
          !(value instanceof Date) &&
          !(value instanceof Uint8Array)
        ) {
          // Opaque codec objects can all stringify as {}, which would join unrelated rows.
          if (typeof (value as { toFixed?: unknown }).toFixed !== 'function') {
            throw new PothosValidationError(
              `Fallback identity '${this.modelName}.${field}' has an unsupported object value. Use a scalar, Date, bytes, or Decimal identity.`,
            );
          }
        }
        return value;
      }),
    );
  }

  private async flush(batch: Batch): Promise<void> {
    const base = this.collection();
    if (!base) {
      throw new PothosValidationError(
        `Missing prismaNext.collections entry for model '${this.modelName}'.`,
      );
    }
    if (getCollectionPaginationState(base).paginated) {
      throw new PothosValidationError(
        `Fallback collection for '${this.modelName}' must be unpaginated. Return a collection without limit(), offset(), or cursor().`,
      );
    }
    if (!this.identity.length) {
      throw new PothosValidationError(
        `Fallback loading requires a non-null primary or unique key on model '${this.modelName}'.`,
      );
    }
    const parents = [...batch.parents.keys()] as Row[];
    for (const parent of parents) {
      for (const field of this.identity) {
        if (parent[field] == null) {
          throw new PothosValidationError(
            `Fallback loading requires identity field '${this.modelName}.${field}' on the parent row.`,
          );
        }
        batch.root.columns.add(field);
      }
    }
    const distinct = [...new Map(parents.map((row) => [this.key(row), row])).values()];
    const filtered = base.where((model: Record<string, KeyColumn>) =>
      this.identity.length === 1
        ? model[this.identity[0]].in(distinct.map((parent) => parent[this.identity[0]]))
        : or(
            ...distinct.map((parent) =>
              and(...this.identity.map((field) => model[field].eq(parent[field]))),
            ),
          ),
    );
    const query = emit(
      filtered,
      this.adapter.toQuery(batch.root),
      batch.root.model,
      this.context,
    ) as MapperCollection & {
      all(): Promise<readonly Row[]>;
    };
    const rows = await query.all();
    const byId = new Map(rows.map((row) => [this.key(row), row]));
    for (const [parent, pending] of batch.parents) {
      const row = byId.get(this.key(parent as Row));
      if (row) {
        pending.resolve(row);
      } else {
        pending.reject(
          new PothosValidationError(
            `Fallback loading could not find model '${this.modelName}' for the parent identity.`,
          ),
        );
      }
    }
  }
}
