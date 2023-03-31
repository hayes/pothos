// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unused-vars */
import { EnumValues, FieldNullability, FieldRequiredness, InputFieldMap, InputType, InterfaceParam, ObjectParam, RootName, SchemaTypes, TypeParam, } from '../core/index.ts';
import { DirectiveLocation, Directives } from './types.ts';
import type { PothosDirectivesPlugin } from './index.ts';
declare global {
    export namespace PothosSchemaTypes {
        export interface Plugins<Types extends SchemaTypes> {
            directives: PothosDirectivesPlugin<Types>;
        }
        export interface UserSchemaTypes {
            Directives: Record<string, {
                locations: DirectiveLocation;
                args?: Record<string, unknown>;
            }>;
        }
        export interface ExtendDefaultTypes<PartialTypes extends Partial<UserSchemaTypes>> {
            Directives: PartialTypes["Directives"] & {};
        }
        export interface SchemaBuilderOptions<Types extends SchemaTypes> {
            directives?: {
                useGraphQLToolsUnorderedDirectives?: boolean;
            };
        }
        export interface V3SchemaBuilderOptions<Types extends SchemaTypes> {
            directives: never;
            useGraphQLToolsUnorderedDirectives?: boolean;
        }
        export interface EnumTypeOptions<Types extends SchemaTypes = SchemaTypes, Values extends EnumValues<Types> = EnumValues<Types>> extends BaseTypeOptions<Types> {
            directives?: Directives<Types, "ENUM">;
        }
        export interface ObjectTypeOptions<Types extends SchemaTypes = SchemaTypes, Shape = unknown> extends BaseTypeOptions<Types> {
            directives?: Directives<Types, "OBJECT">;
        }
        export interface RootTypeOptions<Types extends SchemaTypes, Type extends RootName> extends BaseTypeOptions<Types> {
            directives?: Directives<Types, "OBJECT">;
        }
        export interface InputObjectTypeOptions<Types extends SchemaTypes = SchemaTypes, Fields extends InputFieldMap = InputFieldMap> extends BaseTypeOptions<Types> {
            directives?: Directives<Types, "INPUT_OBJECT">;
        }
        export interface InterfaceTypeOptions<Types extends SchemaTypes = SchemaTypes, Shape = unknown, Interfaces extends InterfaceParam<Types>[] = InterfaceParam<Types>[]> extends BaseTypeOptions<Types> {
            directives?: Directives<Types, "INTERFACE">;
        }
        export interface UnionTypeOptions<Types extends SchemaTypes = SchemaTypes, Member extends ObjectParam<Types> = ObjectParam<Types>> extends BaseTypeOptions<Types> {
            directives?: Directives<Types, "UNION">;
        }
        export interface ScalarTypeOptions<Types extends SchemaTypes = SchemaTypes, ScalarInputShape = unknown, ScalarOutputShape = unknown> extends BaseTypeOptions<Types> {
            directives?: Directives<Types, "SCALAR">;
        }
        export interface FieldOptions<Types extends SchemaTypes = SchemaTypes, ParentShape = unknown, Type extends TypeParam<Types> = TypeParam<Types>, Nullable extends FieldNullability<Type> = FieldNullability<Type>, Args extends InputFieldMap = InputFieldMap, ResolveShape = unknown, ResolveReturnShape = unknown> {
            directives?: Directives<Types, "FIELD_DEFINITION">;
        }
        export interface InputObjectFieldOptions<Types extends SchemaTypes = SchemaTypes, Type extends InputType<Types> | [
            InputType<Types>
        ] = InputType<Types> | [
            InputType<Types>
        ], Req extends FieldRequiredness<Type> = FieldRequiredness<Type>> {
            directives?: Directives<Types, "INPUT_FIELD_DEFINITION">;
        }
        export interface ArgFieldOptions<Types extends SchemaTypes = SchemaTypes, Type extends InputType<Types> | [
            InputType<Types>
        ] = InputType<Types> | [
            InputType<Types>
        ], Req extends FieldRequiredness<Type> = FieldRequiredness<Type>> {
            directives?: Directives<Types, "ARGUMENT_DEFINITION">;
        }
        export interface EnumValueConfig<Types extends SchemaTypes = SchemaTypes> {
            directives?: Directives<Types, "ENUM_VALUE">;
        }
        export interface BuildSchemaOptions<Types extends SchemaTypes> {
            schemaDirectives?: Directives<Types, "SCHEMA">;
        }
    }
}
