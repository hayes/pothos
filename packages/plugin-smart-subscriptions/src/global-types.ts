/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  TypeParam,
  FieldNullability,
  InputFieldMap,
  InputShapeFromFields,
  SchemaTypes,
} from '@giraphql/core';
import { GraphQLResolveInfo } from 'graphql';
import SmartSubscriptionsPlugin, { TypeSubscriptionManager, FieldSubscriptionManager } from '.';
import { SmartSubscriptionOptions } from './types';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      GiraphQLSmartSubscriptions: SmartSubscriptionsPlugin<Types>;
    }

    export interface SchemaBuilderOptions<Types extends SchemaTypes> {
      smartSubscriptions: SmartSubscriptionOptions<Types['Context']>;
    }

    export interface ObjectTypeOptions<Types extends SchemaTypes, Shape> {
      subscribe?: (
        subscriptions: TypeSubscriptionManager<Shape>,
        parent: Shape,
        context: Types['Context'],
        info: GraphQLResolveInfo,
      ) => void;
    }

    export interface QueryFieldOptions<
      Types extends SchemaTypes,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveReturnShape
    > {
      smartSubscription?: boolean;
      subscribe?: (
        subscriptions: FieldSubscriptionManager,
        parent: Types['Root'],
        args: InputShapeFromFields<Args>,
        context: Types['Context'],
        info: GraphQLResolveInfo,
      ) => void;
    }

    export interface ObjectFieldOptions<
      Types extends SchemaTypes,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveReturnShape
    > {
      subscribe?: (
        subscriptions: FieldSubscriptionManager,
        parent: ParentShape,
        args: InputShapeFromFields<Args>,
        context: Types['Context'],
        info: GraphQLResolveInfo,
      ) => void;
      canRefetch?: boolean;
    }
  }
}
