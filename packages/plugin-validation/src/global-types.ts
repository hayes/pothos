/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  FieldNullability,
  FieldRequiredness,
  InputFieldMap,
  InputShapeFromFields,
  InputShapeFromTypeParam,
  InputType,
  SchemaTypes,
  TypeParam,
} from '@giraphql/core';
import { ValidationOptions } from './types';
import { GiraphQLValidationPlugin } from '.';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      validation: GiraphQLValidationPlugin<Types>;
    }

    export interface FieldOptions<
      Types extends SchemaTypes,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveShape,
      ResolveReturnShape
    > {
      validate?: ValidationOptions<InputShapeFromFields<Args>>;
    }

    export interface InputFieldOptions<
      Types extends SchemaTypes = SchemaTypes,
      Type extends InputType<Types> | [InputType<Types>] = InputType<Types> | [InputType<Types>],
      Req extends FieldRequiredness<Type> = FieldRequiredness<Type>
    > {
      validate?: ValidationOptions<InputShapeFromTypeParam<Types, Type, true>>;
    }
  }
}
