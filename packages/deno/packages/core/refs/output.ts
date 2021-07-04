// @ts-nocheck
import { outputShapeKey, parentShapeKey } from '../types/index.ts';
import BaseTypeRef from './base.ts';
export default class OutputTypeRef<T, P = T> extends BaseTypeRef {
    override kind;
    [outputShapeKey]: T;
    [parentShapeKey]: P;
    constructor(kind: "Enum" | "Interface" | "Object" | "Scalar" | "Union", name: string) {
        super(kind, name);
        this.kind = kind;
    }
}
