// @ts-nocheck
import { InputRef, inputShapeKey, OutputRef, outputShapeKey, parentShapeKey } from '../types/index.ts';
import BaseTypeRef from './base.ts';
export default class ScalarRef<T, U, P = T> extends BaseTypeRef implements OutputRef, InputRef, PothosSchemaTypes.ScalarRef<T, U, P> {
    override kind = "Scalar" as const;
    $inferType!: T;
    $inferInput!: U;
    [outputShapeKey]!: T;
    [parentShapeKey]!: P;
    [inputShapeKey]!: U;
    constructor(name: string) {
        super("Scalar", name);
    }
}
