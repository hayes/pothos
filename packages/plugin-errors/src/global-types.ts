import type {
  FieldNullability,
  InputFieldMap,
  SchemaTypes,
  ShapeFromTypeParam,
  TypeParam,
} from '@pothos/core';
import type { PothosErrorsPlugin } from '.';
import type { ErrorFieldOptions, ErrorsPluginOptions } from './types';

declare global {
  export namespace PothosSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      errors: PothosErrorsPlugin<Types>;
    }

    export interface SchemaBuilderOptions<Types extends SchemaTypes> {
      errors?: ErrorsPluginOptions<Types>;
    }

    export interface V3SchemaBuilderOptions<Types extends SchemaTypes> {
      errors: never;
      errorOptions?: ErrorsPluginOptions<Types>;
    }

    export interface FieldOptions<
      Types extends SchemaTypes = SchemaTypes,
      ParentShape = unknown,
      Type extends TypeParam<Types> = TypeParam<Types>,
      Nullable extends FieldNullability<Type> = FieldNullability<Type>,
      Args extends InputFieldMap = InputFieldMap,
      ResolveShape = unknown,
      ResolveReturnShape = unknown,
    > {
      errors?: ErrorFieldOptions<Types, Type, ShapeFromTypeParam<Types, Type, false>, Nullable>;
      itemErrors?: Type extends [infer Item extends TypeParam<Types>]
        ? ErrorFieldOptions<Types, Item, ShapeFromTypeParam<Types, Item, false>, false>
        : never;
    }
  }
}
