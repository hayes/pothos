import { FieldMode, SchemaTypes } from '../types';
import { FieldBuilder } from './builder';

export class ObjectFieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
  Mode extends FieldMode = Types['FieldMode'],
> extends FieldBuilder<Types, ParentShape, 'Object', Mode> {
  constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>, mode: Mode) {
    super({ builder, kind: 'Object', graphqlKind: 'Object', mode });
  }
}
