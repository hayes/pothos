import { GraphQLInterfaceType, GraphQLResolveInfo } from 'graphql';
// @ts-ignore
import fromEntries from 'object.fromentries';
import BaseType from './base';
import { ShapeFromTypeParam, TypeParam, InterfaceName, ObjectName } from '../types';
import Field from './field';
import FieldBuilder from '../fieldUtils/builder';
import ObjectType from './object';
import BasePlugin from '../plugin';
import BuildCache from '../build-cache';

export default class InterfaceType<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Name extends InterfaceName<Types>
> extends BaseType<Types, Name, ShapeFromTypeParam<Types, Name, true>> {
  kind: 'Interface' = 'Interface';

  description?: string;

  options: GiraphQLSchemaTypes.InterfaceTypeOptions<Types, {}>;

  constructor(
    name: Name,
    options: GiraphQLSchemaTypes.InterfaceTypeOptions<
      Types,
      ShapeFromTypeParam<Types, Name, false>
    >,
  ) {
    super(name);

    this.description = options.description;

    this.options = (options as unknown) as GiraphQLSchemaTypes.InterfaceTypeOptions<Types, {}>;
  }

  getFields() {
    return this.options.shape(new FieldBuilder(this.typename));
  }

  buildType(cache: BuildCache<Types>, plugins: BasePlugin<Types>[]): GraphQLInterfaceType {
    let types: ObjectType<any[], Types, ObjectName<Types>>[];

    return new GraphQLInterfaceType({
      name: String(this.typename),
      description: this.description,
      resolveType: (obj: unknown, context: Types['Context'], info: GraphQLResolveInfo) => {
        if (!types) {
          types = cache.getImplementers(this.typename);
        }

        for (const type of types) {
          if (type.options.isType && type.options.isType(obj as any, context, info)) {
            return String(type.typename);
          }
        }

        return String(this.typename);
      },
      fields: () =>
        fromEntries(
          Object.entries(cache.getFields(this.typename)).map(([key, field]) => [
            key,
            (field as Field<{}, Types, TypeParam<Types>, TypeParam<Types>>).build(
              key,
              cache,
              plugins,
            ),
          ]),
        ),
      extensions: this.options.extensions,
    });
  }
}
