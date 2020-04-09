import RootFieldBuilder from './root';

export default class QueryFieldBuilder<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  ParentShape
> extends RootFieldBuilder<Types, ParentShape, 'Query'> {
  constructor() {
    super('Query');
  }
}
