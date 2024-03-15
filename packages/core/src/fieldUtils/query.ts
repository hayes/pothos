import { FieldMode, SchemaTypes } from '../types';
import { RootFieldBuilder } from './root';

export class QueryFieldBuilder<
  Types extends SchemaTypes,
  Mode extends FieldMode = Types['FieldMode'],
> extends RootFieldBuilder<Types, Types['Root'], 'Query', Mode> {
  constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>, mode: Mode) {
    super({ builder, kind: 'Query', graphqlKind: 'Object', mode });
  }
}
