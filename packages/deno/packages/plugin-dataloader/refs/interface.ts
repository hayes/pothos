// @ts-nocheck
import DataLoader from 'https://cdn.skypack.dev/dataloader?dts';
import { InterfaceRef, SchemaTypes } from '../../core/index.ts';
export class LoadableInterfaceRef<Types extends SchemaTypes, RefShape, Shape, Key, CacheKey> extends InterfaceRef<RefShape, Shape> {
    getDataloader;
    constructor(name: string, getDataloader: (context: Types["Context"]) => DataLoader<Key, Shape, CacheKey>) {
        super(name);
        this.getDataloader = getDataloader;
    }
}
