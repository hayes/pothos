import { GraphQLUnionType } from 'graphql';
import BaseType from './base';
import BuildCache from '../build-cache';
import { ObjectName } from '../types';

export default class UnionType<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Name extends string,
  Member extends ObjectName<Types>
> extends BaseType<Types, Name, Types['Object'][Member]> {
  kind: 'Union' = 'Union';

  description?: string;

  members: Member[];

  resolveType: (parent: unknown, ctx: unknown) => string;

  options: GiraphQLSchemaTypes.UnionOptions<Types, any>;

  constructor(name: Name, options: GiraphQLSchemaTypes.UnionOptions<Types, Member>) {
    super(name);

    this.members = options.members;

    this.description = options.description;

    this.resolveType = options.resolveType as (parent: unknown, ctx: unknown) => string;

    this.options = options;
  }

  buildType(cache: BuildCache<Types>) {
    return new GraphQLUnionType({
      name: this.typename,
      description: this.description,
      resolveType: this.resolveType,
      types: () => this.members.map(member => cache.getBuiltObject(member)),
      extensions: this.options.extensions,
    });
  }
}
