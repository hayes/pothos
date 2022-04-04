// @ts-nocheck
import { FieldKind, FieldNullability, FieldOptionsFromKind, InputFieldMap, InputFieldRef, InputRef, InputShapeFromFields, SchemaTypes, TypeParam, } from '../core/index.ts';
export interface WithInputBuilderOptions<Types extends SchemaTypes> {
    inputArgOptions: Omit<PothosSchemaTypes.ArgFieldOptions<Types, InputRef<{}>, true>, "fields" | "type">;
}
export type WithInputInputOptions<Types extends SchemaTypes, Fields extends InputFieldMap, InputName extends string> = Omit<PothosSchemaTypes.InputObjectTypeOptions<Types, Fields>, "fields"> & {
    name?: string;
    argName?: InputName;
    inputFields: (t: PothosSchemaTypes.InputFieldBuilder<Types, "InputObject">) => Fields;
};
export type WithInputTypeOptions<Types extends SchemaTypes, Fields extends InputFieldMap> = Omit<PothosSchemaTypes.InputObjectTypeOptions<Types, Fields>, "fields"> & {
    name?: string;
};
export type WithInputArgOptions<Types extends SchemaTypes, Fields extends InputFieldMap, InputName> = Omit<PothosSchemaTypes.ArgFieldOptions<Types, InputRef<InputShapeFromFields<Fields>>, true>, "fields" | "type"> & {
    name?: InputName;
};
export type FieldWithInputOptions<Types extends SchemaTypes, ParentShape, Kind extends FieldKind, Fields extends Record<string, InputFieldRef<unknown, "InputObject">>, Type extends TypeParam<Types>, Nullable extends FieldNullability<Type>, InputName extends string, ResolveShape, ResolveReturnShape> = FieldOptionsFromKind<Types, ParentShape, Type, Nullable, {
    [K in InputName]: InputFieldRef<InputShapeFromFields<Fields>>;
}, Kind, ResolveShape, ResolveReturnShape> extends infer BaseFieldOptions ? Omit<BaseFieldOptions, "args"> & {
    typeOptions?: WithInputTypeOptions<Types, Fields>;
    argOptions?: WithInputArgOptions<Types, Fields, InputName>;
    input: Fields;
} : never;
export type QueryFieldWithInputOptions<Types extends SchemaTypes, Fields extends InputFieldMap, Type extends TypeParam<Types>, Nullable extends FieldNullability<Type>, InputName extends string, ResolveReturnShape> = Omit<PothosSchemaTypes.QueryFieldOptions<Types, Type, Nullable, {
    [K in InputName]: InputFieldRef<InputShapeFromFields<Fields>>;
}, ResolveReturnShape>, "args">;
export type MutationFieldWithInputOptions<Types extends SchemaTypes, Fields extends InputFieldMap, Type extends TypeParam<Types>, Nullable extends FieldNullability<Type>, InputName extends string, ResolveReturnShape> = Omit<PothosSchemaTypes.MutationFieldOptions<Types, Type, Nullable, {
    [K in InputName]: InputFieldRef<InputShapeFromFields<Fields>>;
}, ResolveReturnShape>, "args">;
export type SubscriptionFieldWithInputOptions<Types extends SchemaTypes, Fields extends InputFieldMap, Type extends TypeParam<Types>, Nullable extends FieldNullability<Type>, InputName extends string, ResolveShape, ResolveReturnShape> = Omit<PothosSchemaTypes.SubscriptionFieldOptions<Types, Type, Nullable, {
    [K in InputName]: InputFieldRef<InputShapeFromFields<Fields>>;
}, ResolveShape, ResolveReturnShape>, "args">;
export type ObjectFieldWithInputOptions<Types extends SchemaTypes, ParentShape, Fields extends InputFieldMap, Type extends TypeParam<Types>, Nullable extends FieldNullability<Type>, InputName extends string, ResolveReturnShape> = Omit<PothosSchemaTypes.ObjectFieldOptions<Types, ParentShape, Type, Nullable, {
    [K in InputName]: InputFieldRef<InputShapeFromFields<Fields>>;
}, ResolveReturnShape>, "args">;
export type InterfaceFieldWithInputOptions<Types extends SchemaTypes, ParentShape, Fields extends InputFieldMap, Type extends TypeParam<Types>, Nullable extends FieldNullability<Type>, InputName extends string, ResolveReturnShape> = Omit<PothosSchemaTypes.InterfaceFieldOptions<Types, ParentShape, Type, Nullable, {
    [K in InputName]: InputFieldRef<InputShapeFromFields<Fields>>;
}, ResolveReturnShape>, "args">;
