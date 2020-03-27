/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  TypeParam,
  FieldNullability,
  InputFields,
  InputShapeFromFields,
  MaybePromise,
} from '@giraphql/core';
import { GraphQLResolveInfo } from 'graphql';
import { TypeSubscriptionManager, FieldSubscriptionManager } from '.';
import ResolverCache from './resolver-cache';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface ObjectTypeOptions<Types extends TypeInfo, Shape> {
      subscribe?: (
        subscriptions: TypeSubscriptionManager<Shape>,
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
        subscriptions: FieldSubscriptionManager,
        parent: Types['Root'],
        args: InputShapeFromFields<Types, Args>,
        context: Types['Context'],
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
        subscriptions: FieldSubscriptionManager,
        parent: ParentShape,
        args: InputShapeFromFields<Types, Args>,
        context: Types['Context'],
        info: GraphQLResolveInfo,
      ) => void;
      canRefetch?: boolean;
    }

    export interface ResolverPluginData {
      smartSubscriptions: {
        cache: ResolverCache;
        refetch: () => void;
        replace?: (p: MaybePromise<unknown>) => void;
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
