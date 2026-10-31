import { createContextCache, PothosSchemaError, PothosValidationError } from '@pothos/core';
import type { GraphQLResolveInfo } from 'graphql';
import { ModelLoader } from '../model-loader.js';
import type {
  AnyContract,
  PrismaNextExecutionContext,
  PrismaNextPluginOptions,
  PrismaNextRequestClient,
} from '../types.js';
import { type MapperCollection, PrismaNextAdapter } from './adapter.js';
import { isPageSize } from './connections.js';
import { collectionForModel, relatedModelKey, rootModelKey } from './contract.js';
import { type FieldCodecs, getColumnCodec } from './model.js';

type RequestClient = PrismaNextRequestClient<AnyContract>;
type ExecutionContext = PrismaNextExecutionContext<AnyContract>;

export interface PrismaNextConfig {
  readonly contract: AnyContract;
  readonly adapter: PrismaNextAdapter;
  readonly defaultConnectionSize: number | undefined;
  readonly maxConnectionSize: number | undefined;
  readonly filterConnectionTotalCount: boolean;
  /** The client for a request, read once per request context. */
  client(ctx: object): RequestClient;
  /** The root collection a model's rows load from (`orm.Bug` loads through `orm.Task`). */
  collection(ctx: object, modelName: string): MapperCollection;
  codecs(ctx: object, modelName: string): FieldCodecs;
  loader(ctx: object, modelName: string): ModelLoader;
}

/**
 * Per-request state (loaders, plans, mappings) lives on the context object, so a request without
 * one fails up front with an explanation instead of deep in the planner.
 */
export function assertContextObject(context: unknown, info?: GraphQLResolveInfo) {
  if (context === null || (typeof context !== 'object' && typeof context !== 'function')) {
    const field = info ? ` (resolving '${info.parentType.name}.${info.fieldName}')` : '';
    throw new PothosValidationError(
      `@pothos/plugin-prisma-next requires an object contextValue${field}: it keeps per-request state on the context. Pass a context object, such as \`{}\`, when executing the operation.`,
    );
  }
}

export const getPluginConfig = createContextCache((builder: object): PrismaNextConfig => {
  const options = (
    (builder as { options: object }).options as {
      prismaNext?: PrismaNextPluginOptions<AnyContract>;
    }
  ).prismaNext;
  if (!options?.client) {
    throw new PothosSchemaError('@pothos/plugin-prisma-next requires prismaNext.client.');
  }
  const clientOption = options.client;
  const staticContext = typeof clientOption === 'function' ? undefined : clientOption.context;
  const contract = staticContext?.contract ?? options.contract;
  if (!contract) {
    throw new PothosSchemaError(
      'prismaNext.contract is required when prismaNext.client is a function.',
    );
  }
  const family = (contract as { targetFamily?: unknown }).targetFamily;
  if (family !== undefined && family !== 'sql') {
    throw new PothosSchemaError(
      `The prismaNext contract targets the '${String(family)}' family, but @pothos/plugin-prisma-next only supports SQL contracts. ` +
        'Selection planning needs refined and combined relation includes, which that family does not provide.',
    );
  }

  for (const name of ['defaultConnectionSize', 'maxConnectionSize'] as const) {
    const size = options[name];
    if (size !== undefined && !isPageSize(size)) {
      throw new PothosSchemaError(`prismaNext.${name} must be a positive integer, got ${size}.`);
    }
  }

  const client: (ctx: object) => RequestClient =
    typeof clientOption === 'function'
      ? createContextCache((ctx: object) => clientOption(ctx as never))
      : () => clientOption;
  const collection = (ctx: object, modelName: string) => {
    const found = collectionForModel(
      contract,
      client(ctx).orm,
      rootModelKey(contract, modelName),
    ) as MapperCollection | undefined;
    if (!found) {
      throw new PothosValidationError(`prismaNext.client has no collection for '${modelName}'.`);
    }
    return found;
  };
  const modelKeys = Object.entries(contract.domain.namespaces).flatMap(([namespace, { models }]) =>
    Object.keys(models).map((model) => relatedModelKey(contract, { namespace, model })),
  );
  const executionContext = (ctx: object): ExecutionContext => {
    if (staticContext) {
      return staticContext;
    }
    const requestClient = client(ctx);
    if (requestClient.context) {
      return requestClient.context;
    }
    // A transaction exposes only `orm`; its collections run in the client's execution context.
    for (const model of modelKeys) {
      const bound = (
        collectionForModel(contract, requestClient.orm, model) as
          | { ctx?: { context?: ExecutionContext } }
          | undefined
      )?.ctx?.context;
      if (bound) {
        return bound;
      }
    }
    throw new PothosValidationError(
      'prismaNext.client returned a client without an execution context.',
    );
  };
  const loaders = createContextCache(() => new Map<string, ModelLoader>());
  const config: PrismaNextConfig = {
    contract,
    adapter: new PrismaNextAdapter(contract, options.skipDeferredFragments ?? true),
    defaultConnectionSize: options.defaultConnectionSize,
    maxConnectionSize: options.maxConnectionSize,
    filterConnectionTotalCount: options.filterConnectionTotalCount ?? true,
    client,
    collection,
    codecs: (ctx, modelName) => {
      const context = executionContext(ctx);
      return (field) => getColumnCodec(contract, context, modelName, field);
    },
    loader: (ctx, modelName) => {
      assertContextObject(ctx);
      const byModel = loaders(ctx);
      let loader = byModel.get(modelName);
      if (!loader) {
        loader = new ModelLoader(ctx, config, modelName);
        byModel.set(modelName, loader);
      }
      return loader;
    },
  };
  return config;
});
