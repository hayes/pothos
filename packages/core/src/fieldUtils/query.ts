import { SchemaTypes } from '../types/index.js';
import RootFieldBuilder from './root.js';

export default class QueryFieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
> extends RootFieldBuilder<Types, ParentShape, 'Query'> {
  constructor(builder: GiraphQLSchemaTypes.SchemaBuilder<Types>) {
    super('Query', builder, 'Query', 'Object');
  }
}
