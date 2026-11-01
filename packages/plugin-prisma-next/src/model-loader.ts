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
import { materializeRows, type PrismaNextQuery } from './utils/selections.js';

type Row = Record<string, unknown>;
type Played = PlayedPlan<PrismaNextModel, PrismaNextQuery>;

interface Request {
  values: readonly unknown[];
  resolve: (row: Row | null) => void;
  reject: (error: unknown) => void;
}

/** The requests one plan staged into a batch. */
interface Part {
  root: PrismaNextNode;
  requests: Request[];
}

interface StageOptions {
  fields: readonly string[];
  values: readonly unknown[];
  collection?: (() => MapperCollection) | undefined;
  /**
   * Node loads batch per plan (one per type and path of an execution) and resolve a missing row
   * to null; parent loads merge compatible plans, and their rows must be found.
   */
  kind: 'node' | 'parent';
}

interface Batch {
  /** The plan root a node-load batch is for. Unset for parent loads. */
  nodeRoot: PrismaNextNode | undefined;
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
      selection = Plan.forParentRow(this.adapter, {
        context: this.context,
        info,
        initial: this.initial,
      });
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
      const staged = this.stage(played.root, { fields: this.identity, values, kind: 'parent' });
      return staged.then((row) => {
        const mapping = played.mappings[`${info.parentType.name}@${info.path.key}`];
        if (mapping) {
          setRowFieldMapping(this.context, info, mapping, row!);
        }
        return { row: row!, mapping };
      });
    };
    return completeValue(selection, load) as Promise<{ row: Row; mapping: Mapping | undefined }>;
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
      return this.stage(played.root, { fields, values, collection, kind: 'node' }).then((row) => {
        if (row) {
          brandWithType(row, typeName as OutputType<SchemaTypes>);
        }
        return row;
      });
    };
    return completeValue(selection, load) as Promise<Row | null>;
  }

  private stage(
    root: PrismaNextNode,
    { fields, values, collection, kind }: StageOptions,
  ): Promise<Row | null> {
    let batch = [...this.staged].find((candidate) =>
      kind === 'node'
        ? candidate.nodeRoot === root
        : candidate.nodeRoot === undefined && this.adapter.canMergeNode(candidate.root, root),
    );
    if (!batch) {
      const created: Batch = {
        nodeRoot: kind === 'node' ? root : undefined,
        root: this.adapter.createNode(root.model),
        fields,
        collection,
        parts: [],
      };
      for (const field of fields) {
        created.root.columns?.add(field);
      }
      this.staged.add(created);
      // A macrotask, so async select callbacks can join the batch. An error building or running
      // its statement fails every request in it.
      setTimeout(() => {
        this.staged.delete(created);
        this.flush(created).catch((error: unknown) => {
          for (const part of created.parts) {
            for (const request of part.requests) {
              request.reject(error);
            }
          }
        });
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
      target.requests.push({ values, resolve, reject });
    });
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
    // A parent whose identity the codecs reject fails alone.
    const keyed: { request: Request; key: string }[] = [];
    for (const part of batch.parts) {
      for (const request of part.requests) {
        try {
          keyed.push({ request, key: key(request.values) });
        } catch (error) {
          request.reject(error);
        }
      }
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
    const query = this.adapter.emit(
      filtered,
      this.adapter.toQuery(batch.root),
      batch.root.model,
      this.context,
    ) as MapperCollection & { all(): Promise<readonly Row[]> };
    const rows = materializeRows(await query.all(), batch.root.model);
    const byKey = new Map(rows.map((row) => [key(fields.map((field) => row[field])), row]));
    for (const { request, key } of keyed) {
      const row = byKey.get(key);
      if (row || batch.nodeRoot) {
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
