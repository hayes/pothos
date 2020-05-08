import RootFieldBuilder from './root';
import { SchemaTypes } from '../types';

export default class QueryFieldBuilder<
  Types extends SchemaTypes,
  ParentShape
> extends RootFieldBuilder<Types, ParentShape, 'Query'> {
  constructor() {
    super('Query');
  }
}
