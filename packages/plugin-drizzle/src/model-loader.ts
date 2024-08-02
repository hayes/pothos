import { type SchemaTypes, createContextCache } from '@pothos/core';
import { type Column, type TableRelationalConfig, inArray, sql } from 'drizzle-orm';
import type { GraphQLResolveInfo } from 'graphql';
import { type PothosDrizzleSchemaConfig, getSchemaConfig } from './utils/config';
import { cacheKey, setLoaderMappings } from './utils/loader-map';
import { selectionStateFromInfo, stateFromInfo } from './utils/map-query';
import {
  type SelectionMap,
  type SelectionState,
  mergeSelection,
  selectionCompatible,
  selectionToQuery,
} from './utils/selections';

interface ResolvablePromise<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (err: unknown) => void;
}
export class ModelLoader {
  context: object;

  builder: PothosSchemaTypes.SchemaBuilder<never>;

  modelName: string;

  queryCache = new Map<string, { selection: SelectionState; query: SelectionMap }>();

  staged = new Set<{
    state: SelectionState;
    models: Map<object, ResolvablePromise<Record<string, unknown> | null>>;
  }>();

  config: PothosDrizzleSchemaConfig;
  table: TableRelationalConfig;
  columns: Column[];
  selectSQL;

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
    this.table = this.config.schema[modelName];
    this.columns = columns ?? this.table.primaryKey;
    this.selectSQL =
      this.columns.length > 1
        ? sql`(${sql.join(this.columns, sql`, `)})`
        : this.columns[0].getSQL();
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
      const columnName = key.name as keyof typeof model;
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
      const selection = selectionStateFromInfo(this.config, this.context, info);
      this.queryCache.set(key, {
        selection,
        query: selectionToQuery(selection),
      });
    }

    return this.queryCache.get(key)!;
  }

  getSelectionForField(info: GraphQLResolveInfo, typeName: string) {
    const key = cacheKey(typeName, info.path);
    if (!this.queryCache.has(key)) {
      const selection = stateFromInfo({
        config: this.config,
        context: this.context,
        info,
        typeName,
      });

      this.queryCache.set(key, {
        selection,
        query: selectionToQuery(selection),
      });
    }

    return this.queryCache.get(key)!;
  }

  async loadSelection(info: GraphQLResolveInfo, model: object) {
    const { selection, query } = this.getSelection(info);

    const result = await this.stageQuery(selection, query, model);

    if (result) {
      const mappings = selection.mappings[info.path.key];

      if (mappings) {
        setLoaderMappings(this.context, info, mappings.mappings);
      }
    }

    return result;
  }

  async loadSelectionForField(info: GraphQLResolveInfo, model: object, returnType: string) {
    const { selection, query } = this.getSelectionForField(info, returnType);

    const result = await this.stageQuery(selection, query, model);

    if (result) {
      setLoaderMappings(this.context, info, selection.mappings);
    }

    return result;
  }

  stageQuery(selection: SelectionState, query: SelectionMap, model: object) {
    for (const entry of this.staged) {
      if (selectionCompatible(entry.state, query)) {
        mergeSelection(this.config, entry.state, query);

        if (!entry.models.has(model)) {
          entry.models.set(model, createResolvablePromise<Record<string, unknown> | null>());
        }

        return entry.models.get(model)!.promise;
      }
    }

    return this.initLoad(selection, model);
  }

  initLoad(selection: SelectionState, model: object) {
    const promise = createResolvablePromise<Record<string, unknown> | null>();
    const entry = {
      state: selection,
      models: new Map([[model, promise]]),
    };
    this.staged.add(entry);

    const nextTick = createResolvablePromise<void>();

    nextTick.promise
      .then(() => {
        const api = (
          this.builder.options.drizzle.client.query as Record<
            string,
            { findMany: (...args: unknown[]) => Promise<Record<string, unknown>[]> }
          >
        )[this.modelName];

        const query = api.findMany({
          ...selectionToQuery(selection),
          where: inArray(
            this.selectSQL,
            [entry.models.keys()].map(([model]) => this.sqlForModel(model)),
          ),
        });

        query.then(
          (results) => {
            for (const [model, promise] of entry.models.entries()) {
              const result = results.find((row) =>
                this.table.primaryKey.every(
                  (key) => row[key.name] === (model as Record<string, unknown>)[key.name],
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

function createResolvablePromise<T = unknown>(): ResolvablePromise<T> {
  let resolveFn!: (value: T) => void;
  let rejectFn!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  return { promise, resolve: resolveFn, reject: rejectFn };
}
