// @ts-nocheck
import { FieldNullability, InputFieldMap, InterfaceParam, ObjectParam, OutputShape, SchemaTypes, TypeParam, } from '../core/index.ts';
import { InterfaceFieldWithInputOptions, MutationFieldWithInputOptions, ObjectFieldWithInputOptions, QueryFieldWithInputOptions, SubscriptionFieldWithInputOptions, WithInputBuilderOptions, WithInputInputOptions, } from './types.ts';
import { PothosWithInputPlugin } from './index.ts';
declare global {
    export namespace PothosSchemaTypes {
        export interface Plugins<Types extends SchemaTypes> {
            withInput: PothosWithInputPlugin<Types>;
        }
        export interface SchemaBuilderOptions<Types extends SchemaTypes> {
            withInput: WithInputBuilderOptions<Types>;
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
