import { GraphQLObjectType } from 'graphql';
import BaseType from './base';
import {
  TypeMap,
  ShapeFromTypeParam,
  ObjectTypeOptions,
  CompatibleInterfaceNames,
  NamedTypeParam,
} from './types';
import InterfaceType from './interface';
import TypeStore from './store';

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

  constructor(name: Name, options: ObjectTypeOptions<Shape, Interfaces, Types, Name, Context>) {
    super(name);

    this.description = options.description;
    this.interfaces = options.implements || (([] as unknown) as Interfaces);
  }

  buildType(store: TypeStore<Types>) {
    return new GraphQLObjectType({
      name: this.typename,
      description: this.description,
      fields: {},
    });
  }
}
