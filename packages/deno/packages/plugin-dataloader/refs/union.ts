// @ts-nocheck
import DataLoader from 'https://cdn.skypack.dev/dataloader?dts';
import { SchemaTypes, UnionRef } from '../../core/index.ts';
export class LoadableUnionRef<Types extends SchemaTypes, RefShape, Shape, Key, CacheKey> extends UnionRef<Types, RefShape, Shape> {
    getDataloader;
    constructor(name: string, getDataloader: (context: Types["Context"]) => DataLoader<Key, Shape, CacheKey>) {
        super(name);
        this.getDataloader = getDataloader;
    }
}
