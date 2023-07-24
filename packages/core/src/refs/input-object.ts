/* eslint-disable max-classes-per-file */
import {
  InputFieldsFromShape,
  InputRef,
  InputShapeFromFields,
  inputShapeKey,
  RecursivelyNormalizeNullableFields,
  SchemaTypes,
} from '../types';
import BaseTypeRef from './base';

export default class InputObjectRef<T>
  extends BaseTypeRef
  implements InputRef<T>, PothosSchemaTypes.InputObjectRef<T>
{
  override kind = 'InputObject' as const;

  [inputShapeKey]!: T;

  constructor(name: string) {
    super('InputObject', name);
  }
}

export class ImplementableInputObjectRef<
  Types extends SchemaTypes,
  T extends object,
> extends InputObjectRef<RecursivelyNormalizeNullableFields<T>> {
  protected builder: PothosSchemaTypes.SchemaBuilder<Types>;

  constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>, name: string) {
    super(name);

    this.builder = builder;
  }

  implement<Fields extends InputFieldsFromShape<RecursivelyNormalizeNullableFields<T>>>(
    options: PothosSchemaTypes.InputObjectTypeOptions<Types, Fields>,
  ) {
    this.builder.inputType<ImplementableInputObjectRef<Types, T>, Fields>(this, options);

    return this as InputObjectRef<InputShapeFromFields<Fields>>;
  }
}
