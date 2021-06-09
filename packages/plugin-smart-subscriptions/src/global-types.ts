/* eslint-disable @typescript-eslint/no-unused-vars */
import { GraphQLResolveInfo } from 'graphql';
import {
  FieldNullability,
  InputFieldMap,
  InputShapeFromFields,
  SchemaTypes,
  TypeParam,
} from '@giraphql/core';
import { SmartSubscriptionOptions } from './types';
import {
  FieldSubscriptionManager,
  GiraphQLSmartSubscriptionsPlugin,
  TypeSubscriptionManager,
} from '.';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      smartSubscriptions: GiraphQLSmartSubscriptionsPlugin<Types>;
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
      ResolveReturnShape,
    > {
      smartSubscription?: boolean;
      subscribe?: (
        subscriptions: FieldSubscriptionManager<Types>,
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
      ResolveReturnShape,
    > {
      subscribe?: (
        subscriptions: FieldSubscriptionManager<Types>,
        parent: ParentShape,
        args: InputShapeFromFields<Args>,
        context: Types['Context'],
        info: GraphQLResolveInfo,
      ) => void;
      canRefetch?: boolean;
    }
  }
}
