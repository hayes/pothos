import { GraphQLUnionType, GraphQLType } from 'graphql';
import { TypeMap, UnionOptions } from './types';
import BaseType from './base';

export default class UnionType<
  Types extends TypeMap,
  Context,
  Member extends keyof Types
> extends BaseType<Types[Member]> {
  kind: 'Union' = 'Union';

  description?: string;

  constructor(name: string, options: UnionOptions<Types, Context, Member>) {
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
