import {
  brandWithType,
  isThenable,
  type MaybePromise,
  type OutputType,
  PothosValidationError,
  type SchemaTypes,
} from '@pothos/core';
import {
  cacheKey,
  Plan,
  type PlayedPlan,
  setLoaderMappings,
  setRowFieldMapping,
} from '@pothos/selection-mapper';
import { and, or } from '@prisma/orm-family-sql/orm-client';
import type { GraphQLResolveInfo } from 'graphql';
import {
  emit,
  type MapperCollection,
  narrowToVariant,
  type PrismaNextNode,
  type PrismaNextSpec,
  prismaNextAdapter,
  variantRelationProblem,
} from './utils/adapter.js';
import { getCollectionPaginationState } from './utils/collection-state.js';
import type { PrismaNextConfig } from './utils/config.js';
import { variantOf } from './utils/contract.js';
import { getIdentityFields, type PrismaNextModel, rawKey } from './utils/model.js';

type Row = Record<string, unknown>;
type Played = PlayedPlan<PrismaNextModel, PrismaNextSpec, PrismaNextNode>;

interface Request {
  values: readonly unknown[];
  /** Node loads resolve a missing row to null; a parent row must be found. */
  optional: boolean;
  resolve: (row: Row | null) => void;
  reject: (error: unknown) => void;
}

interface Batch {
  /** Set for node loads, which batch per type and path; parent loads merge compatible plans. */
  group: string | undefined;
  root: PrismaNextNode;
  fields: readonly string[];
  collection: (() => MapperCollection) | undefined;
  requests: Request[];
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
  private readonly parentPlans = new Map<string, MaybePromise<Played>>();
  private readonly nodePlans = new Map<string, MaybePromise<Played>>();
  private readonly staged = new Set<Batch>();

  constructor(
    private readonly context: object,
    private readonly config: PrismaNextConfig,
    private readonly modelName: string,
  ) {
    this.adapter = prismaNextAdapter(config.contract);
    this.identity = getIdentityFields(config.contract, modelName);
    this.variant = variantOf(config.contract, modelName)?.value;
  }

  /** The parent row reloaded with what `info`'s field needs. */
  loadSelection(info: GraphQLResolveInfo, parent: object): Promise<Row> {
    const key = cacheKey(info.parentType.name, info.path);
    let selection = this.parentPlans.get(key);
    if (!selection) {
      selection = Plan.forParentRow(
        this.adapter,
        this.context,
        info,
        this.config.skipDeferredFragments,
        this.variant === undefined ? undefined : { variant: this.variant },
      );
      this.parentPlans.set(key, selection);
    }
    const load = (played: Played) => {
      if (!this.identity.length) {
        throw new PothosValidationError(
          `Fallback loading requires a non-null primary or unique key on model '${this.modelName}'.`,
        );
      }
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
          return row!;
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
    const group = cacheKey(typeName, info.path);
    let selection = this.nodePlans.get(group);
    if (!selection) {
      const plan = Plan.fromInfo(this.adapter, {
        context: this.context,
        info,
        typeName,
        initial: this.variant === undefined ? undefined : { variant: this.variant },
        skipDeferredFragments: this.config.skipDeferredFragments,
      })!;
      const play = (settled: typeof plan) => {
        const played = settled.play();
        const problem = variantRelationProblem(this.adapter.toQuery(played.root), settled.model);
        if (problem) {
          throw new PothosValidationError(problem.message);
        }
        return played;
      };
      selection = isThenable(plan)
        ? Promise.resolve(plan).then((p) => play(p as typeof plan))
        : play(plan);
      this.nodePlans.set(group, selection);
    }
    const load = (played: Played) => {
      setLoaderMappings(this.context, info, played.mappings);
      return this.stage(group, played.root, fields, collection, values, true).then((row) => {
        if (row) {
          brandWithType(row, typeName as unknown as OutputType<SchemaTypes>);
        }
        return row;
      });
    };
    return isThenable(selection) ? Promise.resolve(selection).then(load) : load(selection);
  }

  private stage(
    group: string | undefined,
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
    if (batch) {
      if (group === undefined) {
        this.adapter.mergeNode(batch.root, root);
      }
    } else {
      const created: Batch = {
        group,
        root: this.adapter.createNode(root.model),
        fields,
        collection,
        requests: [],
      };
      this.adapter.mergeNode(created.root, root);
      for (const field of fields) {
        created.root.columns.add(field);
      }
      this.staged.add(created);
      // A macrotask, so async select callbacks can join the batch.
      setTimeout(() => {
        this.staged.delete(created);
        this.flush(created).catch((error) => {
          for (const request of created.requests) {
            request.reject(error);
          }
        });
      }, 0);
      batch = created;
    }
    const target = batch;
    return new Promise((resolve, reject) => {
      target.requests.push({ values, optional, resolve, reject });
    });
  }

  private async flush(batch: Batch): Promise<void> {
    const provided = batch.collection
      ? batch.collection()
      : this.config.collection(this.context, this.modelName);
    // Load through the base narrowed to the variant, which can include its relations.
    const base =
      this.variant !== undefined && provided.state?.variantValue !== this.variant
        ? narrowToVariant(provided, this.variant)
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
    const keyed = batch.requests.map((request) => ({ request, key: key(request.values) }));
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
    const query = emit(
      filtered,
      this.adapter.toQuery(batch.root),
      batch.root.model,
      this.context,
    ) as MapperCollection & { all(): Promise<readonly Row[]> };
    const rows = await query.all();
    const byKey = new Map(rows.map((row) => [key(fields.map((field) => row[field])), row]));
    for (const { request, key } of keyed) {
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
}
