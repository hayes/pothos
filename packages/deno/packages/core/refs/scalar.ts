// @ts-nocheck
import { InputRef, inputShapeKey, OutputRef, outputShapeKey, parentShapeKey, PothosScalarTypeConfig, SchemaTypes, } from '../types/index.ts';
import { BaseTypeRef } from './base.ts';
export class ScalarRef<Types extends SchemaTypes, T, U, P = T> extends BaseTypeRef<Types, PothosScalarTypeConfig> implements OutputRef, InputRef, PothosSchemaTypes.ScalarRef<Types, T, U, P> {
    override kind = "Scalar" as const;
    $inferType!: T;
    $inferInput!: U;
    [outputShapeKey]!: T;
    [parentShapeKey]!: P;
    [inputShapeKey]!: U;
    constructor(name: string, config?: PothosScalarTypeConfig) {
        super("Scalar", name, config);
    }
}
