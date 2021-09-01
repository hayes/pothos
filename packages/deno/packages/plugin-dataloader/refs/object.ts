// @ts-nocheck
import DataLoader from 'https://cdn.skypack.dev/dataloader?dts';
import { ObjectRef, SchemaTypes } from '../../core/index.ts';
export class LoadableObjectRef<Types extends SchemaTypes, RefShape, Shape, Key, CacheKey> extends ObjectRef<RefShape, Shape> {
    getDataloader;
    constructor(name: string, getDataloader: (context: Types["Context"]) => DataLoader<Key, Shape, CacheKey>) {
        super(name);
        this.getDataloader = getDataloader;
    }
}
