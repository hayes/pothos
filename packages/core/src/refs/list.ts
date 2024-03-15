import {
  InputShape,
  inputShapeKey,
  InputType,
  OutputShape,
  outputShapeKey,
  OutputType,
  SchemaTypes,
} from '../types';
import { BaseTypeRef } from './base';
import { NonNullRef } from './non-null';

export class ListRef<Types extends SchemaTypes, T extends InputType<Types> | OutputType<Types>>
  extends BaseTypeRef<Types>
  implements PothosSchemaTypes.ListRef<Types, T>
{
  override kind = 'List' as const;

  $inferType!: T extends OutputType<Types> ? OutputShape<Types, T>[] : never;

  $inferInput!: T extends InputType<Types> ? InputShape<Types, T>[] : never;

  [outputShapeKey]!: T extends OutputType<Types> ? OutputShape<Types, T>[] : never;

  [inputShapeKey]!: T extends InputType<Types> ? InputShape<Types, T>[] : never;

  listType: T;

  constructor(listType: T) {
    super('List', `List<${String(listType)}>`);
    this.listType = listType;
  }

  list() {
    return new ListRef<Types, typeof this>(this);
  }

  nonNull() {
    return new NonNullRef<Types, typeof this>(this);
  }
}
