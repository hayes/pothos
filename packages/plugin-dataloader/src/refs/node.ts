import { GraphQLResolveInfo } from 'graphql';
import {
  completeValue,
  FieldRef,
  InterfaceRef,
  PothosObjectTypeConfig,
  SchemaTypes,
} from '@pothos/core';
import { DataLoaderOptions, LoadableNodeId } from '../types';
import { ImplementableLoadableObjectRef } from './object';

export class ImplementableLoadableNodeRef<
  Types extends SchemaTypes,
  RefShape,
  Shape,
  IDShape extends bigint | number | string = string,
  Key extends bigint | number | string = IDShape,
  CacheKey = Key,
> extends ImplementableLoadableObjectRef<Types, RefShape, Shape, Key, CacheKey> {
  parseId: ((id: string, ctx: object) => IDShape) | undefined;

  private idOptions;

  constructor(
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
    name: string,
    {
      id,
      ...options
    }: DataLoaderOptions<Types, Shape | Error, Key, CacheKey, Shape> &
      LoadableNodeId<Types, Shape, IDShape>,
  ) {
    super(builder, name, options);
    this.idOptions = id;
    this.parseId = id.parse;

    this.builder.configStore.onTypeConfig(this, (config) => {
      const nodeInterface = (
        this.builder as PothosSchemaTypes.SchemaBuilder<Types> & {
          nodeInterfaceRef: () => InterfaceRef<unknown>;
        }
      ).nodeInterfaceRef();

      // eslint-disable-next-line no-param-reassign
      (config.pothosOptions as { loadManyWithoutCache: unknown }).loadManyWithoutCache = (
        ids: Key[],
        context: SchemaTypes['Context'],
      ) => this.getDataloader(context).loadMany(ids);

      const { interfaces } = config as PothosObjectTypeConfig;

      if (!interfaces.includes(nodeInterface)) {
        interfaces.push(nodeInterface);
      }

      this.builder.objectField(
        this,
        (this.builder.options as { relayOptions?: { idFieldName?: string } }).relayOptions
          ?.idFieldName ?? 'id',
        (t) =>
          (
            t as unknown as {
              globalID: (options: Record<string, unknown>) => FieldRef<unknown>;
            }
          ).globalID({
            ...(this.builder.options as { relayOptions?: { idFieldOptions?: {} } }).relayOptions
              ?.idFieldOptions,
            ...this.idOptions,
            nullable: false,
            args: {},
            resolve: (parent: Shape, args: object, context: object, info: GraphQLResolveInfo) =>
              completeValue(this.idOptions.resolve(parent, args, context, info), (globalId) => ({
                type: config.name,
                id: globalId,
              })),
          }),
      );
    });
  }
}
