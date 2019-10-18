import { GraphQLObjectType } from 'graphql';
import BaseType from './base';
import {
  TypeMap,
  ShapeFromTypeParam,
  ObjectTypeOptions,
  CompatibleInterfaceNames,
  NamedTypeParam,
  TypeParam,
  UnionToIntersection,
} from './types';
import InterfaceType from './interface';
import TypeStore from './store';
import Field from './field';
import FieldBuilder from './fieldUtils.ts/builder';

export default class ObjectType<
  Shape extends {},
  Interfaces extends InterfaceType<
    {},
    Types,
    CompatibleInterfaceNames<Types, ShapeFromTypeParam<Types, Name, true>>,
    {}
  >[],
  Types extends TypeMap,
  Name extends NamedTypeParam<Types>,
  Context
> extends BaseType<Types, Name, ShapeFromTypeParam<Types, Name, true>> {
  kind: 'Object' = 'Object';

  description?: string;

  interfaces: Interfaces;

  fields: Shape;

  constructor(name: Name, options: ObjectTypeOptions<Shape, Interfaces, Types, Name, Context>) {
    super(name);

    this.description = options.description;
    this.interfaces = options.implements || (([] as unknown) as Interfaces);

    const parentFields = this.interfaces
      .map(i => i.fields)
      .reduce((fields, all) => ({ ...fields, ...all }), {}) as UnionToIntersection<
      Interfaces[number]['fields']
    > & {};

    this.fields = options.shape(new FieldBuilder(parentFields));
  }

  buildType(store: TypeStore<Types>) {
    return new GraphQLObjectType({
      name: this.typename,
      description: this.description,
      fields: () =>
        Object.fromEntries(
          Object.entries(this.fields).map(([key, field]) => [
            key,
            (field as Field<{}, Types, TypeParam<Types>, TypeParam<Types>>).build(key, store),
          ]),
        ),
    });
  }
}
