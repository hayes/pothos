import { GraphQLResolveInfo } from 'graphql';
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

  constructor(context: object, builder: PothosSchemaTypes.SchemaBuilder<never>, modelName: string) {
    this.context = context;
    this.builder = builder;
    this.modelName = modelName;
  }

  static forModel<Types extends SchemaTypes>(
    modelName: string,
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
  ) {
    return createContextCache((model) => new ModelLoader(model, builder as never, modelName));
  }

  getSelection(info: GraphQLResolveInfo) {
    const key = cacheKey(info.parentType.name, info.path);
    if (!this.queryCache.has(key)) {
      const selection = selectionStateFromInfo(this.context, info);
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
