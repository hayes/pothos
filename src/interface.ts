import { GraphQLInterfaceType } from 'graphql';
import fromEntries from 'object.fromentries';
import BaseType from './base';
import {
  TypeMap,
  ShapeFromTypeParam,
  InterfaceTypeOptions,
  NamedTypeParam,
  TypeParam,
} from './types';
import TypeStore from './store';
import Field from './field';
import FieldBuilder from './fieldUtils/builder';

export default class InterfaceType<
  Shape extends {},
  Types extends TypeMap,
  Name extends NamedTypeParam<Types>,
  Context = {}
> extends BaseType<Types, Name, ShapeFromTypeParam<Types, Name, true>> {
  kind: 'Interface' = 'Interface';

  description?: string;

  fields: Shape;

  constructor(name: Name, options: InterfaceTypeOptions<Shape, Types, Name, Context>) {
    super(name);

    this.description = options.description;

    this.fields = options.shape(new FieldBuilder({}));
  }

  buildType(store: TypeStore<Types>) {
    return new GraphQLInterfaceType({
      name: this.typename,
      description: this.description,
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
