// @ts-nocheck
import { outputShapeKey, parentShapeKey, SchemaTypes } from '../types/index.ts';
import { BaseTypeRef } from './base.ts';
export class OutputTypeRef<Types extends SchemaTypes, T, P = T> extends BaseTypeRef<Types> {
    override kind;
    $inferType!: T;
    [outputShapeKey]!: T;
    [parentShapeKey]!: P;
    constructor(kind: "Enum" | "Interface" | "Object" | "Scalar" | "Union", name: string) {
        super(kind, name);
        this.kind = kind;
    }
}
