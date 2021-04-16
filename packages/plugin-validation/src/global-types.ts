/* eslint-disable @typescript-eslint/no-unused-vars */
import { unknown } from 'zod';
import {
  FieldNullability,
  FieldRequiredness,
  InputFieldMap,
  InputShapeFromFields,
  InputShapeFromTypeParam,
  InputType,
  RecursivelyNormalizeNullableFields,
  SchemaTypes,
  TypeParam,
} from '@giraphql/core';
import { RefineConstraint, ValidationOptions } from './types';
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
      validate?: RefineConstraint<InputShapeFromFields<Args>>;
    }

    export interface InputObjectTypeOptions<
      Types extends SchemaTypes = SchemaTypes,
      Fields extends InputFieldMap = InputFieldMap
    > {
      validate?: RefineConstraint<InputShapeFromFields<Fields>>;
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
