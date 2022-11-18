// @ts-nocheck
import { inputShapeKey, InputTypeParam, SchemaTypes } from '../types/index.ts';
import BaseTypeRef from './base.ts';
export default class InputObjectRef<Types extends SchemaTypes, T> extends BaseTypeRef implements PothosSchemaTypes.InputListRef<Types, T> {
    override kind = "InputList" as const;
    [inputShapeKey]!: T;
    listType: InputTypeParam<Types>;
    constructor(listType: InputTypeParam<Types>) {
        super("InputList", `InputList<${String(listType)}>`);
        this.listType = listType;
    }
}
