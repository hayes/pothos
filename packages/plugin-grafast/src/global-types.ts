/* eslint-disable @typescript-eslint/no-unused-vars */
import { ExecutableStep, FieldArgs } from 'grafast';
import {
  FieldNullability,
  InputFieldMap,
  InputShapeFromField,
  InputShapeFromFields,
  SchemaTypes,
  ShapeFromTypeParam,
  TypeParam,
} from '@pothos/core';
import { type PothosGrafastPlugin } from '.';

declare global {
  export namespace PothosSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      grafast: PothosGrafastPlugin<Types>;
    }

    export interface FieldOptions<
      Types extends SchemaTypes,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveShape,
      ResolveReturnShape,
    > {
      plan?: (
        step: Omit<ExecutableStep<ParentShape>, 'get'> & {
          get: <T extends keyof ParentShape>(key: T) => ExecutableStep<ParentShape[T]>;
        },
        args: Omit<FieldArgs, 'get'> & {
          get: <T extends keyof Args>(key: T) => ExecutableStep<InputShapeFromField<Args[T]>>;
        },
      ) => ExecutableStep<ShapeFromTypeParam<Types, Type, Nullable>>;
    }
  }
}
