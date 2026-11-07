import { createContextCache, type SchemaTypes } from '@pothos/core';
import { ModelLoader } from '../model-loader.js';
import type { AnyContract } from '../types/models.js';
import type {
  PrismaNextExecutionContext,
  PrismaNextPluginOptions,
  PrismaNextRequestClient,
} from '../types/plugin-options.js';
import { type MapperCollection, PrismaNextAdapter } from './adapter.js';
import { type FieldCodecs, getColumnCodec } from './codecs.js';
import { collectionForModel, rootModelKey, variantOf } from './contract.js';
import { InternalError, keepError } from './errors.js';

type RequestClient = PrismaNextRequestClient<AnyContract>;
type ExecutionContext = PrismaNextExecutionContext<AnyContract>;

export interface PrismaNextConfig {
  readonly contract: AnyContract;
  readonly context: ExecutionContext;
  readonly adapter: PrismaNextAdapter;
  readonly defaultConnectionSize: number | undefined;
  readonly maxConnectionSize: number | undefined;
  readonly filterConnectionTotalCount: boolean;
  /** The client for a request, read once per request context. */
  client(ctx: object): RequestClient;
  /** The root collection a model's rows load from (`orm.Bug` loads through `orm.Task`). */
  collection(ctx: object, modelKey: string): MapperCollection;
  /** The collection a type of the model loads from: `collection`'s, narrowed to a variant. */
  typeCollection(ctx: object, modelKey: string): MapperCollection;
  codecs(modelKey: string): FieldCodecs;
  loader(ctx: object, modelKey: string): ModelLoader;
}

export const getPluginConfig = createContextCache((builder: object): PrismaNextConfig => {
  const options = (
    (builder as { options: object }).options as {
      prismaNext: PrismaNextPluginOptions<SchemaTypes>;
    }
  ).prismaNext;
  const clientOption = options.client;
  // A client function's clients, such as transactions, have no `context`, so it is passed beside it.
  const context =
    typeof clientOption === 'function'
      ? (options as { context: ExecutionContext }).context
      : clientOption.context;
  const { contract } = context;

  const client: (ctx: object) => RequestClient =
    typeof clientOption === 'function'
      ? createContextCache((ctx: object) => {
          try {
            return clientOption(ctx as never);
          } catch (error) {
            // The app's error, which reaches the field as it is.
            throw keepError(error);
          }
        })
      : () => clientOption;
  const collection = (ctx: object, modelKey: string) => {
    const root = rootModelKey(contract, modelKey) ?? modelKey;
    const found = collectionForModel(contract, client(ctx).orm, root) as
      | MapperCollection
      | undefined;
    // A client may type a model's collection under its namespace or its key, so the types can't
    // require it.
    if (!found) {
      const through = root === modelKey ? '' : ` (loaded through '${root}')`;
      throw new InternalError(`prismaNext.client has no collection for '${modelKey}'${through}.`);
    }
    return found;
  };
  const variants = new Map<string, string | undefined>();
  const typeCollection = (ctx: object, modelKey: string) => {
    if (!variants.has(modelKey)) {
      variants.set(modelKey, variantOf(contract, modelKey)?.value);
    }
    const variant = variants.get(modelKey);
    const root = collection(ctx, modelKey);
    return variant === undefined ? root : root.variant(variant);
  };
  const loaders = createContextCache((_ctx: object) => new Map<string, ModelLoader>());
  const config: PrismaNextConfig = {
    contract,
    context,
    adapter: new PrismaNextAdapter(contract, options.skipDeferredFragments ?? true),
    defaultConnectionSize: options.defaultConnectionSize,
    maxConnectionSize: options.maxConnectionSize,
    filterConnectionTotalCount: options.filterConnectionTotalCount ?? true,
    client,
    collection,
    typeCollection,
    codecs: (modelKey) => (field) => getColumnCodec(contract, context, modelKey, field),
    loader: (ctx, modelKey) => {
      const byModel = loaders(ctx);
      let loader = byModel.get(modelKey);
      if (!loader) {
        loader = new ModelLoader(ctx, config, modelKey);
        byModel.set(modelKey, loader);
      }
      return loader;
    },
  };
  return config;
});
