// @ts-nocheck
import { inputShapeKey, SchemaTypes } from '../types/index.ts';
import { BaseTypeRef } from './base.ts';
export class InputTypeRef<Types extends SchemaTypes, T> extends BaseTypeRef<Types> {
    override kind;
    $inferInput!: T;
    [inputShapeKey]!: T;
    constructor(kind: "Enum" | "InputObject" | "Scalar", name: string) {
        super(kind, name);
        this.kind = kind;
    }
}
