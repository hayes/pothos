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
import { registerPlanRoots } from './utils/consumers.js';
import { variantOf } from './utils/contract.js';
import { readPage } from './utils/cursors.js';
import { InternalError, isRefusedValue, keepError, refusedError } from './utils/errors.js';
import { getIdentityFields, type PrismaNextModel } from './utils/model.js';
import { markPlanned, rowOf, withOtherKeys } from './utils/row-copies.js';
import { appliesCursors, type PrismaNextSelection } from './utils/selections.js';

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
 * missing row to null. For a parent load, a missing row is an error.
 */
type Load =
  | { kind: 'node'; typeName: string; collection: ((ctx: object) => MapperCollection) | undefined }
  | { kind: 'parent'; typeName?: undefined; collection?: undefined };

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
   * creates once per operation and shares across its subscription events.
   */
  private readonly plans = new WeakMap<object, Plans>();
  private readonly staged = new Set<Batch>();
  /** `loadTypeRow`'s loads, by root field path, row, then type. */
  private readonly reloads = new WeakMap<object, WeakMap<object, Map<string, Promise<Row>>>>();

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

  /** The plan of `kind` cached under `key` for `info`'s operation, made by `plan` on first use. */
  private cachedPlan(
    info: GraphQLResolveInfo,
    kind: keyof Plans,
    key: string,
    plan: () => MaybePromise<Played>,
  ): MaybePromise<Played> {
    const plans = this.plansFor(info)[kind];
    let selection = plans.get(key);
    if (!selection) {
      selection = plan();
      plans.set(key, selection);
    }
    return selection;
  }

  /** The parent row reloaded with what `info`'s field needs, and the field's mapping in that load. */
  loadSelection(
    info: GraphQLResolveInfo,
    parent: object,
  ): Promise<{ row: Row; mapping: Mapping | undefined }> {
    this.assertIdentity(info);
    // The selects of the field and those beneath it run here.
    const selection = this.cachedPlan(
      info,
      'parent',
      cacheKey(info.parentType.name, info.path),
      () =>
        appPlan(() =>
          Plan.forParentRow(this.config.adapter, {
            context: this.context,
            info,
            initial: this.initial,
          }),
        ),
    );
    const load = (played: Played) => {
      const values = this.identity.map((field) => (parent as Row)[field]);
      const staged = this.stage(played.root, this.identity, values, { kind: 'parent' });
      return staged.then((reloaded) => {
        // A batch can hand one row to several executions: each planned it.
        const row = markPlanned(withOtherKeys(reloaded!, parent, played.root.model), info);
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
   * The parent row scope-auth's checks read, reloaded with every column and what the `select`s of
   * `type` and its interfaces load. Unlike `loadSelection`, it plans none of the field, so every
   * check of a row shares it, and every copy of the row. The row's keys that aren't the model's
   * columns or relations are kept. Cached per root field of each execution, which graphql makes a new path for, so a row
   * is reloaded again for a later mutation or subscription event.
   */
  loadTypeRow(info: GraphQLResolveInfo, parent: object, type: GraphQLObjectType): Promise<Row> {
    this.assertIdentity(info);
    const key = type.name;
    const root = rootPath(info);
    let rows = this.reloads.get(root);
    if (!rows) {
      rows = new WeakMap();
      this.reloads.set(root, rows);
    }
    const row = rowOf(parent);
    let loads = rows.get(row);
    const loaded = loads?.get(key);
    if (loaded) {
      return loaded;
    }
    const selection = this.cachedPlan(info, 'type', key, () => {
      const plan = new Plan(
        this.config.adapter,
        { context: this.context, info },
        type,
        undefined,
        this.initial,
      );
      return completeValue(plan.finish(plan.enterParentType, type), (played) => {
        this.config.adapter.mergeQuery(played.root, { columns: null });
        return played;
      });
    });
    const load = (played: Played) =>
      this.stage(
        played.root,
        this.identity,
        this.identity.map((field) => (parent as Row)[field]),
        { kind: 'parent' },
      ).then((reloaded) => markPlanned(withOtherKeys(reloaded!, parent, played.root.model), info));
    const reloaded = completeValue(selection, load) as Promise<Row>;
    if (!loads) {
      loads = new Map();
      rows.set(row, loads);
    }
    loads.set(key, reloaded);
    return reloaded;
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
    const selection = this.cachedPlan(info, 'node', cacheKey(typeName, info.path), () =>
      appPlan(() =>
        completeValue(
          Plan.fromInfo(this.config.adapter, {
            context: this.context,
            info,
            typeName,
            initial: this.initial,
          }) as MaybePromise<PrismaNextPlan>,
          (settled) => settled.play(),
        ),
      ),
    );
    const load = (played: Played) => {
      setLoaderMappings(this.context, info, played.mappings);
      const load: Load = { kind: 'node', typeName, collection };
      return this.stage(played.root, fields, values, load).then((row) => {
        if (row) {
          brandWithType(row, typeName as OutputType<SchemaTypes>);
        }
        return markPlanned(row, info);
      });
    };
    return completeValue(selection, load) as Promise<Row | null>;
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
      // An error building or running the statement fails every request it loads.
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

  private async flush(batch: Batch): Promise<void> {
    const { collection } = batch.load;
    // A provided collection is used as given.
    const base = collection
      ? userCode(() => collection(this.context))
      : this.config.typeCollection(this.context, this.modelKey);
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
    if (keyed.length) {
      await this.load(batch, base, keyed, key);
    }
  }

  /**
   * Loads the rows of `keyed`, requests of `batch`, from `base`, and settles each request. `key`
   * keys a row's identity values.
   */
  private async load(
    batch: Batch,
    base: MapperCollection,
    keyed: readonly { request: Request; key: string }[],
    key: (values: readonly unknown[]) => string,
  ): Promise<void> {
    const { fields } = batch;
    const distinct = new Map(keyed.map(({ request, key }) => [key, request.values]));
    let rows: readonly Row[];
    try {
      const filtered = base.where((model: Record<string, IdentityColumn>) =>
        fields.length === 1
          ? model[fields[0]!]!.in([...distinct.values()].map((values) => values[0]))
          : or(
              ...[...distinct.values()].map((values) =>
                and(...fields.map((field, i) => model[field]!.eq(values[i]))),
              ),
            ),
      );
      const selection = this.config.adapter.toQuery(batch.root);
      // A query callback the statement runs fails every field of the batch, as in a parent query.
      const query = userCode(() =>
        this.config.adapter.emit(filtered, selection, batch.root.model),
      ) as MapperCollection & { all(): Promise<readonly Row[]> };
      // A reload's database error is the plugin's, which `reloadFor` reports as `Unexpected error.`.
      // A refused cursor fails every request of the batch, including other fields' nodes.
      rows = await readPage(query.all(), appliesCursors(selection));
    } catch (error) {
      // Column codecs accept values the database may refuse, such as text holding a NUL. A node's
      // values come from the client's ID, so each ID of the batch loads alone and fails alone.
      const refused = batch.load.kind === 'node' && isRefusedValue(error) ? error : undefined;
      if (refused && distinct.size > 1) {
        await Promise.all(
          [...distinct.keys()].map((id) =>
            this.load(
              batch,
              base,
              keyed.filter((entry) => entry.key === id),
              key,
            ),
          ),
        );
        return;
      }
      for (const { request } of keyed) {
        request.reject(refused ? refusedError('Invalid ID.', refused) : error);
      }
      return;
    }
    const byKey = new Map(rows.map((row) => [key(fields.map((field) => row[field])), row]));
    for (const { request, key } of keyed) {
      const row = byKey.get(key);
      if (row || batch.load.kind === 'node') {
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

/**
 * Runs `plan`, which runs the app's selects. What it throws or rejects with reaches the field as it
 * is, as it reaches a prisma field planned for the parent query. The planner's own errors are
 * already generic.
 */
function appPlan(plan: () => MaybePromise<Played>): MaybePromise<Played> {
  const planned = userCode(plan);
  return isThenable(planned)
    ? (Promise.resolve(planned) as Promise<Played>).catch((error: unknown) => {
        throw keepError(error);
      })
    : planned;
}

/** The path of the root field `info`'s field is beneath. */
function rootPath(info: GraphQLResolveInfo) {
  let root = info.path;
  while (root.prev) {
    root = root.prev;
  }
  return root;
}
