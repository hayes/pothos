/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  TypeParam,
  FieldNullability,
  InputFieldMap,
  InputShapeFromFields,
  SchemaTypes,
} from '@giraphql/core';
import { GraphQLResolveInfo } from 'graphql';
import { TypeSubscriptionManager, FieldSubscriptionManager } from '.';
import ResolverCache from './resolver-cache';

declare global {
  export namespace GiraphQLSchemaTypes {
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

    export interface ResolverPluginData {
      smartSubscriptions: {
        cache: ResolverCache;
        refetch: () => void;
        typeSubscriptionManager?: TypeSubscriptionManager;
        subscriptionByType: {
          [k: string]:
            | undefined
            | ((
                subscriptions: TypeSubscriptionManager,
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
          subscriptions: FieldSubscriptionManager,
          parent: unknown,
          args: {},
          context: object,
          info: GraphQLResolveInfo,
        ) => void;
        objectSubscription?: (
          subscriptions: TypeSubscriptionManager,
          parent: unknown,
          context: object,
          info: GraphQLResolveInfo,
        ) => void;
        canRefetch: boolean;
        subscriptionByType: {
          [k: string]:
            | undefined
            | ((
                subscriptions: TypeSubscriptionManager,
                parent: unknown,
                context: object,
                info: GraphQLResolveInfo,
              ) => void);
        };
      };
    }
  }
}
