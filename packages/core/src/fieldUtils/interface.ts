import { SchemaTypes } from '../types';
import FieldBuilder from './builder';

export default class InterfaceFieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
> extends FieldBuilder<Types, ParentShape, 'Interface'> {
  constructor(name: string, builder: GiraphQLSchemaTypes.SchemaBuilder<Types>) {
    super(name, builder, 'Interface', 'Interface');
  }
}
