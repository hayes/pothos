import { outputShapeKey } from '../types/index.ts';
import BaseTypeRef from './base.ts';
export default class OutputTypeRef<T> extends BaseTypeRef {
    kind;
    [outputShapeKey]: T;
    constructor(kind: "Enum" | "Interface" | "Object" | "Scalar" | "Union", name: string) {
        super(kind, name);
        this.kind = kind;
    }
}
