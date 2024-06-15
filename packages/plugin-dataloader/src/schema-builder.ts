import type { GraphQLResolveInfo } from 'graphql';
import SchemaBuilder, {
  InterfaceParam,
  ObjectParam,
  OutputRef,
  PothosSchemaError,
  SchemaTypes,
  ShapeFromTypeParam,
} from '@pothos/core';
import { ImplementableLoadableNodeRef } from './refs';
import { ImplementableLoadableInterfaceRef } from './refs/interface';
import { ImplementableLoadableObjectRef } from './refs/object';
import { LoadableUnionRef } from './refs/union';
import type {
  DataloaderKey,
  LoadableInterfaceOptions,
  LoadableUnionOptions,
  ShapeFromLoadResult,
} from './types';
import { DataloaderObjectTypeOptions, LoadableNodeOptions } from './types';
import { dataloaderGetter } from './util';

const schemaBuilderProto = SchemaBuilder.prototype as PothosSchemaTypes.SchemaBuilder<SchemaTypes>;

schemaBuilderProto.loadableObjectRef = function loadableObjectRef(name, options) {
  return new ImplementableLoadableObjectRef(this, name, options);
};

schemaBuilderProto.loadableInterfaceRef = function loadableInterfaceRef(name, options) {
  return new ImplementableLoadableInterfaceRef(this, name, options);
};

schemaBuilderProto.loadableNodeRef = function loadableNodeRef(name, options) {
  return new ImplementableLoadableNodeRef(this, name, options);
};

schemaBuilderProto.loadableObject = function loadableObject<
  Shape,
  Key extends DataloaderKey,
  Interfaces extends InterfaceParam<SchemaTypes>[],
  NameOrRef extends ObjectParam<SchemaTypes> | string,
  CacheKey = Key,
  LoadResult = object,
>(
  nameOrRef: NameOrRef,
  options: DataloaderObjectTypeOptions<
    SchemaTypes,
    Shape,
    Key,
    Interfaces,
    NameOrRef,
    CacheKey,
    LoadResult
  >,
) {
  const name =
    typeof nameOrRef === 'string'
      ? nameOrRef
      : (options as { name?: string }).name ?? (nameOrRef as { name: string }).name;

  const ref = new ImplementableLoadableObjectRef<
    SchemaTypes,
    Key | Shape,
    Shape,
    Key,
    CacheKey,
    LoadResult
  >(this, name, options);

  ref.implement(options);

  if (typeof nameOrRef !== 'string') {
    this.configStore.associateRefWithName(nameOrRef, name);
  }

  return ref;
};

schemaBuilderProto.loadableInterface = function loadableInterface<
  Shape,
  Key extends DataloaderKey,
  Interfaces extends InterfaceParam<SchemaTypes>[],
  NameOrRef extends InterfaceParam<SchemaTypes> | string,
  CacheKey = Key,
  LoadResult = object,
>(
  nameOrRef: NameOrRef,
  options: LoadableInterfaceOptions<
    SchemaTypes,
    Shape,
    Key,
    Interfaces,
    NameOrRef,
    CacheKey,
    LoadResult
  >,
) {
  const name =
    typeof nameOrRef === 'string'
      ? nameOrRef
      : (options as { name?: string }).name ?? (nameOrRef as { name: string }).name;

  const ref = new ImplementableLoadableInterfaceRef<
    SchemaTypes,
    Shape,
    Shape,
    Key,
    CacheKey,
    LoadResult
  >(this, name, options);

  ref.implement(options);

  if (typeof nameOrRef !== 'string') {
    this.configStore.associateRefWithName(nameOrRef, name);
  }

  return ref;
};

schemaBuilderProto.loadableUnion = function loadableUnion<
  Key extends DataloaderKey,
  Member extends ObjectParam<SchemaTypes>,
  CacheKey = Key,
  Shape = ShapeFromTypeParam<SchemaTypes, Member, false>,
  LoadResult = object,
>(
  name: string,
  {
    load,
    toKey,
    sort,
    cacheResolved,
    loaderOptions,
    ...options
  }: LoadableUnionOptions<SchemaTypes, Key, Member, CacheKey, Shape, LoadResult>,
) {
  const getDataloader = dataloaderGetter<Key, Shape, CacheKey, LoadResult>(
    loaderOptions,
    load,
    toKey,
    sort,
  );

  const ref = new LoadableUnionRef<SchemaTypes, Shape, Shape, Key, CacheKey>(name, getDataloader);

  this.unionType(name, {
    ...options,
    extensions: {
      getDataloader,
      cacheResolved: typeof cacheResolved === 'function' ? cacheResolved : cacheResolved && toKey,
    },
  });

  this.configStore.associateRefWithName(ref, name);

  return ref;
};

const TloadableNode = schemaBuilderProto.loadableNode;

schemaBuilderProto.loadableNode = function loadableNode<
  Shape extends NameOrRef extends ObjectParam<SchemaTypes>
    ? ShapeFromTypeParam<SchemaTypes, NameOrRef, false>
    : ShapeFromLoadResult<LoadResult>,
  Interfaces extends InterfaceParam<SchemaTypes>[],
  NameOrRef extends ObjectParam<SchemaTypes> | string,
  IDShape extends bigint | number | string = string,
  Key extends bigint | number | string = IDShape,
  CacheKey = Key,
  LoadResult = object,
>(
  this: PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  nameOrRef: NameOrRef,
  options: LoadableNodeOptions<
    SchemaTypes,
    Shape,
    Interfaces,
    NameOrRef,
    IDShape,
    Key,
    CacheKey,
    LoadResult
  >,
) {
  if (
    typeof (this as PothosSchemaTypes.SchemaBuilder<SchemaTypes> & Record<string, unknown>)
      .nodeInterfaceRef !== 'function'
  ) {
    throw new PothosSchemaError(
      'builder.loadableNode requires @pothos/plugin-relay to be installed',
    );
  }

  const name =
    typeof nameOrRef === 'string'
      ? nameOrRef
      : (options as { name?: string }).name ?? (nameOrRef as { name: string }).name;

  const ref = new ImplementableLoadableNodeRef<
    SchemaTypes,
    Shape,
    Shape,
    IDShape,
    Key,
    CacheKey,
    LoadResult
  >(this, name, options);

  ref.implement({
    ...options,
    extensions: {
      ...options.extensions,
      pothosParseGlobalID: options.id.parse,
    },
    isTypeOf:
      options.isTypeOf ??
      (typeof nameOrRef === 'function'
        ? (maybeNode: unknown, context: object, info: GraphQLResolveInfo) => {
            if (!maybeNode) {
              return false;
            }

            if (maybeNode instanceof (nameOrRef as Function)) {
              return true;
            }

            const proto = Object.getPrototypeOf(maybeNode) as { constructor: unknown };

            try {
              if (proto?.constructor) {
                const config = this.configStore.getTypeConfig(proto.constructor as OutputRef);

                return config.name === name;
              }
            } catch {
              // ignore
            }

            return false;
          }
        : undefined),
  });

  if (typeof nameOrRef !== 'string') {
    this.configStore.associateRefWithName(nameOrRef, name);
  }

  return ref;
} as unknown as typeof TloadableNode;
