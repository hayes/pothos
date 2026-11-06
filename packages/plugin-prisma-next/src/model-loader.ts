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
import type { GraphQLObjectType, GraphQLResolveInfo } from 'graphql';
import type { MapperCollection, PrismaNextNode, PrismaNextPlan } from './utils/adapter.js';
import type { PrismaNextConfig } from './utils/config.js';
import { variantOf } from './utils/contract.js';
import { InternalError, keepError } from './utils/errors.js';
import { getIdentityFields, getModel, type PrismaNextModel } from './utils/model.js';
import { type PrismaNextSelection, registerPlanRoots, withOtherKeys } from './utils/selections.js';

type Row = Record<string, unknown>;
type Played = PlayedPlan<PrismaNextModel, PrismaNextSelection>;

interface Request {
  values: readonly unknown[];
  resolve: (row: Row | null) => void;
  reject: (error: unknown) => void;
}

/**
 * What a staged request loads. Requests join any batch of the same load whose plan they merge
 * with. A node load is of one type, whose `id.field` and `collection` it uses, and resolves a
 * missing row to null. For a parent load, a missing row is an error. A completion load adds to rows
 * the loader just returned, and leaves out a row it can't find.
 */
type Load =
  | { kind: 'node'; typeName: string; collection: ((ctx: object) => MapperCollection) | undefined }
  | { kind: 'parent' | 'complete'; typeName?: undefined; collection?: undefined };

interface Batch {
  load: Load;
  root: PrismaNextNode;
  fields: readonly string[];
  /** The plan roots merged into `root`, each once. */
  merged: Set<PrismaNextNode>;
  requests: Request[];
}

interface Plans {
  parent: Map<string, MaybePromise<Played>>;
  node: Map<string, MaybePromise<Played>>;
  type: Map<string, MaybePromise<Played>>;
}

interface IdentityColumn {
  eq(value: unknown): never;
  in(values: unknown[]): never;
}

/**
 * Loads rows by their identity, batched per request: reload selections for parent rows,
 * deferred fragments, and Relay `node(id:)` lookups.
 */
export class ModelLoader {
  private readonly identity: readonly string[];
  private readonly variant: string | undefined;
  /** A variant's rows load through the base narrowed to it, which can include its relations. */
  private readonly initial: PrismaNextSelection | undefined;
  /**
   * Plans depend on the operation and its variables, which include `@skip` and `@include`
   * arguments. They are cached per operation, keyed on `info.variableValues`, which graphql-js
   * creates once per operation and shares across its subscription events. Loader mappings are stored on the context by response path, so
   * operations running at the same time should not share a context.
   */
  private readonly plans = new WeakMap<object, Plans>();
  private readonly staged = new Set<Batch>();
  /** `loadTypeRow`'s loads, by root field path, row, then type. */
  private readonly reloads = new WeakMap<object, WeakMap<object, Map<string, Promise<Row>>>>();
  /** The plan root `completeRows` stages for each selection. */
  private readonly completions = new WeakMap<PrismaNextSelection, PrismaNextNode>();

  constructor(
    private readonly context: object,
    private readonly config: PrismaNextConfig,
    private readonly modelKey: string,
  ) {
    this.identity = getIdentityFields(config.contract, modelKey);
    this.variant = variantOf(config.contract, modelKey)?.value;
    this.initial =
      this.variant === undefined ? undefined : { args: { variant: { value: this.variant } } };
  }

  /** Without a key a reload would match every row, and each parent would read the first one. */
  private assertIdentity(info: GraphQLResolveInfo) {
    if (!this.identity.length) {
      // It names its field, so `reloadFor` passes it on as it is.
      throw keepError(
        new InternalError(
          `Field '${info.parentType.name}.${info.fieldName}' needs its parent reloaded, but model '${this.modelKey}' has no non-null primary or unique key to reload it by. Add one, or load its rows through prisma fields without @defer.`,
        ),
      );
    }
  }

  private plansFor(info: GraphQLResolveInfo): Plans {
    registerPlanRoots(info);
    let plans = this.plans.get(info.variableValues);
    if (!plans) {
      plans = { parent: new Map(), node: new Map(), type: new Map() };
      this.plans.set(info.variableValues, plans);
    }
    return plans;
  }

  /** The parent row reloaded with what `info`'s field needs, and the field's mapping in that load. */
  loadSelection(
    info: GraphQLResolveInfo,
    parent: object,
  ): Promise<{ row: Row; mapping: Mapping | undefined }> {
    this.assertIdentity(info);
    const key = cacheKey(info.parentType.name, info.path);
    const plans = this.plansFor(info).parent;
    let selection = plans.get(key);
    if (!selection) {
      // The selects of the field and those beneath it run here. What planning throws reaches the
      // field as it is, as it reaches a prisma field planned for the parent query. The planner's
      // own errors are already generic.
      const planned: MaybePromise<Played> = userCode(() =>
        Plan.forParentRow(this.config.adapter, {
          context: this.context,
          info,
          initial: this.initial,
        }),
      );
      selection = isThenable(planned)
        ? (Promise.resolve(planned) as Promise<Played>).catch((error: unknown) => {
            throw keepError(error);
          })
        : planned;
      plans.set(key, selection);
    }
    const load = (played: Played) => {
      const values = this.identity.map((field) => (parent as Row)[field]);
      const staged = this.stage(played.root, this.identity, values, { kind: 'parent' });
      return staged.then((reloaded) => {
        const row = withOtherKeys(reloaded!, parent, played.root.model);
        // The plan is walked from the parent type, so the field's own mapping is keyed by the
        // parent type and the field's response key.
        const mapping = played.mappings[`${info.parentType.name}@${info.path.key}`];
        if (mapping) {
          setRowFieldMapping(this.context, info, mapping, row);
        }
        return { row, mapping };
      });
    };
    return completeValue(selection, load) as Promise<{ row: Row; mapping: Mapping | undefined }>;
  }

  /**
   * The parent row reloaded with every column and what the `select`s of `type` and its interfaces
   * load. Unlike `loadSelection`, it plans none of the field, so every field of a row shares it,
   * and the type's relations are never left out for the field's. The row's keys that aren't the
   * model's columns or relations are kept. Cached per root field of each execution, which graphql
   * makes a new path for, so scope-auth's checks and the fields share one load.
   */
  loadTypeRow(info: GraphQLResolveInfo, parent: object, type: GraphQLObjectType): Promise<Row> {
    this.assertIdentity(info);
    const key = type.name;
    const plans = this.plansFor(info).type;
    let root = info.path;
    while (root.prev) {
      root = root.prev;
    }
    let rows = this.reloads.get(root);
    if (!rows) {
      rows = new WeakMap();
      this.reloads.set(root, rows);
    }
    let loads = rows.get(parent);
    const loaded = loads?.get(key);
    if (loaded) {
      return loaded;
    }
    let selection = plans.get(key);
    if (!selection) {
      const plan = new Plan(
        this.config.adapter,
        { context: this.context, info },
        type,
        undefined,
        this.initial,
      );
      selection = completeValue(plan.finish(plan.enterParentType, type), (played) => {
        this.config.adapter.mergeQuery(played.root, { columns: null });
        return played;
      });
      plans.set(key, selection);
    }
    const load = (played: Played) =>
      this.stage(
        played.root,
        this.identity,
        this.identity.map((field) => (parent as Row)[field]),
        { kind: 'parent' },
      ).then((reloaded) => withOtherKeys(reloaded!, parent, played.root.model));
    const row = completeValue(selection, load) as Promise<Row>;
    if (!loads) {
      loads = new Map();
      rows.set(parent, loads);
    }
    loads.set(key, row);
    return row;
  }

  /** The row of a Relay node, planned for `info`'s selection on `typeName`, or null. */
  loadNode(
    info: GraphQLResolveInfo,
    typeName: string,
    fields: readonly string[],
    values: readonly unknown[],
    collection: ((ctx: object) => MapperCollection) | undefined,
  ): Promise<Row | null> {
    // Keyed on the type rather than the model, because variants of a model select differently.
    const key = cacheKey(typeName, info.path);
    const plans = this.plansFor(info).node;
    let selection = plans.get(key);
    if (!selection) {
      // As in `loadSelection`, what planning throws reaches the field as it is.
      const planned: MaybePromise<Played> = userCode(() =>
        completeValue(
          Plan.fromInfo(this.config.adapter, {
            context: this.context,
            info,
            typeName,
            initial: this.initial,
          }) as MaybePromise<PrismaNextPlan>,
          (settled) => settled.play(),
        ),
      );
      selection = isThenable(planned)
        ? (Promise.resolve(planned) as Promise<Played>).catch((error: unknown) => {
            throw keepError(error);
          })
        : planned;
      plans.set(key, selection);
    }
    const load = (played: Played) => {
      setLoaderMappings(this.context, info, played.mappings);
      const load: Load = { kind: 'node', typeName, collection };
      return this.stage(played.root, fields, values, load).then((row) => {
        if (row) {
          brandWithType(row, typeName as OutputType<SchemaTypes>);
        }
        return row;
      });
    };
    return completeValue(selection, load) as Promise<Row | null>;
  }

  /**
   * Loads `selection`'s columns and relations onto `rows`, rows of this loader's variant model that
   * loaded through the variant model's own accessor, which can't include the base model's relations
   * or, for a variant with a table of its own, read the base's columns. They load here through the
   * base model narrowed to the variant, batched with every other request. Resolves to the rows it
   * found: the variant model's own table can hold a row whose base row is of another variant.
   */
  completeRows(rows: readonly Row[], selection: PrismaNextSelection): Promise<Row[]> | undefined {
    // A model without an identity can't be reloaded. Its fields fail as they would otherwise.
    if (!rows.length || !this.identity.length) {
      return undefined;
    }
    const { adapter } = this.config;
    let root = this.completions.get(selection);
    if (!root) {
      root = adapter.createNode(getModel(this.config.contract, this.modelKey));
      if (this.initial) {
        adapter.mergeQuery(root, this.initial);
      }
      adapter.mergeQuery(root, selection);
      this.completions.set(selection, root);
    }
    const names = [...(selection.columns ?? []), ...Object.keys(selection.relations ?? {})];
    return Promise.all(
      rows.map((row) =>
        this.stage(
          root,
          this.identity,
          this.identity.map((field) => row[field]),
          { kind: 'complete' },
        ).then((loaded) => {
          if (loaded) {
            for (const name of names) {
              row[name] = loaded[name];
            }
          }
          return loaded && row;
        }),
      ),
    ).then((completed) => completed.filter((row) => row !== null));
  }

  private stage(
    root: PrismaNextNode,
    fields: readonly string[],
    values: readonly unknown[],
    load: Load,
  ): Promise<Row | null> {
    let batch = [...this.staged].find(
      (candidate) =>
        candidate.load.kind === load.kind &&
        candidate.load.typeName === load.typeName &&
        // Every row reloading through one selection stages the same root, which joins the batch
        // it was merged into without checking the merge again.
        (candidate.merged.has(root) || this.config.adapter.canMergeNode(candidate.root, root)),
    );
    if (!batch) {
      const created: Batch = {
        load,
        root: this.config.adapter.createNode(root.model),
        fields,
        merged: new Set(),
        requests: [],
      };
      for (const field of fields) {
        created.root.columns?.add(field);
      }
      this.staged.add(created);
      // Flushed in a macrotask so that requests from async select callbacks can join the batch.
      // An error building or running the statement fails every request in the batch.
      setTimeout(() => {
        this.staged.delete(created);
        this.flush(created).catch((error: unknown) => {
          for (const request of created.requests) {
            request.reject(error);
          }
        });
      }, 0);
      batch = created;
    }
    if (!batch.merged.has(root)) {
      batch.merged.add(root);
      this.config.adapter.mergeNode(batch.root, root);
    }
    const { requests } = batch;
    return new Promise((resolve, reject) => {
      requests.push({ values, resolve, reject });
    });
  }

  /** The client's root collection, narrowed to a variant. A provided collection is used as given. */
  private defaultCollection(): MapperCollection {
    const root = this.config.collection(this.context, this.modelKey);
    return this.variant === undefined ? root : root.variant(this.variant);
  }

  private async flush(batch: Batch): Promise<void> {
    const { collection } = batch.load;
    const base = collection ? userCode(() => collection(this.context)) : this.defaultCollection();
    const { fields } = batch;
    const codecs = this.config.codecs(this.modelKey);
    const key = (values: readonly unknown[]) =>
      JSON.stringify(values.map((value, i) => codecs(fields[i]!).key(value)));
    // A value its column codec rejects fails its own request, not the batch. A node's values come
    // from the client's ID, so it fails with a client-safe error.
    const keyed: { request: Request; key: string }[] = [];
    for (const request of batch.requests) {
      try {
        keyed.push({ request, key: key(request.values) });
      } catch (error) {
        request.reject(
          batch.load.kind === 'node' ? keepError(new PothosValidationError('Invalid ID.')) : error,
        );
      }
    }
    if (!keyed.length) {
      return;
    }
    const distinct = [...new Map(keyed.map(({ request, key }) => [key, request.values])).values()];
    const filtered = base.where((model: Record<string, IdentityColumn>) =>
      fields.length === 1
        ? model[fields[0]!]!.in(distinct.map((values) => values[0]))
        : or(
            ...distinct.map((values) =>
              and(...fields.map((field, i) => model[field]!.eq(values[i]))),
            ),
          ),
    );
    // A query callback the statement runs fails every field of the batch, as in a parent query.
    const query = userCode(() =>
      this.config.adapter.emit(
        filtered,
        this.config.adapter.toQuery(batch.root),
        batch.root.model,
        this.context,
      ),
    ) as MapperCollection & { all(): Promise<readonly Row[]> };
    // A reload's database error is the plugin's, which `reloadFor` reports as `Unexpected error.`.
    const rows = await query.all();
    const byKey = new Map(rows.map((row) => [key(fields.map((field) => row[field])), row]));
    for (const { request, key } of keyed) {
      const row = byKey.get(key);
      if (row || batch.load.kind !== 'parent') {
        request.resolve(row ?? null);
      } else {
        request.reject(
          new InternalError(
            `Reloading could not find the '${this.modelKey}' row of the parent's identity.`,
          ),
        );
      }
    }
  }
}

/**
 * Runs code of the app's, such as a query callback, or the client. What it throws reaches the
 * field as it is, so its class still matches, as in the errors plugin's `types`.
 */
function userCode<T>(run: () => T): T {
  try {
    return run();
  } catch (error) {
    throw keepError(error);
  }
}
