// @ts-nocheck
import DataLoader from 'https://cdn.skypack.dev/dataloader?dts';
import { ImplementableObjectRef, isThenable, MaybePromise, SchemaTypes } from '../core/index.ts';
export class LoadableObjectRef<Types extends SchemaTypes, RefShape, Shape, Key, CacheKey> extends ImplementableObjectRef<Types, RefShape, Shape> {
    getDataloader;
    constructor(builder: GiraphQLSchemaTypes.SchemaBuilder<Types>, name: string, getDataloader: (context: Types["Context"]) => DataLoader<Key, Shape, CacheKey>) {
        super(builder, name);
        this.getDataloader = getDataloader;
    }
}
export function rejectErrors<T>(val: MaybePromise<(Error | T)[]>): MaybePromise<(Promise<T> | T)[]> {
    if (isThenable(val)) {
        return val.then(rejectErrors);
    }
    return val.map((item) => (item instanceof Error ? Promise.reject(item) : item));
}
