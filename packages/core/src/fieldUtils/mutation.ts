import type { SchemaTypes } from '../types/index.js';
import { RootFieldBuilder } from './root.js';

export class MutationFieldBuilder<Types extends SchemaTypes, ParentShape> extends RootFieldBuilder<
  Types,
  ParentShape,
  'Mutation'
> {
  constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>) {
    super(builder, 'Mutation', 'Object');
  }
}
