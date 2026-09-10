import {
  completeValue,
  createContextCache,
  isThenable,
  type MaybePromise,
  type SchemaTypes,
} from '@pothos/core';
import { cacheKey, setFieldMapping, setLoaderMappings } from '@pothos/selection-mapper';
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
import { type DrizzleAdapter, type DrizzlePlan, drizzleAdapter } from './utils/adapter.js';
import { getClient, getSchemaConfig, type PothosDrizzleSchemaConfig } from './utils/config.js';
import { planFromInfo, rowPlanFromInfo } from './utils/map-query.js';
import type { SelectionMap } from './utils/selections.js';

interface ResolvablePromise<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (err: unknown) => void;
}

/** A field's loader plan and the query it serializes to. */
interface Selection {
  plan: DrizzlePlan;
  query: SelectionMap;
}

export class ModelLoader {
  context: object;

  builder: PothosSchemaTypes.SchemaBuilder<never>;

  modelName: string;

  // L-4: one selection per `Type@path`, a promise while a select beneath the field is async.
  queryCache = new Map<string, MaybePromise<Selection>>();

  staged = new Set<{
    plan: DrizzlePlan;
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
    if (!this.queryCache.has(key)) {
      this.queryCache.set(
        key,
        completeValue(rowPlanFromInfo(this.config, this.context, info), selectionOf),
      );
    }

    return this.queryCache.get(key)!;
  }

  getSelectionForField(info: GraphQLResolveInfo, typeName: string) {
    const key = cacheKey(typeName, info.path);
    if (!this.queryCache.has(key)) {
      this.queryCache.set(
        key,
        completeValue(
          // Walked without paths, so there is always a plan.
          planFromInfo({ config: this.config, context: this.context, info, typeName })!,
          selectionOf,
        ),
      );
    }

    return this.queryCache.get(key)!;
  }

  /**
   * L-3: `model` reloaded with the selection of the field `info` resolves. A synchronous
   * selection stages synchronously, so every row resolved in a tick joins the same batch; only a
   * selection with an async select beneath the field waits for it.
   */
  loadSelection(info: GraphQLResolveInfo, model: object): Promise<Record<string, unknown> | null> {
    const selection = this.getSelection(info);

    return isThenable(selection)
      ? selection.then((settled) => this.loadWith(settled as Selection, info, model))
      : this.loadWith(selection, info, model);
  }

  private loadWith({ plan, query }: Selection, info: GraphQLResolveInfo, model: object) {
    return this.stageQuery(plan, query, model).then((result) => {
      if (result) {
        const mapping = plan.mappings[`${info.parentType.name}@${info.path.key}`];

        if (mapping) {
          // Recorded for the field itself too, so its resolver finds the pathInfo it was planned
          // with, along with the mappings of the fields beneath it.
          setFieldMapping(this.context, info, mapping);
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
      ? selection.then((settled) => this.loadFieldWith(settled as Selection, info, model))
      : this.loadFieldWith(selection, info, model);
  }

  private loadFieldWith({ plan, query }: Selection, info: GraphQLResolveInfo, model: object) {
    return this.stageQuery(plan, query, model).then((result) => {
      if (result) {
        setLoaderMappings(this.context, info, plan.mappings);
      }

      return result;
    });
  }

  stageQuery(plan: DrizzlePlan, query: SelectionMap, model: object) {
    for (const entry of this.staged) {
      if (this.adapter.compatible(entry.plan.root, query, false)) {
        this.adapter.merge(entry.plan.root, query);

        if (!entry.models.has(model)) {
          entry.models.set(model, createResolvablePromise<Record<string, unknown> | null>());
        }

        return entry.models.get(model)!.promise;
      }
    }

    return this.initLoad(plan, model);
  }

  initLoad(plan: DrizzlePlan, model: object) {
    const promise = createResolvablePromise<Record<string, unknown> | null>();
    const entry = {
      plan,
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
          ...this.adapter.serialize(plan.root),
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
              const result = results.find((row) =>
                this.primaryKey.every(
                  (key) =>
                    row[this.config.columnToTsName(key) as keyof typeof row] ===
                    (model as Record<string, unknown>)[this.config.columnToTsName(key)],
                ),
              );

              if (result) {
                promise.resolve(result ?? null);
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

/** The plan carries the adapter it was built with, so no loader instance is needed here. */
function selectionOf(plan: DrizzlePlan): Selection {
  return { plan, query: plan.adapter.serialize(plan.root) };
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
