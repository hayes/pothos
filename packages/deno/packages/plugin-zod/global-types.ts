// @ts-nocheck
import type { FieldNullability, FieldRequiredness, InputFieldMap, InputShapeFromFields, InputShapeFromTypeParam, InputType, SchemaTypes, TypeParam, } from '../core/index.ts';
import type { ValidationOptions, ValidationPluginOptions } from './types.ts';
import type { PothosZodPlugin } from './index.ts';
declare global {
    export namespace PothosSchemaTypes {
        export interface Plugins<Types extends SchemaTypes> {
            zod: PothosZodPlugin<Types>;
        }
        export interface SchemaBuilderOptions<Types extends SchemaTypes> {
            zod?: ValidationPluginOptions<Types>;
        }
        export interface V3SchemaBuilderOptions<Types extends SchemaTypes> {
            zod?: never;
            validationOptions?: ValidationPluginOptions<Types>;
        }
        export interface FieldOptions<Types extends SchemaTypes, ParentShape, Type extends TypeParam<Types>, Nullable extends FieldNullability<Type>, Args extends InputFieldMap, ResolveShape, ResolveReturnShape> {
            validate?: ValidationOptions<InputShapeFromFields<Args>>;
        }
        export interface InputObjectTypeOptions<Types extends SchemaTypes = SchemaTypes, Fields extends InputFieldMap = InputFieldMap> {
            validate?: ValidationOptions<InputShapeFromFields<Fields>>;
        }
        export interface InputFieldOptions<Types extends SchemaTypes = SchemaTypes, Type extends InputType<Types> | [
            InputType<Types>
        ] = InputType<Types> | [
            InputType<Types>
        ], Req extends FieldRequiredness<Type> = FieldRequiredness<Type>> {
            validate?: ValidationOptions<InputShapeFromTypeParam<Types, Type, true>>;
        }
    }
}
