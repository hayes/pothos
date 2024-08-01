import {
  type FieldRef,
  ImplementableObjectRef,
  type InterfaceRef,
  ObjectFieldBuilder,
  type SchemaTypes,
  completeValue,
} from '@pothos/core';
import type { GraphQLResolveInfo } from 'graphql';
import type { DataLoaderOptions, LoadableNodeId } from '../types';
import { dataloaderGetter } from '../util';
import { LoadableObjectRef } from './object';

export class LoadableNodeRef<
  Types extends SchemaTypes,
  RefShape,
  Shape,
  IDShape extends bigint | number | string = string,
  Key extends bigint | number | string = IDShape,
  CacheKey = Key,
> extends LoadableObjectRef<Types, RefShape, Shape, Key, CacheKey> {
  parseId: ((id: string, ctx: object) => IDShape) | undefined;

  builder: PothosSchemaTypes.SchemaBuilder<Types>;

  constructor(
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
    name: string,
    {
      id,
      loaderOptions,
      load,
      toKey,
      sort,
    }: DataLoaderOptions<Types, Shape | Error, Key, CacheKey, Shape> &
      LoadableNodeId<Types, Shape, IDShape>,
  ) {
    super(name, dataloaderGetter<Key, Shape, CacheKey>(loaderOptions, load, toKey, sort));

    this.builder = builder;

    this.parseId = id.parse;
  }
}

export class ImplementableLoadableNodeRef<
  Types extends SchemaTypes,
  RefShape,
  Shape,
  IDShape extends bigint | number | string = string,
  Key extends bigint | number | string = IDShape,
  CacheKey = Key,
> extends ImplementableObjectRef<Types, RefShape, Shape> {
  parseId: ((id: string, ctx: object) => IDShape) | undefined;

  getDataloader;

  protected cacheResolved;

  constructor(
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
    name: string,
    {
      id,
      loaderOptions,
      load,
      toKey,
      sort,
      cacheResolved,
    }: DataLoaderOptions<Types, Shape | Error, Key, CacheKey, Shape> &
      LoadableNodeId<Types, Shape, IDShape>,
  ) {
    super(builder, name);
    this.parseId = id.parse;
    this.builder = builder;

    this.getDataloader = dataloaderGetter<Key, Shape, CacheKey>(loaderOptions, load, toKey, sort);
    this.cacheResolved =
      typeof cacheResolved === 'function' ? cacheResolved : cacheResolved && toKey;

    this.builder.configStore.onTypeConfig(this, (config) => {
      config.extensions = {
        ...config.extensions,
        getDataloader: this.getDataloader,
        cacheResolved: this.cacheResolved,
      };
      (config.pothosOptions as { loadManyWithoutCache: unknown }).loadManyWithoutCache = (
        ids: Key[],
        context: SchemaTypes['Context'],
      ) => this.getDataloader(context).loadMany(ids);
    });

    this.addInterfaces([
      (
        this.builder as typeof this.builder & { nodeInterfaceRef: () => InterfaceRef<Types, {}> }
      ).nodeInterfaceRef(),
    ]);

    this.addFields(() => ({
      id: (
        new ObjectFieldBuilder(this.builder) as PothosSchemaTypes.FieldBuilder<Types, 'Object'> & {
          globalID: (options: unknown) => FieldRef<Types>;
        }
      ).globalID({
        ...(this.builder.options as { relayOptions?: { idFieldOptions?: object } }).relayOptions
          ?.idFieldOptions,
        ...id,
        nullable: false,
        args: {},
        resolve: (parent: Shape, args: object, context: object, info: GraphQLResolveInfo) =>
          completeValue(id.resolve(parent, args, context, info), (globalId) => ({
            type: name,
            id: globalId,
          })),
      }),
    }));
  }
}
