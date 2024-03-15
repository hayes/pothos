import { FieldMode, SchemaTypes } from '../types';
import { FieldBuilder } from './builder';

export class InterfaceFieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
  Mode extends FieldMode = Types['FieldMode'],
> extends FieldBuilder<Types, ParentShape, 'Interface', Mode> {
  constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>, mode: Mode) {
    super({ builder, kind: 'Interface', graphqlKind: 'Interface', mode });
  }
}
