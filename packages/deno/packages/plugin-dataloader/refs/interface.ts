// @ts-nocheck
/* eslint-disable max-classes-per-file */
import DataLoader from 'https://cdn.skypack.dev/dataloader?dts';
import { ImplementableInterfaceRef, InterfaceParam, InterfaceRef, InterfaceTypeOptions, SchemaTypes, } from '../../core/index.ts';
import { DataLoaderOptions } from '../types.ts';
import { dataloaderGetter } from '../util.ts';
export class LoadableInterfaceRef<Types extends SchemaTypes, RefShape, Shape, Key, CacheKey> extends InterfaceRef<Types, RefShape, Shape> {
    getDataloader;
    constructor(name: string, getDataloader: (context: Types["Context"]) => DataLoader<Key, Shape, CacheKey>) {
        super(name);
        this.getDataloader = getDataloader;
    }
}
export class ImplementableLoadableInterfaceRef<Types extends SchemaTypes, RefShape, Shape, Key extends bigint | number | string, CacheKey> extends ImplementableInterfaceRef<Types, RefShape, Shape> {
    cacheResolved;
    getDataloader;
    constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>, name: string, { loaderOptions, load, toKey, sort, cacheResolved, }: DataLoaderOptions<Types, Shape, Key, CacheKey>) {
        super(builder, name);
        this.getDataloader = dataloaderGetter<Key, Shape, CacheKey>(loaderOptions, load, toKey, sort);
        this.cacheResolved =
            typeof cacheResolved === "function" ? cacheResolved : cacheResolved && toKey;
    }
    override implement<Interfaces extends InterfaceParam<Types>[]>(options: InterfaceTypeOptions<Types, ImplementableInterfaceRef<Types, RefShape, Shape>, Shape, Interfaces>): InterfaceRef<Types, RefShape, Shape> {
        return super.implement({
            ...options,
            extensions: {
                ...options.extensions,
                getDataloader: this.getDataloader,
                cacheResolved: this.cacheResolved,
            },
        });
    }
}
