import { GraphQLUnionType } from 'graphql';
import { NamedTypeParam } from '../types';
import BaseType from './base';
import BuildCache from '../build-cache';

export default class UnionType<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Name extends string,
  Member extends NamedTypeParam<Types>
> extends BaseType<Types, Name, Types['Output'][Member]> {
  kind: 'Union' = 'Union';

  description?: string;

  members: Member[];

  resolveType: (parent: unknown, ctx: unknown) => string;

  constructor(name: Name, options: GiraphQLSchemaTypes.UnionOptions<Types, Member>) {
    super(name);

    this.members = options.members;

    this.description = options.description;

    this.resolveType = options.resolveType as (parent: unknown, ctx: unknown) => string;
  }

  buildType(cache: BuildCache<Types>) {
    return new GraphQLUnionType({
      name: this.typename,
      description: this.description,
      resolveType: this.resolveType,
      types: () => this.members.map(member => cache.getBuiltObject(member)),
    });
  }
}
