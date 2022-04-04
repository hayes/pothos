import { GraphQLResolveInfo } from 'graphql';
import {
  FieldRef,
  ImplementableObjectRef,
  InterfaceParam,
  InterfaceRef,
  ObjectTypeOptions,
  SchemaTypes,
} from '@pothos/core';
import { DataLoaderOptions, LoadableNodeId } from '../types';
import { ImplementableLoadableObjectRef } from './object';

export class ImplementableLoadableNodeRef<
  Types extends SchemaTypes,
  RefShape,
  Shape extends object,
  Key extends bigint | number | string,
  CacheKey,
> extends ImplementableLoadableObjectRef<Types, RefShape, Shape, Key, CacheKey> {
  private idOptions;

  constructor(
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
    name: string,
    {
      id,
      ...options
    }: DataLoaderOptions<Types, Shape, Key, CacheKey> & LoadableNodeId<Types, Shape>,
  ) {
    super(builder, name, options);
    this.idOptions = id;
  }

  override implement<Interfaces extends InterfaceParam<Types>[]>(
    options: Omit<
      ObjectTypeOptions<Types, ImplementableObjectRef<Types, RefShape, Shape>, Shape, Interfaces>,
      'name'
    >,
  ): PothosSchemaTypes.ObjectRef<RefShape, Shape> {
    this.builder.configStore.onTypeConfig(this, (nodeConfig) => {
      this.builder.objectField(this, 'id', (t) =>
        (
          t as unknown as {
            globalID: (options: Record<string, unknown>) => FieldRef<unknown>;
          }
        ).globalID({
          ...this.idOptions,
          nullable: false,
          args: {},
          resolve: async (
            parent: Shape,
            args: object,
            context: object,
            info: GraphQLResolveInfo,
          ) => ({
            type: nodeConfig.name,
            id: await this.idOptions.resolve(parent, args, context, info),
          }),
        }),
      );
    });

    const nodeOptions = {
      interfaces: [
        (
          this.builder as PothosSchemaTypes.SchemaBuilder<Types> & {
            nodeInterfaceRef: () => InterfaceRef<unknown>;
          }
        ).nodeInterfaceRef(),
        ...(options.interfaces ?? []),
      ],
      loadManyWithoutCache: (ids: Key[], context: SchemaTypes['Context']) =>
        this.getDataloader(context).loadMany(ids),
    };

    return super.implement({
      ...options,
      ...(nodeOptions as {}),
      extensions: {
        ...options.extensions,
        getDataloader: this.getDataloader,
        cacheResolved: this.cacheResolved,
      },
    });
  }
}
