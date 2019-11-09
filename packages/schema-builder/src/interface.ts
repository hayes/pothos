import { GraphQLInterfaceType } from 'graphql';
import fromEntries from 'object.fromentries';
import BaseType from './base';
import { ShapeFromTypeParam, InterfaceTypeOptions, NamedTypeParam, TypeParam } from './types';
import TypeStore from './store';
import Field from './field';
import FieldBuilder from './fieldUtils/builder';
import ObjectType from './object';

export default class InterfaceType<
  Shape extends {},
  Types extends SpiderSchemaTypes.TypeInfo,
  Name extends NamedTypeParam<Types>
> extends BaseType<Types, Name, ShapeFromTypeParam<Types, Name, true>> {
  kind: 'Interface' = 'Interface';

  description?: string;

  fields: Shape;

  constructor(name: Name, options: InterfaceTypeOptions<Shape, Types, Name>) {
    super(name);

    this.description = options.description;

    this.fields = options.shape(new FieldBuilder({}, this.typename));
  }

  buildType(store: TypeStore<Types>) {
    let types: ObjectType<{}, any, Types, NamedTypeParam<Types>>[];

    return new GraphQLInterfaceType({
      name: String(this.typename),
      description: this.description,
      resolveType: (obj: unknown) => {
        if (!types) {
          types = store.getImplementers(this);
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
          Object.entries(this.fields).map(([key, field]) => [
            key,
            (field as Field<{}, Types, TypeParam<Types>, TypeParam<Types>>).build(key, store),
          ]),
        ),
    });
  }
}
