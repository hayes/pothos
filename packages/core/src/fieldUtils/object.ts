import FieldBuilder from './builder';
import { SchemaTypes } from '../types';

export default class ObjectFieldBuilder<
  Types extends SchemaTypes,
  ParentShape
> extends FieldBuilder<Types, ParentShape, 'Object'> {
  constructor(name: string, builder: GiraphQLSchemaTypes.SchemaBuilder<Types>) {
    super(name, builder, 'Object', 'Object');
  }
}
