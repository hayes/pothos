import { GraphQLObjectType } from 'graphql';
import fromEntries from 'object.fromentries';
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
import FieldBuilder from './fieldUtils/builder';

export default class ObjectType<
  Shape extends {},
  Interfaces extends InterfaceType<
    {},
    Types,
    CompatibleInterfaceNames<Types, ShapeFromTypeParam<Types, Name, false>>,
    {}
  >[],
  Types extends TypeMap,
  Name extends NamedTypeParam<Types>,
  Context
> extends BaseType<Types, Name, ShapeFromTypeParam<Types, Name, false>> {
  kind: 'Object' = 'Object';

  description?: string;

  interfaces: Interfaces;

  fields: Shape;

  isType: (obj: unknown) => boolean;

  constructor(name: Name, options: ObjectTypeOptions<Shape, Interfaces, Types, Name, Context>) {
    super(name);

    this.description = options.description;
    this.interfaces = options.implements || (([] as unknown) as Interfaces);

    this.isType = (options as ({ isType: (obj: unknown) => boolean })).isType || (() => false);

    const parentFields = this.interfaces
      .map(i => i.fields)
      .reduce((fields, all) => ({ ...fields, ...all }), {}) as UnionToIntersection<
      Interfaces[number]['fields']
    > & {};

    this.fields = {
      ...(parentFields as {}),
      ...options.shape(new FieldBuilder(parentFields)),
    };
  }

  buildType(store: TypeStore<Types>): GraphQLObjectType {
    return new GraphQLObjectType({
      name: String(this.typename),
      description: this.description,
      interfaces: () =>
        this.interfaces.map(type => store.getEntryOfType(type.typename, 'Interface').built),
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
