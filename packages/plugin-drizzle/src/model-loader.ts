import { GraphQLResolveInfo } from 'graphql';
import { inArray, sql, TableRelationalConfig, TablesRelationalConfig } from 'drizzle-orm';
import { createContextCache, SchemaTypes } from '@pothos/core';
import { cacheKey, setLoaderMappings } from './utils/loader-map';
import { selectionStateFromInfo } from './utils/map-query';
import {
  mergeSelection,
  selectionCompatible,
  SelectionMap,
  SelectionState,
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

  schema: TablesRelationalConfig;
  table: TableRelationalConfig;
  pk;

  constructor(context: object, builder: PothosSchemaTypes.SchemaBuilder<never>, modelName: string) {
    this.context = context;
    this.builder = builder;
    this.modelName = modelName;
    this.schema = builder.options.drizzle.client._.schema!;
    this.table = this.schema[modelName];
    this.pk = sql`(${sql.join(this.table.primaryKey, sql`, `)})`;
  }

  static forModel<Types extends SchemaTypes>(
    modelName: string,
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
  ) {
    return createContextCache((model) => new ModelLoader(model, builder as never, modelName));
  }

  pkFromModel(model: object) {
    return this.table.primaryKey.map((key) => {
      const columnName = key.name as keyof typeof model;
      if (columnName in model) {
        return model[columnName] as string | number;
      }

      throw new Error(`Primary key column ${columnName} not found on ${this.modelName}`);
    });
  }

  getSelection(info: GraphQLResolveInfo) {
    const key = cacheKey(info.parentType.name, info.path);
    if (!this.queryCache.has(key)) {
      const selection = selectionStateFromInfo(this.schema, this.context, info);
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

  async stageQuery(selection: SelectionState, query: SelectionMap, model: object) {
    for (const entry of this.staged) {
      if (selectionCompatible(entry.state, query)) {
        mergeSelection(this.builder.options.drizzle.client._.schema!, entry.state, query);

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

    nextTick.promise.then(() => {
      const api = (
        this.builder.options.drizzle.client.query as Record<
          string,
          { findMany: (...args: unknown[]) => Promise<Record<string, unknown>[]> }
        >
      )[this.modelName];

      const query = api.findMany({
        ...selectionToQuery(selection),
        where: inArray(
          this.pk,
          [entry.models.keys()].map(([model]) => this.pkFromModel(model)),
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
            } else
              promise.reject(
                new Error(`Model ${this.modelName}(${this.pkFromModel(model)}) not found`),
              );
          }
        },
        (err) => {
          for (const promise of entry.models.values()) {
            promise.reject(err);
          }
        },
      );
    });

    setTimeout(() => void nextTick.resolve(), 0);

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
