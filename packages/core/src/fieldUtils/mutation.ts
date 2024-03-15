import { FieldMode, SchemaTypes } from '../types';
import { RootFieldBuilder } from './root';

export class MutationFieldBuilder<
  Types extends SchemaTypes,
  Mode extends FieldMode = Types['FieldMode'],
> extends RootFieldBuilder<Types, Types['Root'], 'Mutation', Mode> {
  constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>, mode: Mode) {
    super({ builder, kind: 'Mutation', graphqlKind: 'Object', mode });
  }
}
