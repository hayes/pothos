import type { SchemaTypes } from '../types/index.js';
import { RootFieldBuilder } from './root.js';

export class QueryFieldBuilder<Types extends SchemaTypes, ParentShape> extends RootFieldBuilder<
  Types,
  ParentShape,
  'Query'
> {
  constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>) {
    super(builder, 'Query', 'Object');
  }
}
