import type {
  FieldNullability,
  InputFieldMap,
  InputShapeFromFields,
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
        step: ObjectStep<{
          [K in keyof ParentShape]: ExecutableStep<ParentShape[K]>;
        }>,
        args: FieldArgs<InputShapeFromFields<Args>>,
      ) => ExecutableStep<ShapeFromTypeParam<Types, Type, Nullable>>;
    }
  }
}
