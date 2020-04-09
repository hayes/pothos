import RootFieldBuilder from './root';

export default class MutationFieldBuilder<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  ParentShape
> extends RootFieldBuilder<Types, ParentShape, 'Mutation'> {
  constructor() {
    super('Mutation');
  }
}
