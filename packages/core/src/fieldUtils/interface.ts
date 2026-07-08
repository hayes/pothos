import type { SchemaTypes } from '../types/index.js';
import { FieldBuilder } from './builder.js';

export class InterfaceFieldBuilder<Types extends SchemaTypes, ParentShape> extends FieldBuilder<
  Types,
  ParentShape,
  'Interface'
> {
  constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>) {
    super(builder, 'Interface', 'Interface');
  }
}
