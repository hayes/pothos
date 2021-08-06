import { SchemaTypes } from '../types/index.js';
import RootFieldBuilder from './root.js';

export default class MutationFieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
> extends RootFieldBuilder<Types, ParentShape, 'Mutation'> {
  constructor(builder: GiraphQLSchemaTypes.SchemaBuilder<Types>) {
    super('Mutation', builder, 'Mutation', 'Object');
  }
}
