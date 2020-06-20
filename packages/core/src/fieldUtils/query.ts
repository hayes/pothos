import RootFieldBuilder from './root';
import { SchemaTypes } from '../types';

export default class QueryFieldBuilder<
  Types extends SchemaTypes,
  ParentShape
> extends RootFieldBuilder<Types, ParentShape, 'Query'> {
  constructor(builder: GiraphQLSchemaTypes.SchemaBuilder<Types>) {
    super('Query', builder, 'Query');
  }
}
