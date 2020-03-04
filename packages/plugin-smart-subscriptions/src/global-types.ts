/* eslint-disable @typescript-eslint/no-unused-vars */
import { TypeParam, FieldNullability, InputFields } from '@giraphql/core';
import { GraphQLResolveInfo } from 'graphql';
import { SubscriptionManager } from '.';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface ObjectTypeOptions<Types extends TypeInfo, Shape> {
      subscribe?: (
        subscriptions: SubscriptionManager,
        parent: Shape,
        context: Types['Context'],
        info: GraphQLResolveInfo,
      ) => void;
    }

    export interface QueryFieldOptions<
      Types extends TypeInfo,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFields<Types>
    > {
      smartSubscription?: boolean;
      subscribe?: (
        subscriptions: SubscriptionManager,
        parent: unknown,
        args: {},
        context: object,
        info: GraphQLResolveInfo,
      ) => void;
    }

    export interface ObjectFieldOptions<
      Types extends TypeInfo,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFields<Types>
    > extends FieldOptions<Types, ParentShape, Type, Nullable, Args, ParentShape> {
      subscribe?: (
        subscriptions: SubscriptionManager,
        parent: unknown,
        args: {},
        context: object,
        info: GraphQLResolveInfo,
      ) => void;
    }

    export interface ResolverPluginData {
      smartSubscriptions: {
        subscriptionByType: {
          [k: string]:
            | undefined
            | ((
                subscriptions: SubscriptionManager,
                parent: unknown,
                context: object,
                info: GraphQLResolveInfo,
              ) => void);
        };
      };
    }

    export interface FieldWrapData {
      smartSubscriptions: {
        subscribe?: (
          subscriptions: SubscriptionManager,
          parent: unknown,
          args: {},
          context: object,
          info: GraphQLResolveInfo,
        ) => void;
        objectSubscription?: (
          subscriptions: SubscriptionManager,
          parent: unknown,
          context: object,
          info: GraphQLResolveInfo,
        ) => void;
        subscriptionByType: {
          [k: string]:
            | undefined
            | ((
                subscriptions: SubscriptionManager,
                parent: unknown,
                context: object,
                info: GraphQLResolveInfo,
              ) => void);
        };
      };
    }
  }
}
