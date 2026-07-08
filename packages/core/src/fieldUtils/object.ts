import type { SchemaTypes } from '../types/index.js';
import { FieldBuilder } from './builder.js';

export class ObjectFieldBuilder<Types extends SchemaTypes, ParentShape> extends FieldBuilder<
  Types,
  ParentShape,
  'Object'
> {
  constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>) {
    super(builder, 'Object', 'Object');
  }
}
