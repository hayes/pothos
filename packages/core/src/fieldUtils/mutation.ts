import { SchemaTypes } from '../types';
import RootFieldBuilder from './root';

export default class MutationFieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
> extends RootFieldBuilder<Types, ParentShape, 'Mutation'> {
  constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>) {
    super('Mutation', builder, 'Mutation', 'Object');
  }
}
