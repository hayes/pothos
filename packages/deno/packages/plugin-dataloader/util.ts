// @ts-nocheck
import DataLoader, { Options } from 'https://cdn.skypack.dev/dataloader?dts';
import { createContextCache, isThenable, MaybePromise, SchemaTypes } from '../core/index.ts';
export function rejectErrors<T>(val: MaybePromise<(Error | T)[]>): MaybePromise<(Promise<T> | T)[]> {
    if (isThenable(val)) {
        return val.then(rejectErrors);
    }
    return val.map((item) => (item instanceof Error ? Promise.reject(item) : item));
}
export function dataloaderGetter<K, V, C>(loaderOptions: Options<K, V, C> | undefined, load: (keys: K[], context: SchemaTypes["Context"]) => Promise<(Error | V)[]>) {
    return createContextCache((context: object) => new DataLoader<K, V, C>((keys) => (load as (keys: readonly K[], context: SchemaTypes["Context"]) => Promise<V[]>)(keys, context), loaderOptions));
}
