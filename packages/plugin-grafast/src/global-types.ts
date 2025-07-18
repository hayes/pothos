// biome-ignore assist/source/organizeImports: <explanation>
import type {
  FieldNullability,
  InputFieldMap,
  InputShapeFromFields,
  ListResolveValue,
  MaybePromise,
  SchemaTypes,
  ShapeFromTypeParam,
  TypeParam,
} from '@pothos/core';
import type { ExecutableStep, FieldArgs, ObjectStep, Step } from 'grafast';

import type { PothosGrafastPlugin } from '.';
import type { GraphQLObjectType } from 'graphql';

declare global {
  export namespace PothosSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      grafast: PothosGrafastPlugin<Types>;
    }

    export interface UnionRef<Types extends SchemaTypes, T, P = T> {
      withPlan: <Source>(
        plan: (step: Step<Source>) => {
          $__typename: Step<string | null>;
          planForType: (t: GraphQLObjectType) => Step<P | null | undefined> | null;
        },
      ) => UnionRef<Types, Source, P>;
    }

    export interface InterfaceRef<Types extends SchemaTypes, T, P = T> {
      withPlan: <Source = T>(
        plan: (step: Step<Source>) => {
          $__typename: Step<string | null>;
          planForType: (t: GraphQLObjectType) => Step<P | null | undefined> | null;
        },
      ) => InterfaceRef<Types, Source, P>;
    }

    export interface InferredFieldOptions<
      Types extends SchemaTypes,
      ResolveShape = unknown,
      Type extends TypeParam<Types> = TypeParam<Types>,
      Nullable extends FieldNullability<Type> = FieldNullability<Type>,
      Args extends InputFieldMap = InputFieldMap,
      ResolveReturnShape = unknown,
    > {
      Grafast:
        | {
            resolve?: never;
            plan: (
              step: ObjectStep<{
                [K in keyof ResolveShape]: ExecutableStep<ResolveShape[K]>;
              }>,
              args: FieldArgs<InputShapeFromFields<Args>>,
            ) => Step<ShapeFromTypeParam<Types, Type, Nullable>>;
          }
        | {
            plan?: never;
            /**
             * Resolver function for this field
             * @param parent - The parent object for the current type
             * @param {object} args - args object based on the args defined for this field
             * @param {object} context - the context object for the current query, based on `Context` type provided to the SchemaBuilder
             * @param {GraphQLResolveInfo} info - info about how this field was queried
             */
            resolve: GrafastResolver<
              ResolveShape,
              InputShapeFromFields<Args>,
              Types['Context'],
              ShapeFromTypeParam<Types, Type, Nullable>,
              ResolveReturnShape
            >;
          };
    }
  }
}

export type GrafastResolver<Parent, Args, Context, Type, Return = unknown> = (
  parent: Parent,
  args: Args,
  context: Context,
  // grafast does not currently support GraphQLResolveInfo
  // info: GraphQLResolveInfo,
) => [Type] extends [readonly (infer Item)[] | null | undefined]
  ? ListResolveValue<Type, Item, Return>
  : MaybePromise<Type>;
