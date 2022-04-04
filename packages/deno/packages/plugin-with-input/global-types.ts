// @ts-nocheck
import { FieldKind, FieldNullability, FieldRef, InputFieldMap, InputFieldRef, InterfaceParam, ObjectParam, OutputShape, SchemaTypes, ShapeFromTypeParam, TypeParam, } from '../core/index.ts';
import { FieldWithInputOptions, InterfaceFieldWithInputOptions, MutationFieldWithInputOptions, ObjectFieldWithInputOptions, QueryFieldWithInputOptions, SubscriptionFieldWithInputOptions, WithInputBuilderOptions, WithInputInputOptions, } from './types.ts';
import { PothosWithInputPlugin } from './index.ts';
declare global {
    export namespace PothosSchemaTypes {
        export interface Plugins<Types extends SchemaTypes> {
            withInput: PothosWithInputPlugin<Types>;
        }
        export interface SchemaBuilderOptions<Types extends SchemaTypes> {
            withInput: WithInputBuilderOptions<Types>;
        }
        export interface RootFieldBuilder<Types extends SchemaTypes, ParentShape, Kind extends FieldKind = FieldKind> {
            input: InputFieldBuilder<Types, "InputObject">;
            fieldWithInput: <Fields extends Record<string, InputFieldRef<unknown, "InputObject">>, Type extends TypeParam<Types>, ResolveShape, ResolveReturnShape, Nullable extends FieldNullability<Type> = Types["DefaultFieldNullability"], InputName extends string = "input">(options: FieldWithInputOptions<Types, ParentShape, Kind, Fields, Type, Nullable, InputName, ResolveShape, ResolveReturnShape>) => FieldRef<ShapeFromTypeParam<Types, Type, Nullable>>;
        }
        export interface SchemaBuilder<Types extends SchemaTypes> {
            queryFieldWithInput: <Fields extends InputFieldMap, Type extends TypeParam<Types>, Nullable extends FieldNullability<Type>, ResolveReturnShape, InputName extends string = "input">(name: string, inputOptions: WithInputInputOptions<Types, Fields, InputName>, fieldOptions: QueryFieldWithInputOptions<Types, Fields, Type, Nullable, InputName, ResolveReturnShape>) => void;
            mutationFieldWithInput: <Fields extends InputFieldMap, Type extends TypeParam<Types>, Nullable extends FieldNullability<Type>, ResolveReturnShape, InputName extends string = "input">(name: string, inputOptions: WithInputInputOptions<Types, Fields, InputName>, fieldOptions: MutationFieldWithInputOptions<Types, Fields, Type, Nullable, InputName, ResolveReturnShape>) => void;
            subscriptionFieldWithInput: <Fields extends InputFieldMap, Type extends TypeParam<Types>, Nullable extends FieldNullability<Type>, ResolveShape, ResolveReturnShape, InputName extends string = "input">(name: string, inputOptions: WithInputInputOptions<Types, Fields, InputName>, fieldOptions: SubscriptionFieldWithInputOptions<Types, Fields, Type, Nullable, InputName, ResolveShape, ResolveReturnShape>) => void;
            objectFieldWithInput: <Fields extends InputFieldMap, ParentType extends ObjectParam<Types>, Type extends TypeParam<Types>, Nullable extends FieldNullability<Type>, ResolveReturnShape, InputName extends string = "input">(ref: ParentType, name: string, inputOptions: WithInputInputOptions<Types, Fields, InputName>, fieldOptions: ObjectFieldWithInputOptions<Types, OutputShape<Types, ParentType>, Fields, Type, Nullable, InputName, ResolveReturnShape>) => void;
            interfaceFieldWithInput: <Fields extends InputFieldMap, ParentType extends InterfaceParam<Types>, Type extends TypeParam<Types>, Nullable extends FieldNullability<Type>, ResolveReturnShape, InputName extends string = "input">(ref: ParentType, name: string, inputOptions: WithInputInputOptions<Types, Fields, InputName>, fieldOptions: InterfaceFieldWithInputOptions<Types, OutputShape<Types, ParentType>, Fields, Type, Nullable, InputName, ResolveReturnShape>) => void;
        }
    }
}
