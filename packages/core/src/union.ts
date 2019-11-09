import { GraphQLUnionType } from 'graphql';
import { NamedTypeParam } from './types';
import BaseType from './base';
import TypeStore from './store';

export default class UnionType<
  Types extends GiraphSchemaTypes.TypeInfo,
  Name extends string,
  Member extends NamedTypeParam<Types>
> extends BaseType<Types, Name, Types['Output'][Member]> {
  kind: 'Union' = 'Union';

  description?: string;

  members: Member[];

  resolveType: (parent: unknown, ctx: unknown) => string;

  constructor(name: Name, options: GiraphSchemaTypes.UnionOptions<Types, Member>) {
    super(name);

    this.members = options.members;

    this.description = options.description;

    this.resolveType = options.resolveType as (parent: unknown, ctx: unknown) => string;
  }

  buildType(store: TypeStore<Types>) {
    return new GraphQLUnionType({
      name: this.typename,
      description: this.description,
      resolveType: this.resolveType,
      types: () => this.members.map(member => store.getBuiltObject(member)),
    });
  }
}
