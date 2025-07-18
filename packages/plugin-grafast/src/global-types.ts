import type {
  FieldNullability,
  InputFieldMap,
  InputShapeFromFields,
  Resolver,
  SchemaTypes,
  ShapeFromTypeParam,
  TypeParam,
} from '@pothos/core';
import type { ExecutableStep, FieldArgs, ObjectStep } from 'grafast';

import type { PothosGrafastPlugin } from '.';

declare global {
  export namespace PothosSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      grafast: PothosGrafastPlugin<Types>;
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
            ) => ExecutableStep<ShapeFromTypeParam<Types, Type, Nullable>>;
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
            resolve: Resolver<
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
