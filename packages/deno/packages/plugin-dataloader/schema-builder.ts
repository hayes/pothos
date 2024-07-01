// @ts-nocheck
import type { GraphQLResolveInfo } from 'https://cdn.skypack.dev/graphql?dts';
import SchemaBuilder, { InterfaceParam, ObjectParam, OutputRef, PothosSchemaError, SchemaTypes, ShapeFromTypeParam, } from '../core/index.ts';
import { ImplementableLoadableNodeRef, LoadableNodeRef } from './refs/index.ts';
import { ImplementableLoadableInterfaceRef } from './refs/interface.ts';
import { ImplementableLoadableObjectRef } from './refs/object.ts';
import { LoadableUnionRef } from './refs/union.ts';
import type { DataloaderKey, LoadableInterfaceOptions, LoadableUnionOptions, ShapeFromLoadResult, } from './types.ts';
import { DataloaderObjectTypeOptions, LoadableNodeOptions } from './types.ts';
import { dataloaderGetter } from './util.ts';
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
schemaBuilderProto.loadableObject = function loadableObject<LoadResult, Key extends DataloaderKey, Interfaces extends InterfaceParam<SchemaTypes>[], NameOrRef extends ObjectParam<SchemaTypes> | string, CacheKey = Key, Shape = ShapeFromLoadResult<LoadResult>>(nameOrRef: NameOrRef, options: DataloaderObjectTypeOptions<SchemaTypes, LoadResult, Key, Interfaces, NameOrRef, CacheKey, Shape>) {
    const name = typeof nameOrRef === "string"
        ? nameOrRef
        : (options as {
            name?: string;
        }).name ?? (nameOrRef as {
            name: string;
        }).name;
    const ref = new ImplementableLoadableObjectRef<SchemaTypes, Key | Shape, Shape, Key, CacheKey>(this, name, options as never);
    ref.implement(options);
    if (typeof nameOrRef !== "string") {
        this.configStore.associateParamWithRef(nameOrRef, ref);
    }
    return ref;
};
schemaBuilderProto.loadableInterface = function loadableInterface<LoadResult, Key extends DataloaderKey, Interfaces extends InterfaceParam<SchemaTypes>[], NameOrRef extends InterfaceParam<SchemaTypes> | string, CacheKey = Key, Shape = ShapeFromLoadResult<LoadResult>>(nameOrRef: NameOrRef, options: LoadableInterfaceOptions<SchemaTypes, LoadResult, Key, Interfaces, NameOrRef, CacheKey, Shape>) {
    const name = typeof nameOrRef === "string"
        ? nameOrRef
        : (options as {
            name?: string;
        }).name ?? (nameOrRef as {
            name: string;
        }).name;
    const ref = new ImplementableLoadableInterfaceRef<SchemaTypes, Shape, Shape, Key, CacheKey>(this, name, options as never);
    ref.implement(options);
    if (typeof nameOrRef !== "string") {
        this.configStore.associateParamWithRef(nameOrRef, ref);
    }
    return ref;
};
schemaBuilderProto.loadableUnion = function loadableUnion<Key extends DataloaderKey, Member extends ObjectParam<SchemaTypes>, CacheKey = Key, Shape = ShapeFromTypeParam<SchemaTypes, Member, false>>(name: string, { load, toKey, sort, cacheResolved, loaderOptions, ...options }: LoadableUnionOptions<SchemaTypes, Key, Member, CacheKey, Shape>) {
    const getDataloader = dataloaderGetter<Key, Shape, CacheKey>(loaderOptions, load, toKey, sort);
    const ref = new LoadableUnionRef<SchemaTypes, Shape, Shape, Key, CacheKey>(name, getDataloader);
    const unionRef = this.unionType(name, {
        ...options,
        extensions: {
            getDataloader,
            cacheResolved: typeof cacheResolved === "function" ? cacheResolved : cacheResolved && toKey,
        },
    });
    this.configStore.associateParamWithRef(ref, unionRef);
    return ref;
};
const TloadableNode = schemaBuilderProto.loadableNode;
schemaBuilderProto.loadableNode = function loadableNode<LoadResult extends NameOrRef extends ObjectParam<SchemaTypes> ? ShapeFromTypeParam<SchemaTypes, NameOrRef, false> | Error : unknown, Interfaces extends InterfaceParam<SchemaTypes>[], NameOrRef extends ObjectParam<SchemaTypes> | string, IDShape extends bigint | number | string = string, Key extends bigint | number | string = IDShape, CacheKey = Key, Shape = ShapeFromLoadResult<LoadResult>>(this: PothosSchemaTypes.SchemaBuilder<SchemaTypes>, nameOrRef: NameOrRef, options: LoadableNodeOptions<SchemaTypes, LoadResult, Interfaces, NameOrRef, IDShape, Key, CacheKey, Shape>) {
    if (typeof (this as PothosSchemaTypes.SchemaBuilder<SchemaTypes> & Record<string, unknown>)
        .nodeInterfaceRef !== "function") {
        throw new PothosSchemaError("builder.loadableNode requires @pothos/plugin-relay to be installed");
    }
    const name = typeof nameOrRef === "string"
        ? nameOrRef
        : (options as {
            name?: string;
        }).name ?? (nameOrRef as {
            name: string;
        }).name;
    const ref = new LoadableNodeRef<SchemaTypes, Shape, Shape, IDShape, Key, CacheKey>(this, name, options as never);
    (this as typeof this & {
        node: (ref: unknown, options: unknown) => void;
    }).node(ref, {
        ...options,
        extensions: {
            ...options.extensions,
            pothosParseGlobalID: options.id.parse,
            getDataloader: ref.getDataloader,
            cacheResolved: typeof options.cacheResolved === "function"
                ? options.cacheResolved
                : options.cacheResolved && options.toKey,
        },
        loadManyWithoutCache: (ids: Key[], context: SchemaTypes["Context"]) => ref.getDataloader(context).loadMany(ids),
        isTypeOf: options.isTypeOf ??
            (typeof nameOrRef === "function"
                ? (maybeNode: unknown, context: object, info: GraphQLResolveInfo) => {
                    if (!maybeNode) {
                        return false;
                    }
                    if (maybeNode instanceof (nameOrRef as Function)) {
                        return true;
                    }
                    const proto = Object.getPrototypeOf(maybeNode) as {
                        constructor: unknown;
                    };
                    try {
                        if (proto?.constructor) {
                            const config = this.configStore.getTypeConfig(proto.constructor as OutputRef);
                            return config.name === name;
                        }
                    }
                    catch {
                        // ignore
                    }
                    return false;
                }
                : undefined),
    });
    if (typeof nameOrRef !== "string") {
        this.configStore.associateParamWithRef(nameOrRef, ref);
    }
    return ref;
} as unknown as typeof TloadableNode;
