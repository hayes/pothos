import type { GraphQLResolveInfo } from 'graphql';
import SchemaBuilder, {
  InterfaceParam,
  ObjectParam,
  OutputRef,
  PothosSchemaError,
  SchemaTypes,
  ShapeFromTypeParam,
} from '@pothos/core';
import { ImplementableLoadableNodeRef, LoadableNodeRef } from './refs';
import { ImplementableLoadableInterfaceRef } from './refs/interface';
import { ImplementableLoadableObjectRef } from './refs/object';
import { LoadableUnionRef } from './refs/union';
import type { DataloaderKey, LoadableInterfaceOptions, LoadableUnionOptions } from './types';
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
  Shape extends NameOrRef extends ObjectParam<SchemaTypes>
    ? ShapeFromTypeParam<SchemaTypes, NameOrRef, false>
    : object,
  Key extends DataloaderKey,
  Interfaces extends InterfaceParam<SchemaTypes>[],
  NameOrRef extends ObjectParam<SchemaTypes> | string,
  CacheKey = Key,
>(
  nameOrRef: NameOrRef,
  options: DataloaderObjectTypeOptions<SchemaTypes, Shape, Key, Interfaces, NameOrRef, CacheKey>,
) {
  const name =
    typeof nameOrRef === 'string'
      ? nameOrRef
      : (options as { name?: string }).name ?? (nameOrRef as { name: string }).name;

  const ref = new ImplementableLoadableObjectRef<SchemaTypes, Key | Shape, Shape, Key, CacheKey>(
    this,
    name,
    options,
  );

  ref.implement(options);

  if (typeof nameOrRef !== 'string') {
    this.configStore.associateParamWithRef(nameOrRef, ref);
  }

  return ref;
};

schemaBuilderProto.loadableInterface = function loadableInterface<
  Shape extends NameOrRef extends InterfaceParam<SchemaTypes>
    ? ShapeFromTypeParam<SchemaTypes, NameOrRef, false>
    : object,
  Key extends DataloaderKey,
  Interfaces extends InterfaceParam<SchemaTypes>[],
  NameOrRef extends InterfaceParam<SchemaTypes> | string,
  CacheKey = Key,
>(
  nameOrRef: NameOrRef,
  options: LoadableInterfaceOptions<SchemaTypes, Shape, Key, Interfaces, NameOrRef, CacheKey>,
) {
  const name =
    typeof nameOrRef === 'string'
      ? nameOrRef
      : (options as { name?: string }).name ?? (nameOrRef as { name: string }).name;

  const ref = new ImplementableLoadableInterfaceRef<SchemaTypes, Shape, Shape, Key, CacheKey>(
    this,
    name,
    options,
  );

  ref.implement(options);

  if (typeof nameOrRef !== 'string') {
    this.configStore.associateParamWithRef(nameOrRef, ref);
  }

  return ref;
};

schemaBuilderProto.loadableUnion = function loadableUnion<
  Key extends DataloaderKey,
  Member extends ObjectParam<SchemaTypes>,
  CacheKey = Key,
  Shape = ShapeFromTypeParam<SchemaTypes, Member, false>,
>(
  name: string,
  {
    load,
    toKey,
    sort,
    cacheResolved,
    loaderOptions,
    ...options
  }: LoadableUnionOptions<SchemaTypes, Key, Member, CacheKey, Shape>,
) {
  const getDataloader = dataloaderGetter<Key, Shape, CacheKey>(loaderOptions, load, toKey, sort);

  const ref = new LoadableUnionRef<SchemaTypes, Shape, Shape, Key, CacheKey>(name, getDataloader);

  const unionRef = this.unionType(name, {
    ...options,
    extensions: {
      getDataloader,
      cacheResolved: typeof cacheResolved === 'function' ? cacheResolved : cacheResolved && toKey,
    },
  });

  this.configStore.associateParamWithRef(ref, unionRef);

  return ref;
};

const TloadableNode = schemaBuilderProto.loadableNode;

schemaBuilderProto.loadableNode = function loadableNode<
  Shape extends NameOrRef extends ObjectParam<SchemaTypes>
    ? ShapeFromTypeParam<SchemaTypes, NameOrRef, false>
    : object,
  Interfaces extends InterfaceParam<SchemaTypes>[],
  NameOrRef extends ObjectParam<SchemaTypes> | string,
  IDShape extends bigint | number | string = string,
  Key extends bigint | number | string = IDShape,
  CacheKey = Key,
>(
  this: PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  nameOrRef: NameOrRef,
  options: LoadableNodeOptions<SchemaTypes, Shape, Interfaces, NameOrRef, IDShape, Key, CacheKey>,
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

  const ref = new LoadableNodeRef<SchemaTypes, Shape, Shape, IDShape, Key, CacheKey>(
    this,
    name,
    options,
  );

  (this as typeof this & { node: (ref: unknown, options: unknown) => void }).node(ref, {
    ...options,
    extensions: {
      ...options.extensions,
      pothosParseGlobalID: options.id.parse,
      getDataloader: ref.getDataloader,
      cacheResolved:
        typeof options.cacheResolved === 'function'
          ? options.cacheResolved
          : options.cacheResolved && options.toKey,
    },
    loadManyWithoutCache: (ids: Key[], context: SchemaTypes['Context']) =>
      ref.getDataloader(context).loadMany(ids),
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
    this.configStore.associateParamWithRef(nameOrRef, ref);
  }

  return ref;
} as unknown as typeof TloadableNode;
