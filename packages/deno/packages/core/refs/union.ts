// @ts-nocheck
import { OutputRef, outputShapeKey, parentShapeKey } from '../types/index.ts';
import BaseTypeRef from './base.ts';
export default class UnionRef<T, P = T> extends BaseTypeRef implements OutputRef {
    override kind = "Union" as const;
    [outputShapeKey]: T;
    [parentShapeKey]: P;
    constructor(name: string) {
        super("Union", name);
    }
}
