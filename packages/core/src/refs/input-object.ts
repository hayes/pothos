/* eslint-disable max-classes-per-file */
import { InputRef, inputShapeKey } from '../types';
import BaseTypeRef from './base';

import { InputFieldsFromShape, RecursivelyNormalizeNullableFields, SchemaTypes } from '..';

export default class InputObjectRef<T> extends BaseTypeRef implements InputRef {
  kind = 'InputObject' as const;

  [inputShapeKey]: T;

  constructor(name: string) {
    super('InputObject', name);
  }
}

export class ImplementableInputObjectRef<
  Types extends SchemaTypes,
  T extends object
> extends InputObjectRef<RecursivelyNormalizeNullableFields<T>> {
  private builder: GiraphQLSchemaTypes.SchemaBuilder<Types>;

  constructor(builder: GiraphQLSchemaTypes.SchemaBuilder<Types>, name: string) {
    super(name);

    this.builder = builder;
  }

  implement(
    options: GiraphQLSchemaTypes.InputObjectTypeOptions<
      Types,
      InputFieldsFromShape<RecursivelyNormalizeNullableFields<T>>
    >,
  ) {
    this.builder.inputType<
      ImplementableInputObjectRef<Types, T>,
      InputFieldsFromShape<RecursivelyNormalizeNullableFields<T>>
    >(this, options);

    return this as InputObjectRef<T>;
  }
}
