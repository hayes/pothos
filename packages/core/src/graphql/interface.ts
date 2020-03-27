import { GraphQLInterfaceType, GraphQLResolveInfo } from 'graphql';
// @ts-ignore
import fromEntries from 'object.fromentries';
import BaseType from './base';
import { InterfaceName } from '../types';
import ObjectType from './object';
import BuildCache from '../build-cache';
import { BasePlugin, ResolveValueWrapper } from '../plugins';

export default class InterfaceType<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Name extends InterfaceName<Types>,
  Shape = Types['Interface'][Name]
> extends BaseType<Shape> {
  kind: 'Interface' = 'Interface';

  description?: string;

  options: GiraphQLSchemaTypes.InterfaceTypeOptions<any, any>;

  constructor(
    name: Name,
    options: GiraphQLSchemaTypes.InterfaceTypeOptions<Types, Types['Interface'][Name]>,
  ) {
    super(name);

    this.description = options.description;

    this.options = options;
  }

  buildType(cache: BuildCache, plugin: Required<BasePlugin>): GraphQLInterfaceType {
    let types: ObjectType<GiraphQLSchemaTypes.TypeInfo>[];

    return new GraphQLInterfaceType({
      name: String(this.typename),
      description: this.description,
      resolveType: async (
        parent: ResolveValueWrapper,
        context: Types['Context'],
        info: GraphQLResolveInfo,
      ) => {
        const obj = parent instanceof ResolveValueWrapper ? parent.value : parent;
        let typename = String(this.typename);

        if (!types) {
          types = cache.getImplementers(this.typename);
        }

        for (const type of types) {
          if (type.options.isType && type.options.isType(obj as never, context, info)) {
            typename = String(type.typename);
            break;
          }
        }

        await plugin.onInterfaceResolveType(typename, parent, context, info);

        return typename;
      },
      fields: () =>
        fromEntries(
          Object.entries(cache.getFields(this.typename)).map(([key, field]) => [
            key,
            field.build(key, cache, plugin),
          ]),
        ),
      extensions: this.options.extensions,
    });
  }
}
