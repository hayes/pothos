import { GraphQLUnionType } from 'graphql';
import { TypeMap, UnionOptions, NamedTypeParam } from './types';
import BaseType from './base';
import TypeStore from './store';

export default class UnionType<
  Types extends TypeMap,
  Context,
  Name extends string,
  Member extends NamedTypeParam<Types>
> extends BaseType<Types, Name, Types[Member]> {
  kind: 'Union' = 'Union';

  description?: string;

  members: Member[];

  constructor(name: Name, options: UnionOptions<Types, Context, Member>) {
    super(name);

    this.members = options.members;

    this.description = options.description;
  }

  buildType(store: TypeStore<Types>) {
    return new GraphQLUnionType({
      name: this.typename,
      description: this.description,
      types: () => this.members.map(member => store.getBuiltObject(member)),
    });
  }
}
