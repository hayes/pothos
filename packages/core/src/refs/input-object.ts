/* eslint-disable max-classes-per-file */
import { InputFieldsFromShape, InputRef, inputShapeKey, SchemaTypes } from '../types';
import BaseTypeRef from './base';

export default class InputObjectRef<T>
  extends BaseTypeRef
  implements InputRef<T>, PothosSchemaTypes.InputObjectRef<T>
{
  override kind = 'InputObject' as const;

  $inferInput!: T;

  [inputShapeKey]!: T;

  constructor(name: string) {
    super('InputObject', name);
  }
}

export class ImplementableInputObjectRef<
  Types extends SchemaTypes,
  T extends object,
  Resolved = T,
> extends InputObjectRef<Resolved> {
  protected builder: PothosSchemaTypes.SchemaBuilder<Types>;

  constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>, name: string) {
    super(name);

    this.builder = builder;
  }

  implement(options: PothosSchemaTypes.InputObjectTypeOptions<Types, InputFieldsFromShape<T>>) {
    this.builder.inputType<ImplementableInputObjectRef<Types, T>, InputFieldsFromShape<T>>(
      this as never,
      options,
    );

    return this as InputObjectRef<Resolved>;
  }
}
