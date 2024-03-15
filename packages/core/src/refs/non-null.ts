import {
  InputShape,
  inputShapeKey,
  InputType,
  NonNullShape,
  OutputShape,
  outputShapeKey,
  OutputType,
  SchemaTypes,
} from '../types';
import { BaseTypeRef } from './base';
// eslint-disable-next-line import/no-cycle
import { ListRef } from './list';

export class NonNullRef<
  Types extends SchemaTypes,
  T extends InputType<Types> | OutputType<Types>,
> extends BaseTypeRef<Types> {
  // implements PothosSchemaTypes.NonNullRef<Types, T>
  override kind = 'NonNull' as const;

  $inferType!: T extends OutputType<Types> ? NonNullShape<OutputShape<Types, T>> : never;

  $inferInput!: T extends InputType<Types> ? NonNullShape<InputShape<Types, T>> : never;

  [outputShapeKey]!: T extends OutputType<Types> ? NonNullShape<OutputShape<Types, T>> : never;

  [inputShapeKey]!: T extends InputType<Types> ? NonNullShape<InputShape<Types, T>> : never;

  type: T;

  constructor(type: T) {
    super('NonNull', `NonNullable<${String(type)}>`);
    this.type = type;
  }

  list() {
    return new ListRef<Types, typeof this>(this);
  }
}
