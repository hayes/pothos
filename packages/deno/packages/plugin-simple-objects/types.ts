// @ts-nocheck
import { FieldMap, GenericFieldRef, NullableToOptional, SchemaTypes } from '../core/index.ts';
export type SimpleObjectFieldsShape<Types extends SchemaTypes, Fields extends FieldMap> = (t: PothosSchemaTypes.RootFieldBuilder<Types, unknown, "SimpleObject">) => Fields;
export type SimpleInterfaceFieldsShape<Types extends SchemaTypes, Fields extends FieldMap> = (t: PothosSchemaTypes.RootFieldBuilder<Types, unknown, "SimpleInterface">) => Fields;
export type OutputShapeFromFields<Fields extends FieldMap> = NullableToOptional<{
    [K in keyof Fields]: Fields[K] extends GenericFieldRef<infer T> ? T : never;
}>;
