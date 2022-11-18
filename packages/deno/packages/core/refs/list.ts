// @ts-nocheck
import { outputShapeKey, parentShapeKey, SchemaTypes, TypeParam } from '../types/index.ts';
import BaseTypeRef from './base.ts';
export default class ListRef<Types extends SchemaTypes, T, P = T> extends BaseTypeRef implements PothosSchemaTypes.ListRef<Types, T, P> {
    override kind = "List" as const;
    [outputShapeKey]!: T;
    [parentShapeKey]!: P;
    listType: TypeParam<Types>;
    constructor(listType: TypeParam<Types>) {
        super("List", `List<${String(listType)}>`);
        this.listType = listType;
    }
}
