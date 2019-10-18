import { GraphQLUnionType, GraphQLType } from 'graphql';
import { TypeMap, UnionOptions, NamedTypeParam } from './types';
import BaseType from './base';

export default class UnionType<
  Types extends TypeMap,
  Context,
  Name extends NamedTypeParam<Types>,
  Member extends NamedTypeParam<Types>
> extends BaseType<Types[Member], Name> {
  kind: 'Union' = 'Union';

  description?: string;

  constructor(name: Name, options: UnionOptions<Types, Context, Member>) {
    super(name);

    this.description = options.description;
  }

  buildType(typeMap: Map<string, GraphQLType>) {
    return new GraphQLUnionType({
      name: this.typename,
      description: this.description,
      types: [],
    });
  }
}
