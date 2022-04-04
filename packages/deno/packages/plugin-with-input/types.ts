// @ts-nocheck
import { FieldKind, FieldNullability, FieldOptionsFromKind, InputFieldMap, InputFieldRef, InputRef, InputShapeFromFields, SchemaTypes, TypeParam, } from '../core/index.ts';
export interface WithInputBuilderOptions<Types extends SchemaTypes> {
    argOptions?: Omit<PothosSchemaTypes.ArgFieldOptions<Types, InputRef<{}>, true>, "type" | "required"> & {
        required?: boolean;
    };
    typeOptions?: Omit<PothosSchemaTypes.InputObjectTypeOptions<Types, {}>, "fields">;
}
export type WithInputInputOptions<Types extends SchemaTypes, Fields extends InputFieldMap, InputName extends string> = Omit<PothosSchemaTypes.InputObjectTypeOptions<Types, Fields>, "fields"> & {
    name?: string;
    argName?: InputName;
    inputFields: (t: PothosSchemaTypes.InputFieldBuilder<Types, "InputObject">) => Fields;
};
export type WithInputTypeOptions<Types extends SchemaTypes, Fields extends InputFieldMap> = Omit<PothosSchemaTypes.InputObjectTypeOptions<Types, Fields>, "fields"> & {
    name?: string;
};
export type WithInputArgOptions<Types extends SchemaTypes, Fields extends InputFieldMap, InputName> = Omit<PothosSchemaTypes.ArgFieldOptions<Types, InputRef<InputShapeFromFields<Fields>>, true>, "type"> & {
    name?: InputName;
};
export type FieldWithInputOptions<Types extends SchemaTypes, ParentShape, Kind extends FieldKind, Args extends Record<string, InputFieldRef<unknown, "Arg">>, Fields extends Record<string, InputFieldRef<unknown, "InputObject">>, Type extends TypeParam<Types>, Nullable extends FieldNullability<Type>, InputName extends string, ResolveShape, ResolveReturnShape> = Omit<FieldOptionsFromKind<Types, ParentShape, Type, Nullable, {
    [K in InputName]: InputFieldRef<InputShapeFromFields<Fields>>;
} & Args, Kind, ResolveShape, ResolveReturnShape>, "args"> & {
    typeOptions?: WithInputTypeOptions<Types, Fields>;
    argOptions?: WithInputArgOptions<Types, Fields, InputName>;
    input: Fields;
    args?: Args;
};
