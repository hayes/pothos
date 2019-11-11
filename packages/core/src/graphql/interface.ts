import { GraphQLInterfaceType } from 'graphql';
import fromEntries from 'object.fromentries';
import BaseType from './base';
import { ShapeFromTypeParam, TypeParam, InterfaceName, ObjectName } from '../types';
import Field from '../field';
import FieldBuilder from '../fieldUtils/builder';
import ObjectType from './object';
import BasePlugin from '../plugin';
import BuildCache from '../build-cache';

export default class InterfaceType<
  Shape extends {},
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Name extends InterfaceName<Types>
> extends BaseType<Types, Name, ShapeFromTypeParam<Types, Name, true>> {
  kind: 'Interface' = 'Interface';

  description?: string;

  options: GiraphQLSchemaTypes.InterfaceTypeOptions<{}, Types, any>;

  fieldShape?: Shape;

  constructor(name: Name, options: GiraphQLSchemaTypes.InterfaceTypeOptions<Shape, Types, Name>) {
    super(name);

    this.description = options.description;

    this.options = options;
  }

  getFields() {
    return this.options.shape(new FieldBuilder({}, this.typename));
  }

  buildType(cache: BuildCache<Types>, plugins: BasePlugin<Types>[]): GraphQLInterfaceType {
    let types: ObjectType<{}, any, Types, ObjectName<Types>>[];

    return new GraphQLInterfaceType({
      name: String(this.typename),
      description: this.description,
      resolveType: (obj: unknown) => {
        if (!types) {
          types = cache.getImplementers(this.typename);
        }

        for (const type of types) {
          if (type.isType(obj)) {
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
    });
  }
}
