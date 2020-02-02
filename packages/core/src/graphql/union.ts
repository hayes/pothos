import { GraphQLUnionType } from 'graphql';
import BaseType from './base';
import BuildCache from '../build-cache';
import { ObjectName } from '../types';

export default class UnionType<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Member extends ObjectName<Types>
> extends BaseType<Types['Object'][Member]> {
  kind: 'Union' = 'Union';

  description?: string;

  members: string[];

  resolveType: (parent: unknown, ctx: unknown, info: unknown) => string;

  options: GiraphQLSchemaTypes.UnionOptions<any, any>;

  constructor(name: string, options: GiraphQLSchemaTypes.UnionOptions<Types, Member>) {
    super(name);

    this.members = options.members;

    this.description = options.description;

    this.resolveType = options.resolveType as (
      parent: unknown,
      ctx: unknown,
      info: unknown,
    ) => string;

    this.options = options;
  }

  buildType(cache: BuildCache) {
    return new GraphQLUnionType({
      name: this.typename,
      description: this.description,
      resolveType: this.resolveType,
      types: () => this.members.map(member => cache.getBuiltObject(member)),
      extensions: this.options.extensions,
    });
  }
}
