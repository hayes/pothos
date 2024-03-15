// @ts-nocheck
import { InputRef, inputShapeKey, OutputRef, outputShapeKey, PothosEnumTypeConfig, SchemaTypes, } from '../types/index.ts';
import { BaseTypeRef } from './base.ts';
export class EnumRef<Types extends SchemaTypes, T, U = T> extends BaseTypeRef<Types, PothosEnumTypeConfig> implements OutputRef, InputRef, PothosSchemaTypes.EnumRef<Types, T, U> {
    override kind = "Enum" as const;
    $inferType!: T;
    $inferInput!: U;
    [outputShapeKey]!: T;
    [inputShapeKey]!: U;
    constructor(name: string, config?: PothosEnumTypeConfig) {
        super("Enum", name, config);
    }
}
