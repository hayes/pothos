import { GraphQLUnionType, GraphQLResolveInfo } from 'graphql';
import BaseType from './base';
import BuildCache from '../build-cache';
import { ObjectName } from '../types';
import { ResolveValueWrapper, BasePlugin } from '../plugins';

export default class UnionType<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Member extends ObjectName<Types>
> extends BaseType<Types['Object'][Member]> {
  kind: 'Union' = 'Union';

  description?: string;

  members: string[];

  options: GiraphQLSchemaTypes.UnionOptions<any, any>;

  constructor(name: string, options: GiraphQLSchemaTypes.UnionOptions<Types, Member>) {
    super(name);

    this.members = options.members;

    this.description = options.description;

    this.options = options;
  }

  resolveType = (parent: unknown, ctx: unknown, info: GraphQLResolveInfo) => {
    const obj = parent instanceof ResolveValueWrapper ? parent.value : parent;

    return this.options.resolveType(obj, ctx, info);
  };

  buildType(cache: BuildCache, plugin: Required<BasePlugin>) {
    return new GraphQLUnionType({
      name: this.typename,
      description: this.description,
      resolveType: async (parent: unknown, context: object, info: GraphQLResolveInfo) => {
        const obj = parent instanceof ResolveValueWrapper ? parent.value : parent;
        const typename = await this.options.resolveType(obj, context, info);

        await plugin.onUnionResolveType(typename, ResolveValueWrapper.wrap(parent), context, info);

        return typename;
      },
      types: () => this.members.map(member => cache.getBuiltObject(member)),
      extensions: this.options.extensions,
    });
  }
}
