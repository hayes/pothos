import {
  brandWithType,
  completeValue,
  type MaybePromise,
  type OutputType,
  PothosValidationError,
  type SchemaTypes,
} from '@pothos/core';
import {
  cacheKey,
  forOperation,
  type Mapping,
  Plan,
  type PlayedPlan,
  setLoaderMappings,
  setRowFieldMapping,
} from '@pothos/selection-mapper';
import { and, or } from '@prisma/orm-family-sql/orm-client';
import type { GraphQLInterfaceType, GraphQLObjectType, GraphQLResolveInfo } from 'graphql';
import type { MapperCollection, PrismaNode, PrismaPlan } from './utils/adapter.js';
import type { PrismaConfig } from './utils/config.js';
import { variantOf } from './utils/contract.js';
import { assertGraphQLJsInfo, InternalError } from './utils/errors.js';
import { getModel, type PrismaModel } from './utils/model.js';
import { sourceOf, withOtherKeys } from './utils/rows.js';
import type { PrismaSelection } from './utils/selections.js';

type Row = Record<string, unknown>;
type Played = PlayedPlan<PrismaModel, PrismaSelection>;

interface Request {
  values: readonly unknown[];
  resolve: (row: Row | null) => void;
  reject: (error: unknown) => void;
}

/** A node load resolves a missing row to null; for a parent load it is an error. */
type Load =
  | { kind: 'node'; typeName: string; collection: ((ctx: object) => MapperCollection) | undefined }
  | { kind: 'parent'; typeName?: undefined; collection?: undefined };

interface Batch {
  load: Load;
  root: PrismaNode;
  fields: readonly string[];
  merged: Set<PrismaNode>;
  requests: Request[];
}

interface IdentityColumn {
  eq(value: unknown): never;
  in(values: unknown[]): never;
}

/** Loads rows by identity, batched per request: parent reloads, deferred fragments and nodes. */
export class ModelLoader {
  private readonly identity: readonly string[];
  /** A variant's rows load through the base narrowed to it, which can include its relations. */
  private readonly initial: PrismaSelection | undefined;
  /** Plans depend on `@skip`/`@include` variables, so are cached per operation. */
  private readonly plans = new WeakMap<object, Map<string, MaybePromise<Played>>>();
  private readonly staged = new Set<Batch>();
  /** By root field path, row, then type. */
  private readonly reloads = new WeakMap<object, WeakMap<object, Map<string, Promise<Row>>>>();

  constructor(
    private readonly context: object,
    private readonly config: PrismaConfig,
    private readonly modelKey: string,
  ) {
    this.identity = getModel(config.contract, modelKey).identity;
    const variant = variantOf(config.contract, modelKey)?.value;
    this.initial = variant === undefined ? undefined : { args: { variant: { value: variant } } };
  }

  /** Without a key a reload would match every row, and each parent would read the first one. */
  private assertIdentity(info: GraphQLResolveInfo) {
    if (!this.identity.length) {
      throw new InternalError(
        `Field '${info.parentType.name}.${info.fieldName}' needs its parent reloaded, but model '${this.modelKey}' has no non-null primary or unique key to reload it by. Add one, or load its rows through prisma fields without @defer.`,
      );
    }
  }

  private cachedPlan(
    info: GraphQLResolveInfo,
    key: string,
    plan: () => MaybePromise<Played>,
  ): MaybePromise<Played> {
    assertGraphQLJsInfo(info);
    const plans = forOperation(this.plans, info);
    return plans.get(key) ?? plans.set(key, plan()).get(key)!;
  }

  /** The parent reloaded with what `info`'s field needs, and the field's mapping. */
  loadSelection(info: GraphQLResolveInfo, parent: object): Promise<{ row: Row; mapping: Mapping }> {
    this.assertIdentity(info);
    const selection = this.cachedPlan(
      info,
      `parent:${cacheKey(info.parentType.name, info.path)}`,
      () =>
        Plan.forParentRow(this.config.adapter, {
          context: this.context,
          info,
          initial: this.initial,
        }),
    );
    const load = (played: Played) =>
      this.reloadParent(played, parent).then((row) => {
        // A reload plans its field first onto an empty level, so the field always has a mapping.
        const mapping = played.mappings[`${info.parentType.name}@${info.path.key}`]!;
        setRowFieldMapping(this.context, info, mapping, row);
        return { row, mapping };
      });
    return completeValue(selection, load) as Promise<{ row: Row; mapping: Mapping }>;
  }

  /**
   * The row scope-auth's checks and `resolveType` read, with every column and what the type's
   * `select`s load. It plans none of the field, so every check of a row shares it. Cached per root
   * field path, so a later mutation or subscription event reloads again.
   */
  loadTypeRow(
    info: GraphQLResolveInfo,
    parent: object,
    type: GraphQLObjectType | GraphQLInterfaceType,
  ): Promise<Row> {
    this.assertIdentity(info);
    const key = type.name;
    const root = rootPath(info);
    const byRow = this.reloads.get(root) ?? this.reloads.set(root, new WeakMap()).get(root)!;
    const row = sourceOf(parent);
    const byType = byRow.get(row) ?? byRow.set(row, new Map()).get(row)!;
    const loaded = byType.get(key);
    if (loaded) {
      return loaded;
    }
    const selection = this.cachedPlan(info, `type:${key}`, () => {
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
    const reloaded = completeValue(selection, (played) =>
      this.reloadParent(played, parent),
    ) as Promise<Row>;
    byType.set(key, reloaded);
    return reloaded;
  }

  loadNode(
    info: GraphQLResolveInfo,
    typeName: string,
    fields: readonly string[],
    values: readonly unknown[],
    collection: ((ctx: object) => MapperCollection) | undefined,
  ): Promise<Row | null> {
    // Keyed on the type rather than the model, because variants of a model select differently.
    const selection = this.cachedPlan(info, `node:${cacheKey(typeName, info.path)}`, () =>
      completeValue(
        Plan.fromInfo(this.config.adapter, {
          context: this.context,
          info,
          typeName,
          initial: this.initial,
        }) as MaybePromise<PrismaPlan>,
        (settled) => settled.play(),
      ),
    );
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

  private reloadParent(played: Played, parent: object): Promise<Row> {
    const values = this.identity.map((field) => (parent as Row)[field]);
    return this.stage(played.root, this.identity, values, { kind: 'parent' }).then((reloaded) =>
      withOtherKeys(reloaded!, parent, played.root.model),
    );
  }

  private stage(
    root: PrismaNode,
    fields: readonly string[],
    values: readonly unknown[],
    load: Load,
  ): Promise<Row | null> {
    let batch = [...this.staged].find(
      (candidate) =>
        candidate.load.kind === load.kind &&
        candidate.load.typeName === load.typeName &&
        // Rows reloading through one selection stage the same root; skip re-checking the merge.
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
      // A macrotask, so requests from async select callbacks can join the batch.
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
    const base = collection
      ? collection(this.context)
      : this.config.typeCollection(this.context, this.modelKey);
    const { fields } = batch;
    const codecs = this.config.codecs(this.modelKey);
    const key = (values: readonly unknown[]) =>
      JSON.stringify(values.map((value, i) => codecs(fields[i]!).key(value)));
    // A value its codec rejects fails its own request, not the batch. A node's values come from
    // the client's ID, so it fails with a client-safe error.
    const keyed: { request: Request; key: string }[] = [];
    for (const request of batch.requests) {
      try {
        keyed.push({ request, key: key(request.values) });
      } catch (error) {
        request.reject(
          batch.load.kind === 'node' ? new PothosValidationError('Invalid ID.') : error,
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
    const selection = this.config.adapter.toQuery(batch.root);
    const query = this.config.adapter.emit(
      filtered,
      selection,
      batch.root.model,
    ) as MapperCollection & {
      all(): Promise<readonly Row[]>;
    };
    const rows = await query.all();
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

function rootPath(info: GraphQLResolveInfo) {
  let root = info.path;
  while (root.prev) {
    root = root.prev;
  }
  return root;
}
