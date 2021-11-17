// @ts-nocheck
import DataLoader, { Options } from 'https://cdn.skypack.dev/dataloader?dts';
import { createContextCache, isThenable, MaybePromise, SchemaTypes } from '../core/index.ts';
export function rejectErrors<T>(val: MaybePromise<(Error | T)[]>): MaybePromise<(Promise<T> | T)[]> {
    if (isThenable(val)) {
        return val.then(rejectErrors);
    }
    return val.map((item) => (item instanceof Error ? Promise.reject(item) : item));
}
export function loadAndSort<K, V, C>(load: (keys: K[], context: C) => Promise<(Error | V)[]>, toKey: false | ((val: V) => K) | undefined) {
    if (!toKey) {
        return load;
    }
    return async (keys: K[], context: C) => {
        const list = await load(keys, context);
        const map = new Map<K, V>();
        const results = new Array<V | null>();
        for (const val of list) {
            if (val instanceof Error) {
                throw val;
            }
            if (val != null) {
                map.set(toKey(val), val);
            }
        }
        for (let i = 0; i < list.length; i += 1) {
            results[i] = map.get(keys[i]) ?? null;
        }
        return results;
    };
}
export function dataloaderGetter<K, V, C>(loaderOptions: Options<K, V, C> | undefined, load: (keys: K[], context: SchemaTypes["Context"]) => Promise<(Error | V)[]>, toKey: ((val: V) => K) | undefined, sort: boolean | ((val: V) => K) | undefined) {
    const loader = (sort ? loadAndSort(load, typeof sort === "function" ? sort : toKey) : load) as (keys: readonly K[], context: SchemaTypes["Context"]) => Promise<V[]>;
    return createContextCache((context: object) => new DataLoader<K, V, C>((keys) => loader(keys, context), loaderOptions));
}
