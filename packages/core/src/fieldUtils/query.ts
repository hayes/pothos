import { SchemaTypes } from '../types';
import RootFieldBuilder from './root';

export default class QueryFieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
> extends RootFieldBuilder<Types, ParentShape, 'Query'> {
  constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>) {
    super('Query', builder, 'Query', 'Object');
  }
}
