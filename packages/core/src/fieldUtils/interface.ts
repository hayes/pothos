import { SchemaTypes } from '../types/index.js';
import FieldBuilder from './builder.js';

export default class InterfaceFieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
> extends FieldBuilder<Types, ParentShape, 'Interface'> {
  constructor(name: string, builder: GiraphQLSchemaTypes.SchemaBuilder<Types>) {
    super(name, builder, 'Interface', 'Interface');
  }
}
