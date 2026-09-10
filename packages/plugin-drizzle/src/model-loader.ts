import { createContextCache, isThenable, type MaybePromise, type SchemaTypes } from '@pothos/core';
import { cacheKey, Plan, setFieldMapping, setRowMappings } from '@pothos/selection-mapper';
import {
  type AnyTable,
  type Column,
  getColumns,
  inArray,
  type SQL,
  sql,
  type TableRelationalConfig,
} from 'drizzle-orm';
import type { GraphQLResolveInfo } from 'graphql';
import {
  type DrizzleAdapter,
  type DrizzleNode,
  type DrizzlePlan,
  type DrizzlePlayedPlan,
  drizzleAdapter,
} from './utils/adapter.js';
import { getClient, getSchemaConfig, type PothosDrizzleSchemaConfig } from './utils/config.js';
import { planFromInfo } from './utils/map-query.js';

interface ResolvablePromise<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (err: unknown) => void;
}

export class ModelLoader {
  context: object;

  builder: PothosSchemaTypes.SchemaBuilder<never>;

  modelName: string;

  // One plan per `Type@path`, a promise while a select beneath the field is async. A parent-row
  // plan is played where it is made, since it is never played behind another selection; a field's
  // plan is played per load, so no two loads share a node.
  rowCache = new Map<string, MaybePromise<DrizzlePlayedPlan>>();

  planCache = new Map<string, MaybePromise<DrizzlePlan>>();

  // Each batch owns the node it accumulates into, so nothing a cached plan or play holds is
  // changed by a row joining the batch.
  staged = new Set<{
    root: DrizzleNode;
    models: Map<object, ResolvablePromise<Record<string, unknown> | null>>;
  }>();

  config: PothosDrizzleSchemaConfig;
  adapter: DrizzleAdapter;
  table: TableRelationalConfig;
  columns: Column[];
  primaryKey: Column[];
  selectSQL: (table: AnyTable<{}>) => SQL;

  constructor(
    context: object,
    builder: PothosSchemaTypes.SchemaBuilder<never>,
    modelName: string,
    columns?: Column[],
  ) {
    this.context = context;
    this.builder = builder;
    this.modelName = modelName;
    this.config = getSchemaConfig(builder);
    this.adapter = drizzleAdapter(this.config);
    this.table = this.config.relations[modelName];
    this.primaryKey = this.config.getPrimaryKey(modelName);
    this.columns = columns ?? this.primaryKey;
    this.selectSQL = (table) => {
      const columns = this.columns.map((column) =>
        Object.values(getColumns(table)).find(
          (tblColumn) => 'columnType' in tblColumn && tblColumn.name === column.name,
        ),
      );
      return columns.length > 1 ? sql`(${sql.join(columns, sql`, `)})` : columns[0]!.getSQL();
    };
  }

  static forModel<Types extends SchemaTypes>(
    modelName: string,
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
    columns?: Column[],
  ) {
    return createContextCache(
      (model) => new ModelLoader(model, builder as never, modelName, columns),
    );
  }

  sqlForModel(model: object) {
    const values = this.columns.map((key) => {
      const columnName = this.config.columnToTsName(key) as keyof typeof model;
      if (columnName in model) {
        return model[columnName] as string | number;
      }

      throw new Error(`Primary key column ${columnName} not found on ${this.modelName}`);
    });

    return this.columns.length > 1 ? values : values[0];
  }

  getSelection(info: GraphQLResolveInfo) {
    const key = cacheKey(info.parentType.name, info.path);
    if (!this.rowCache.has(key)) {
      this.rowCache.set(key, Plan.forParentRow(drizzleAdapter(this.config), this.context, info));
    }

    return this.rowCache.get(key)!;
  }

  getSelectionForField(info: GraphQLResolveInfo, typeName: string) {
    const key = cacheKey(typeName, info.path);
    if (!this.planCache.has(key)) {
      this.planCache.set(
        key,
        // Walked without paths, so there is always a plan.
        planFromInfo({ config: this.config, context: this.context, info, typeName })!,
      );
    }

    return this.planCache.get(key)!;
  }

  /**
   * `model` reloaded with the selection of the field `info` resolves. A synchronous selection
   * stages synchronously, so every row resolved in a tick joins the same batch; only a selection
   * with an async select beneath the field waits for it.
   */
  loadSelection(info: GraphQLResolveInfo, model: object): Promise<Record<string, unknown> | null> {
    const selection = this.getSelection(info);

    return isThenable(selection)
      ? selection.then((settled) => this.loadWith(settled, info, model))
      : this.loadWith(selection, info, model);
  }

  private loadWith(played: DrizzlePlayedPlan, info: GraphQLResolveInfo, model: object) {
    return this.stageQuery(played, model).then((result) => {
      if (result) {
        const mapping = played.mappings[`${info.parentType.name}@${info.path.key}`];

        if (mapping) {
          // Recorded for the field itself too, so its resolver finds the pathInfo it was planned
          // with, along with the mappings of the fields beneath it. Against `result`, the row
          // this plan loaded and the one the resolver is handed: a sibling row of the same list
          // that the planned query did load must keep answering from the plan.
          setFieldMapping(this.context, info, mapping, result);
        }
      }

      return result;
    });
  }

  /** A node loaded by id with the selection beneath the field `info` resolves, as `returnType`. */
  loadSelectionForField(
    info: GraphQLResolveInfo,
    model: object,
    returnType: string,
  ): Promise<Record<string, unknown> | null> {
    const selection = this.getSelectionForField(info, returnType);

    return isThenable(selection)
      ? selection.then((settled) => this.loadFieldWith(settled.play(), info, model))
      : this.loadFieldWith(selection.play(), info, model);
  }

  private loadFieldWith(played: DrizzlePlayedPlan, info: GraphQLResolveInfo, model: object) {
    return this.stageQuery(played, model).then((result) => {
      if (result) {
        // This plan loaded `result` alone, so its mappings are the row's, not the field's.
        setRowMappings(this.context, info, played.mappings, result);
      }

      return result;
    });
  }

  stageQuery(played: DrizzlePlayedPlan, model: object) {
    for (const entry of this.staged) {
      // Node to node: the batch takes the field's play whole, never through a query.
      if (this.adapter.canMergeNode(entry.root, played.root)) {
        this.adapter.mergeNode(entry.root, played.root);

        if (!entry.models.has(model)) {
          entry.models.set(model, createResolvablePromise<Record<string, unknown> | null>());
        }

        return entry.models.get(model)!.promise;
      }
    }

    return this.initLoad(played, model);
  }

  initLoad(played: DrizzlePlayedPlan, model: object) {
    const promise = createResolvablePromise<Record<string, unknown> | null>();
    const root = this.adapter.createNode(played.root.model);

    this.adapter.mergeNode(root, played.root);

    const entry = {
      root,
      models: new Map([[model, promise]]),
    };
    this.staged.add(entry);

    const nextTick = createResolvablePromise<void>();
    const client = getClient(this.builder, this.context);

    nextTick.promise
      .then(() => {
        this.staged.delete(entry);
        const api = (
          client.query as Record<
            string,
            { findMany: (...args: unknown[]) => Promise<Record<string, unknown>[]> }
          >
        )[this.modelName];

        const query = api.findMany({
          ...this.adapter.toQuery(entry.root),
          where: {
            RAW: (table: AnyTable<{}>) =>
              inArray(
                this.selectSQL(table),
                [...entry.models.keys()].map((model) => this.sqlForModel(model)),
              ),
          },
        });

        query.then(
          (results) => {
            for (const [model, promise] of entry.models.entries()) {
              // Matched on the columns the batch was keyed by, which are the columns a row of
              // `entry.models` carries: a node loaded by a column other than the primary key
              // has only that one.
              const result = results.find((row) =>
                this.columns.every(
                  (key) =>
                    row[this.config.columnToTsName(key) as keyof typeof row] ===
                    (model as Record<string, unknown>)[this.config.columnToTsName(key)],
                ),
              );

              if (result) {
                promise.resolve(result);
              } else {
                promise.reject(
                  new Error(`Model ${this.modelName}(${this.sqlForModel(model)}) not found`),
                );
              }
            }
          },
          (err) => {
            for (const promise of entry.models.values()) {
              promise.reject(err);
            }
          },
        );
      })
      .catch((err) => {
        for (const promise of entry.models.values()) {
          promise.reject(err);
        }
      });

    setTimeout(() => nextTick.resolve(), 0);

    return promise.promise;
  }
}

function createResolvablePromise<T = unknown>(): ResolvablePromise<T> {
  let resolveFn!: (value: T) => void;
  let rejectFn!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  return { promise, resolve: resolveFn, reject: rejectFn };
}
