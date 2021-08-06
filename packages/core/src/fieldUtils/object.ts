import { SchemaTypes } from '../types/index.js';
import FieldBuilder from './builder.js';

export default class ObjectFieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
> extends FieldBuilder<Types, ParentShape, 'Object'> {
  constructor(name: string, builder: GiraphQLSchemaTypes.SchemaBuilder<Types>) {
    super(name, builder, 'Object', 'Object');
  }
}
