import { SchemaTypes } from '../types';
import { RootFieldBuilder } from './root';

export class MutationFieldBuilder<Types extends SchemaTypes, ParentShape> extends RootFieldBuilder<
  Types,
  ParentShape,
  'Mutation'
> {
  constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>) {
    super(builder, 'Mutation', 'Object');
  }
}
