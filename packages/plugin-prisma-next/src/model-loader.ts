import {
  brandWithType,
  completeValue,
  isThenable,
  type MaybePromise,
  type OutputType,
  PothosValidationError,
  type SchemaTypes,
} from '@pothos/core';
import {
  cacheKey,
  type Mapping,
  Plan,
  type PlayedPlan,
  setLoaderMappings,
  setRowFieldMapping,
} from '@pothos/selection-mapper';
import { and, or } from '@prisma/orm-family-sql/orm-client';
import type { GraphQLResolveInfo } from 'graphql';
import type { MapperCollection, PrismaNextNode, PrismaNextPlan } from './utils/adapter.js';
import { getCollectionPaginationState } from './utils/collection-state.js';
import type { PrismaNextConfig } from './utils/config.js';
import { variantOf } from './utils/contract.js';
import { getIdentityFields, type PrismaNextModel, rawKey } from './utils/model.js';
import {
  COMPUTE,
  type Compute,
  type PrismaNextQuery,
  REFINE,
  type Refine,
} from './utils/selections.js';

type Row = Record<string, unknown>;
type Played = PlayedPlan<PrismaNextModel, PrismaNextQuery>;

interface Request {
  values: readonly unknown[];
  /** Node loads resolve a missing row to null; a parent row must be found. */
  optional: boolean;
  resolve: (row: Row | null) => void;
  reject: (error: unknown) => void;
}

/** The requests one plan staged into a batch. */
interface Part {
  root: PrismaNextNode;
  requests: Request[];
}

interface Batch {
  /**
   * Set for node loads, which batch per plan (one per type and path of an execution); parent
   * loads merge compatible plans.
   */
  group: PrismaNextNode | undefined;
  root: PrismaNextNode;
  fields: readonly string[];
  collection: (() => MapperCollection) | undefined;
  parts: Part[];
}

interface Plans {
  parent: Map<string, MaybePromise<Played>>;
  node: Map<string, MaybePromise<Played>>;
}

interface KeyColumn {
  eq(value: unknown): never;
  in(values: unknown[]): never;
}

/**
 * Loads rows by a non-null unique key, batched per request: fallback selections for parent rows,
 * deferred fragments, and Relay `node(id:)` lookups.
 */
export class ModelLoader {
  private readonly adapter;
  private readonly identity: readonly string[];
  private readonly variant: string | undefined;
  /** A variant's rows load through the base narrowed to it, which can include its relations. */
  private readonly initial: PrismaNextQuery | undefined;
  /**
   * Plans depend on the operation and its variables (arguments, `@skip`/`@include`), so they are
   * cached per execution (`info.variableValues` is built once per execution): an operation run on a
   * context an earlier operation used is planned afresh. Loader mappings are still stored on the
   * context by response path, so operations running at the same time should not share a context.
   */
  private readonly plans = new WeakMap<object, Plans>();
  private readonly staged = new Set<Batch>();

  constructor(
    private readonly context: object,
    private readonly config: PrismaNextConfig,
    private readonly modelName: string,
  ) {
    this.adapter = config.adapter;
    this.identity = getIdentityFields(config.contract, modelName);
    this.variant = variantOf(config.contract, modelName)?.value;
    this.initial =
      this.variant === undefined ? undefined : { args: { variant: { value: this.variant } } };
  }

  private plansFor(info: GraphQLResolveInfo): Plans {
    let plans = this.plans.get(info.variableValues);
    if (!plans) {
      plans = { parent: new Map(), node: new Map() };
      this.plans.set(info.variableValues, plans);
    }
    return plans;
  }

  /** The parent row reloaded with what `info`'s field needs, and the field's mapping in that load. */
  loadSelection(
    info: GraphQLResolveInfo,
    parent: object,
  ): Promise<{ row: Row; mapping: Mapping | undefined }> {
    const key = cacheKey(info.parentType.name, info.path);
    const plans = this.plansFor(info).parent;
    let selection = plans.get(key);
    if (!selection) {
      selection = Plan.forParentRow(this.adapter, this.context, info, undefined, this.initial);
      plans.set(key, selection);
    }
    const load = (played: Played) => {
      const values = this.identity.map((field) => {
        const value = (parent as Row)[field];
        if (value == null) {
          throw new PothosValidationError(
            `Fallback loading requires identity field '${this.modelName}.${field}' on the parent row.`,
          );
        }
        return value;
      });
      return this.stage(undefined, played.root, this.identity, undefined, values, false).then(
        (row) => {
          const mapping = played.mappings[`${info.parentType.name}@${info.path.key}`];
          if (mapping) {
            setRowFieldMapping(this.context, info, mapping, row!);
          }
          return { row: row!, mapping };
        },
      );
    };
    return isThenable(selection) ? Promise.resolve(selection).then(load) : load(selection);
  }

  /** The row of a Relay node, planned for `info`'s selection on `typeName`, or null. */
  loadNode(
    info: GraphQLResolveInfo,
    typeName: string,
    fields: readonly string[],
    values: readonly unknown[],
    collection: (() => MapperCollection) | undefined,
  ): Promise<Row | null> {
    // Keyed on the type, not the model: variants of one model have their own selection.
    const key = cacheKey(typeName, info.path);
    const plans = this.plansFor(info).node;
    let selection = plans.get(key);
    if (!selection) {
      const plan = Plan.fromInfo(this.adapter, {
        context: this.context,
        info,
        typeName,
        initial: this.initial,
      }) as MaybePromise<PrismaNextPlan>;
      selection = completeValue(plan, (settled) => settled.play());
      plans.set(key, selection);
    }
    const load = (played: Played) => {
      setLoaderMappings(this.context, info, played.mappings);
      return this.stage(played.root, played.root, fields, collection, values, true).then((row) => {
        if (row) {
          brandWithType(row, typeName as OutputType<SchemaTypes>);
        }
        return row;
      });
    };
    return isThenable(selection) ? Promise.resolve(selection).then(load) : load(selection);
  }

  private stage(
    group: PrismaNextNode | undefined,
    root: PrismaNextNode,
    fields: readonly string[],
    collection: (() => MapperCollection) | undefined,
    values: readonly unknown[],
    optional: boolean,
  ): Promise<Row | null> {
    let batch = [...this.staged].find((candidate) =>
      group === undefined
        ? candidate.group === undefined && this.adapter.canMergeNode(candidate.root, root)
        : candidate.group === group,
    );
    if (!batch) {
      const created = this.createBatch(group, root.model, [], fields, collection);
      this.staged.add(created);
      // A macrotask, so async select callbacks can join the batch.
      setTimeout(() => {
        this.staged.delete(created);
        this.run(created);
      }, 0);
      batch = created;
    }
    let part = batch.parts.find((candidate) => candidate.root === root);
    if (!part) {
      part = { root, requests: [] };
      batch.parts.push(part);
      this.adapter.mergeNode(batch.root, root);
    }
    const target = part;
    return new Promise((resolve, reject) => {
      target.requests.push({ values, optional, resolve, reject });
    });
  }

  private createBatch(
    group: PrismaNextNode | undefined,
    model: PrismaNextNode['model'],
    parts: Part[],
    fields: readonly string[],
    collection: (() => MapperCollection) | undefined,
  ): Batch {
    const root = this.adapter.createNode(model);
    for (const part of parts) {
      this.adapter.mergeNode(root, part.root);
    }
    for (const field of fields) {
      root.columns?.add(field);
    }
    return { group, root, fields, collection, parts };
  }

  /**
   * Loads a batch, failing only the requests an error belongs to. Merged plans are emitted once
   * with their refine/compute callbacks guarded (`CallbackGuard`): a plan whose callback throws
   * fails, and the others load in the same statement without running their callbacks again. Only
   * a plan sharing a load with a failed one, or every plan when the query fails outside a callback,
   * is retried (on its own), running its callbacks a second time. Errors the database raises still
   * fail every merged plan.
   */
  private run(batch: Batch): void {
    this.flush(batch).catch((error: unknown) => {
      if (error instanceof PlanError && batch.parts.length > 1) {
        for (const part of batch.parts) {
          this.retry(batch, [part]);
        }
        return;
      }
      const cause = error instanceof PlanError ? error.cause : error;
      for (const part of batch.parts) {
        for (const request of part.requests) {
          request.reject(cause);
        }
      }
    });
  }

  private retry(batch: Batch, parts: Part[]) {
    this.run(
      this.createBatch(batch.group, batch.root.model, parts, batch.fields, batch.collection),
    );
  }

  private async flush(batch: Batch): Promise<void> {
    const provided = batch.collection
      ? batch.collection()
      : this.config.collection(this.context, this.modelName);
    const base =
      this.variant !== undefined && provided.state?.variantValue !== this.variant
        ? provided.variant(this.variant)
        : provided;
    if (getCollectionPaginationState(base).paginated) {
      throw new PothosValidationError(
        `The collection for '${this.modelName}' must be unpaginated. Return a collection without limit(), offset(), or cursor().`,
      );
    }
    const { fields } = batch;
    const codecs = this.config.codecs(this.context, this.modelName);
    const key = (values: readonly unknown[]) =>
      JSON.stringify(
        values.map((value, i) => {
          const codec = codecs(fields[i]!);
          return codec ? codec.key(value) : rawKey(value);
        }),
      );
    // A parent whose identity the codecs reject fails alone, and is dropped from its part so a
    // retry of the part does not key it again.
    const keyed: { request: Request; key: string; part: Part }[] = [];
    for (const part of batch.parts) {
      part.requests = part.requests.filter((request) => {
        try {
          keyed.push({ request, key: key(request.values), part });
          return true;
        } catch (error) {
          request.reject(error);
          return false;
        }
      });
    }
    if (keyed.length === 0) {
      return;
    }
    const distinct = [...new Map(keyed.map(({ request, key }) => [key, request.values])).values()];
    const filtered = base.where((model: Record<string, KeyColumn>) =>
      fields.length === 1
        ? model[fields[0]!]!.in(distinct.map((values) => values[0]))
        : or(
            ...distinct.map((values) =>
              and(...fields.map((field, i) => model[field]!.eq(values[i]))),
            ),
          ),
    );
    const merged = this.adapter.toQuery(batch.root);
    const guard = batch.parts.length > 1 ? new CallbackGuard() : undefined;
    let query: MapperCollection & { all(): Promise<readonly Row[]> };
    try {
      query = this.adapter.emit(
        filtered,
        guard ? guard.wrap(merged) : merged,
        batch.root.model,
        this.context,
      ) as typeof query;
    } catch (error) {
      throw new PlanError(error);
    }
    const failed = guard ? this.isolateFailures(batch, guard) : undefined;
    const loading = failed ? keyed.filter(({ part }) => !failed.has(part)) : keyed;
    if (loading.length === 0) {
      return;
    }
    const rows = await query.all();
    const byKey = new Map(rows.map((row) => [key(fields.map((field) => row[field])), row]));
    for (const { request, key } of loading) {
      const row = byKey.get(key);
      if (row || request.optional) {
        request.resolve(row ?? null);
      } else {
        request.reject(
          new PothosValidationError(
            `Fallback loading could not find model '${this.modelName}' for the parent identity.`,
          ),
        );
      }
    }
  }

  /**
   * After a guarded emit, the parts that can't read the statement: a part whose own callback threw
   * fails with that error, and a part that shares a load with a failed one (the failed load stands
   * in for its own, which never ran) is retried in a batch of its own. Undefined when no callback
   * threw.
   */
  private isolateFailures(batch: Batch, guard: CallbackGuard): Set<Part> | undefined {
    if (guard.failures.size === 0) {
      return undefined;
    }
    const failed = new Set<Part>();
    const tainted: Part[] = [];
    for (const part of batch.parts) {
      const own = collectCallbacks(this.adapter.toQuery(part.root));
      const thrown = [...guard.failures].find(([callback]) => own.callbacks.has(callback));
      if (thrown) {
        failed.add(part);
        for (const request of part.requests) {
          request.reject(thrown[1]);
        }
      } else if (guard.unsafe(own.paths)) {
        failed.add(part);
        tainted.push(part);
      }
    }
    if (tainted.length === batch.parts.length) {
      // No part owns the failed callback: retrying them together would fail the same way.
      throw new PlanError([...guard.failures.values()][0]);
    }
    if (tainted.length > 0) {
      this.retry(batch, tainted);
    }
    return failed;
  }
}

/**
 * Wraps the refine/compute callbacks of a merged query so one that throws doesn't fail the plans
 * merged with it: the error is recorded against the callback and the load it would have refined
 * is emptied (`limit(0)`), so the rest of the statement still builds and every callback runs once.
 */
class CallbackGuard {
  /** Callbacks that threw, with their errors. */
  readonly failures = new Map<Refine | Compute, unknown>();
  private readonly failedPaths = new Set<string>();
  /** Refinements that have not run: after the emit, loads another consumer's load stood in for. */
  private readonly pending = new Set<string>();
  private refineFailed = false;

  /**
   * Whether a part with these load paths can't read the statement: one of them was emptied, or a
   * refinement failed and one of them was served by another consumer's load, which may be it.
   */
  unsafe(paths: Iterable<string>): boolean {
    for (const path of paths) {
      if (this.failedPaths.has(path) || (this.refineFailed && this.pending.has(path))) {
        return true;
      }
    }
    return false;
  }

  wrap(query: PrismaNextQuery, prefix = ''): PrismaNextQuery {
    const copy: PrismaNextQuery = { ...query };
    if (query.relations) {
      copy.relations = {};
      for (const [key, child] of Object.entries(query.relations)) {
        const path = `${prefix}/${key}`;
        const wrapped = this.wrap(child, path);
        const refine = child.args?.[REFINE];
        if (refine) {
          this.pending.add(path);
          wrapped.args = {
            ...child.args,
            [REFINE]: (rel) => {
              this.pending.delete(path);
              try {
                return refine(rel);
              } catch (error) {
                this.fail(refine, path, error);
                this.refineFailed = true;
                return rel.limit(0);
              }
            },
          };
        }
        copy.relations[key] = wrapped;
      }
    }
    if (query.computed) {
      copy.computed = {};
      for (const [key, value] of Object.entries(query.computed)) {
        const path = `${prefix}/${key}`;
        const compute = value[COMPUTE];
        copy.computed[key] = {
          ...value,
          [COMPUTE]: (rel, ctx) => {
            try {
              return compute(rel, ctx);
            } catch (error) {
              this.fail(compute, path, error);
              // An unread slot: combine() needs at least one branch.
              return { failed: rel.limit(0) };
            }
          },
        };
      }
    }
    return copy;
  }

  private fail(callback: Refine | Compute, path: string, error: unknown) {
    this.failures.set(callback, error);
    this.failedPaths.add(path);
  }
}

/** The refine/compute callbacks of `query`, and the paths of its loads. */
function collectCallbacks(
  query: PrismaNextQuery,
  prefix = '',
  found = { callbacks: new Set<Refine | Compute>(), paths: new Set<string>() },
) {
  for (const [key, child] of Object.entries(query.relations ?? {})) {
    const path = `${prefix}/${key}`;
    found.paths.add(path);
    const refine = child.args?.[REFINE];
    if (refine) {
      found.callbacks.add(refine);
    }
    collectCallbacks(child, path, found);
  }
  for (const [key, value] of Object.entries(query.computed ?? {})) {
    found.paths.add(`${prefix}/${key}`);
    found.callbacks.add(value[COMPUTE]);
  }
  return found;
}

/** Building a batch's query failed, which one of its merged plans may be to blame for. */
class PlanError extends Error {
  constructor(override readonly cause: unknown) {
    super('Building the batched query failed', { cause });
    this.name = 'PlanError';
  }
}
