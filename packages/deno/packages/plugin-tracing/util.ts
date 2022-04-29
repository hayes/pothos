// @ts-nocheck
/* eslint-disable node/no-unsupported-features/es-builtins */
import { GraphQLFieldResolver, GraphQLResolveInfo } from 'https://cdn.skypack.dev/graphql?dts';
import { isThenable, PothosOutputFieldConfig, PothosOutputFieldType, SchemaTypes, } from '../core/index.ts';
export function isRootField<Types extends SchemaTypes>(config: PothosOutputFieldConfig<Types>) {
    return (config.parentType === "Query" ||
        config.parentType === "Mutation" ||
        config.parentType === "Subscription");
}
export function resolveFieldType<Types extends SchemaTypes>(type: PothosOutputFieldType<Types>): "Enum" | "Interface" | "Object" | "Scalar" | "Union" {
    if (type.kind === "List") {
        return resolveFieldType(type.type);
    }
    return type.kind;
}
export function isScalarField<Types extends SchemaTypes>(config: PothosOutputFieldConfig<Types>) {
    return resolveFieldType(config.type) === "Scalar";
}
export function isEnumField<Types extends SchemaTypes>(config: PothosOutputFieldConfig<Types>) {
    return resolveFieldType(config.type) === "Enum";
}
const spanCacheSymbol = Symbol.for("Pothos.tracing.spanCache");
interface InternalContext<T> {
    [spanCacheSymbol]?: Record<string, T>;
}
export function pathToString(info: GraphQLResolveInfo) {
    let current = info.path;
    let path = String(current.key);
    while (current.prev) {
        current = current.prev;
        path = `${current.key}.${path}`;
    }
    return path;
}
function getParentPaths(path: GraphQLResolveInfo["path"]): [
    string,
    ...string[]
] {
    if (!path.prev) {
        return [String(path.key)];
    }
    const parentPaths = getParentPaths(path.prev);
    return [`${parentPaths[0]}.${path.key}`, ...parentPaths];
}
export function getParentSpan<T>(context: InternalContext<T>, info: GraphQLResolveInfo) {
    if (!info.path.prev) {
        return null;
    }
    const paths = getParentPaths(info.path.prev);
    const spanCache = context[spanCacheSymbol];
    if (!spanCache) {
        return null;
    }
    for (const path of paths) {
        if (spanCache[path]) {
            return spanCache[path];
        }
    }
    return null;
}
export function createSpanWithParent<T>(context: object, info: GraphQLResolveInfo, createSpan: (path: string, parent: T | null) => T) {
    const parentSpan = getParentSpan<T>(context, info);
    const stringPath = pathToString(info);
    const span = createSpan(stringPath, parentSpan);
    if (!(context as InternalContext<T>)[spanCacheSymbol]) {
        (context as InternalContext<T>)[spanCacheSymbol] = {};
    }
    (context as InternalContext<T>)[spanCacheSymbol]![stringPath] = span;
    return span;
}
const { performance } = globalThis as unknown as {
    performance: {
        now: () => number;
    };
};
export function wrapResolver<C>(resolver: GraphQLFieldResolver<unknown, C, {}>, end: (error: unknown, duration: number) => void): GraphQLFieldResolver<unknown, C, {}> {
    return (source, args, ctx, info) => {
        const start = performance.now();
        let result: unknown;
        try {
            result = resolver(source, args, ctx, info);
        }
        catch (error: unknown) {
            end(error, performance.now() - start);
            throw error;
        }
        if (isThenable(result)) {
            return result.then((value) => {
                end(null, performance.now() - start);
                return value;
            }, (error: Error) => {
                end(error, performance.now() - start);
                throw error;
            });
        }
        end(null, performance.now() - start);
        return result;
    };
}
export function runFunction<T>(next: () => T, end: (error: unknown, duration: number) => void) {
    const start = performance.now();
    let result: unknown;
    try {
        result = next();
    }
    catch (error: unknown) {
        end(error, performance.now() - start);
        throw error;
    }
    if (isThenable(result)) {
        return result.then((value) => {
            end(null, performance.now() - start);
            return value;
        }, (error: Error) => {
            end(error, performance.now() - start);
            throw error;
        });
    }
    end(null, performance.now() - start);
    return result;
}
