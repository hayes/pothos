// @ts-nocheck
import { ImplementableObjectRef, ObjectRef, type SchemaTypes } from '../../core/index.ts';
import type DataLoader from 'https://cdn.skypack.dev/dataloader?dts';
import type { DataLoaderOptions } from '../types.ts';
import { dataloaderGetter } from '../util.ts';
export class LoadableObjectRef<Types extends SchemaTypes, RefShape, Shape, Key, CacheKey> extends ObjectRef<Types, RefShape, Shape> {
    getDataloader;
    constructor(name: string, getDataloader: (context: Types["Context"]) => DataLoader<Key, Shape, CacheKey>) {
        super(name);
        this.getDataloader = getDataloader;
    }
}
export class ImplementableLoadableObjectRef<Types extends SchemaTypes, RefShape, Shape, Key extends bigint | number | string, CacheKey> extends ImplementableObjectRef<Types, RefShape, Shape> {
    getDataloader;
    protected cacheResolved;
    constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>, name: string, { loaderOptions, load, toKey, sort, cacheResolved, }: DataLoaderOptions<Types, Shape | Error, Key, CacheKey, Shape>) {
        super(builder, name);
        this.getDataloader = dataloaderGetter<Key, Shape, CacheKey>(loaderOptions, load, toKey, sort);
        this.cacheResolved =
            typeof cacheResolved === "function" ? cacheResolved : cacheResolved && toKey;
        this.builder.configStore.onTypeConfig(this, (config) => {
            config.extensions = {
                ...config.extensions,
                getDataloader: this.getDataloader,
                cacheResolved: this.cacheResolved,
            };
        });
    }
}
