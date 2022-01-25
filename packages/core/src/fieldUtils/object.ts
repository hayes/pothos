import { SchemaTypes } from '../types';
import FieldBuilder from './builder';

export default class ObjectFieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
> extends FieldBuilder<Types, ParentShape, 'Object'> {
  constructor(name: string, builder: PothosSchemaTypes.SchemaBuilder<Types>) {
    super(name, builder, 'Object', 'Object');
  }
}
