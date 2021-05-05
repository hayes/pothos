import { OutputRef, outputShapeKey } from '../types/index.ts';
import BaseTypeRef from './base.ts';
export default class UnionRef<T> extends BaseTypeRef implements OutputRef {
    kind = "Union" as const;
    [outputShapeKey]: T;
    constructor(name: string) {
        super("Union", name);
    }
}
