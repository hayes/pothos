import { GraphQLInterfaceType, GraphQLResolveInfo } from 'graphql';
// @ts-ignore
import fromEntries from 'object.fromentries';
import BaseType from './base';
import { InterfaceName, FieldMap } from '../types';
import FieldBuilder from '../fieldUtils/builder';
import ObjectType from './object';
import BasePlugin from '../plugin';
import BuildCache from '../build-cache';

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

  getFields(): FieldMap {
    if (!this.options.shape) {
      return {};
    }

    return this.options.shape(new FieldBuilder(this.typename));
  }

  buildType(cache: BuildCache, plugins: BasePlugin[]): GraphQLInterfaceType {
    let types: ObjectType<GiraphQLSchemaTypes.TypeInfo>[];

    return new GraphQLInterfaceType({
      name: String(this.typename),
      description: this.description,
      resolveType: (obj: unknown, context: Types['Context'], info: GraphQLResolveInfo) => {
        if (!types) {
          types = cache.getImplementers(this.typename);
        }

        for (const type of types) {
          if (type.options.isType && type.options.isType(obj as never, context, info)) {
            return String(type.typename);
          }
        }

        return String(this.typename);
      },
      fields: () =>
        fromEntries(
          Object.entries(cache.getFields(this.typename)).map(([key, field]) => [
            key,
            field.build(key, cache, plugins),
          ]),
        ),
      extensions: this.options.extensions,
    });
  }
}
