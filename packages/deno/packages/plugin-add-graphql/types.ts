// @ts-nocheck
import { EnumValues, FieldMap, FieldRef, InputFieldRef, InputFieldsFromShape, NullableToOptional, ObjectParam, SchemaTypes, } from '../core/index.ts';
export type AddGraphQLObjectFieldsShape<Types extends SchemaTypes, Shape> = (t: PothosSchemaTypes.ObjectFieldBuilder<Types, Shape>) => Record<string, FieldRef<Types> | null>;
export type AddGraphQLInterfaceFieldsShape<Types extends SchemaTypes, Shape> = (t: PothosSchemaTypes.InterfaceFieldBuilder<Types, Shape>) => Record<string, FieldRef<Types> | null>;
export type AddGraphQLInputFieldsShape<Types extends SchemaTypes, Shape> = (t: PothosSchemaTypes.InputFieldBuilder<Types, "InputObject">) => Record<string, (InputFieldRef<Types, unknown> & {
    [K in keyof Shape]?: InputFieldRef<Types, Shape[K]>;
}) | null>;
export type OutputShapeFromFields<Fields extends FieldMap> = NullableToOptional<{
    [K in keyof Fields]: Fields[K] extends FieldRef<infer T> ? T : never;
}>;
export type AddGraphQLObjectTypeOptions<Types extends SchemaTypes, Shape> = Omit<PothosSchemaTypes.ObjectTypeOptions<Types, Shape>, "fields"> & {
    name?: string;
    fields?: AddGraphQLObjectFieldsShape<Types, Shape>;
};
export interface AddGraphQLInterfaceTypeOptions<Types extends SchemaTypes, Shape> extends Omit<PothosSchemaTypes.InterfaceTypeOptions<Types, Shape>, "fields"> {
    name?: string;
    fields?: AddGraphQLInterfaceFieldsShape<Types, Shape>;
}
export interface AddGraphQLUnionTypeOptions<Types extends SchemaTypes, Member extends ObjectParam<Types> = ObjectParam<Types>> extends Omit<PothosSchemaTypes.UnionTypeOptions<Types, Member>, "types"> {
    name?: string;
    types?: Member[];
}
export interface AddGraphQLEnumTypeOptions<Types extends SchemaTypes, Values extends EnumValues<Types> = EnumValues<Types>> extends Omit<PothosSchemaTypes.EnumTypeOptions<Types, Values>, "values"> {
    name?: string;
    values?: Values;
}
export interface AddGraphQLInputTypeOptions<Types extends SchemaTypes, Shape extends {}> extends Omit<PothosSchemaTypes.InputObjectTypeOptions<Types, InputFieldsFromShape<Types, Shape, "InputObject">>, "fields"> {
    name?: string;
    fields?: AddGraphQLInputFieldsShape<Types, Shape>;
}
export type EnumValuesWithShape<Types extends SchemaTypes, Shape> = EnumValues<Types> & (Record<string, {
    value: Shape;
}> | Shape[]);
