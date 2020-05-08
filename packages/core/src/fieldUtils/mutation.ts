import RootFieldBuilder from './root';
import { SchemaTypes } from '../types';

export default class MutationFieldBuilder<
  Types extends SchemaTypes,
  ParentShape
> extends RootFieldBuilder<Types, ParentShape, 'Mutation'> {
  constructor() {
    super('Mutation');
  }
}
