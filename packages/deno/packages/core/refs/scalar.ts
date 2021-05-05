// @ts-nocheck
import { InputRef, inputShapeKey, OutputRef, outputShapeKey } from '../types/index.ts';
import BaseTypeRef from './base.ts';
export default class ScalarRef<T, U> extends BaseTypeRef implements OutputRef, InputRef {
    kind = "Scalar" as const;
    [outputShapeKey]: T;
    [inputShapeKey]: U;
    constructor(name: string) {
        super("Scalar", name);
    }
}
