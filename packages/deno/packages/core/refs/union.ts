// @ts-nocheck
import { OutputRef, outputShapeKey, parentShapeKey } from '../types/type-params.ts';
import BaseTypeRef from './base.ts';
export default class UnionRef<T, P = T> extends BaseTypeRef implements OutputRef, PothosSchemaTypes.UnionRef<T, P> {
    override kind = "Union" as const;
    $inferType!: T;
    [outputShapeKey]!: T;
    [parentShapeKey]!: P;
    constructor(name: string) {
        super("Union", name);
    }
}
