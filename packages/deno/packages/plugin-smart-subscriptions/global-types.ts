// @ts-nocheck
import type { FieldNullability, InputFieldMap, InputShapeFromFields, SchemaTypes, TypeParam, } from '../core/index.ts';
import type { GraphQLResolveInfo } from 'https://cdn.skypack.dev/graphql?dts';
import type { SmartSubscriptionOptions } from './types.ts';
import type { FieldSubscriptionManager, PothosSmartSubscriptionsPlugin, TypeSubscriptionManager, } from './index.ts';
declare global {
    export namespace PothosSchemaTypes {
        export interface Plugins<Types extends SchemaTypes> {
            smartSubscriptions: PothosSmartSubscriptionsPlugin<Types>;
        }
        export interface SchemaBuilderOptions<Types extends SchemaTypes> {
            smartSubscriptions: SmartSubscriptionOptions<Types["Context"]>;
        }
        export interface ObjectTypeOptions<Types extends SchemaTypes, Shape> {
            subscribe?: (subscriptions: TypeSubscriptionManager<Shape>, parent: Shape, context: Types["Context"], info: GraphQLResolveInfo) => void;
        }
        export interface QueryFieldOptions<Types extends SchemaTypes, Type extends TypeParam<Types>, Nullable extends FieldNullability<Type>, Args extends InputFieldMap, ResolveReturnShape> {
            smartSubscription?: boolean;
            subscribe?: (subscriptions: FieldSubscriptionManager<Types>, parent: Types["Root"], args: InputShapeFromFields<Args>, context: Types["Context"], info: GraphQLResolveInfo) => void;
        }
        export interface ObjectFieldOptions<Types extends SchemaTypes, ParentShape, Type extends TypeParam<Types>, Nullable extends FieldNullability<Type>, Args extends InputFieldMap, ResolveReturnShape> {
            subscribe?: (subscriptions: FieldSubscriptionManager<Types>, parent: ParentShape, args: InputShapeFromFields<Args>, context: Types["Context"], info: GraphQLResolveInfo) => void;
            canRefetch?: boolean;
        }
    }
}
