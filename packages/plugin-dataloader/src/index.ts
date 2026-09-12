import './global-types.js';
import './field-builder.js';
import './schema-builder.js';
import SchemaBuilder, {
  BasePlugin,
  isThenable,
  type PothosOutputFieldConfig,
  type SchemaTypes,
  unwrapOutputFieldType,
} from '@pothos/core';
import type DataLoader from 'dataloader';
import type { GraphQLFieldResolver } from 'graphql';

export * from './refs/index.js';
export * from './types.js';
export * from './util.js';

const pluginName = 'dataloader';

// Resolvers for list fields are allowed to return any Iterable, but the loader wrappers below need
// to be able to map over the results, so non-array iterables are consumed into an array first.
// Anything that isn't iterable is passed through unchanged so it fails the way it did before.
function toResolvedList(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'object' && value !== null && Symbol.iterator in value) {
    return [...(value as Iterable<unknown>)];
  }

  return value as unknown[];
}

export class PothosDataloaderPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    let listDepth = 0;
    for (let type = fieldConfig.type; type.kind === 'List'; type = type.type) {
      listDepth += 1;
    }

    const config = this.buildCache.getTypeConfig(unwrapOutputFieldType(fieldConfig.type));

    const getDataloader = config.extensions?.getDataloader as (
      context: object,
    ) => DataLoader<unknown, unknown>;

    if (!getDataloader) {
      return resolver;
    }

    const cacheResolved = config.extensions?.cacheResolved as
      | ((val: unknown) => string)
      | undefined;

    function loadIfID(idOrResult: unknown, loader: DataLoader<unknown, unknown>): unknown {
      if (idOrResult == null) {
        return idOrResult;
      }

      if (isThenable(idOrResult)) {
        return idOrResult.then((result) => loadIfID(result, loader));
      }

      switch (typeof idOrResult) {
        case 'number':
        case 'bigint':
        case 'string':
          return loader.load(idOrResult);
        default:
          if (cacheResolved) {
            const key = cacheResolved(idOrResult);
            loader.prime(key, idOrResult);
          }
          return idOrResult;
      }
    }

    // Follows the list shape the field was configured with, so that ids nested inside lists of
    // lists are loaded rather than being treated as already loaded results.
    function loadResults(
      result: unknown,
      loader: DataLoader<unknown, unknown>,
      depth: number,
    ): unknown {
      if (depth === 0) {
        return loadIfID(result, loader);
      }

      if (result == null) {
        return result;
      }

      // An Error in a list position is how graphql-js is told to null that position and report the
      // error at its own path, so it is passed through rather than being treated as a nested list.
      if (result instanceof Error) {
        return result;
      }

      if (isThenable(result)) {
        return result.then((results) => loadResults(results, loader, depth));
      }

      return toResolvedList(result).map((item) => loadResults(item, loader, depth - 1));
    }

    return (parent, args, context, info) =>
      loadResults(resolver(parent, args, context, info), getDataloader(context), listDepth);
  }
}

SchemaBuilder.registerPlugin(pluginName, PothosDataloaderPlugin);

export default pluginName;
