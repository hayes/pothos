import { FieldMode, SchemaTypes } from '../types';
import { RootFieldBuilder } from './root';

export class SubscriptionFieldBuilder<
  Types extends SchemaTypes,
  Mode extends FieldMode = Types['FieldMode'],
> extends RootFieldBuilder<Types, Types['Root'], 'Subscription', Mode> {
  constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>, mode: Mode) {
    super({ builder, kind: 'Subscription', graphqlKind: 'Object', mode });
  }
}
