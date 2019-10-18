import { GraphQLObjectType, GraphQLType } from 'graphql';
import BaseType from './base';
import {
  TypeMap,
  ShapeFromTypeParam,
  ObjectTypeOptions,
  CompatibleInterfaceNames,
  NamedTypeParam,
} from './types';
import InterfaceType from './interface';

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
> extends BaseType<ShapeFromTypeParam<Types, Name, true>, Name> {
  kind: 'Object' = 'Object';

  description?: string;

  constructor(name: Name, options: ObjectTypeOptions<Shape, Interfaces, Types, Name, Context>) {
    super(name);

    this.description = options.description;
  }

  buildType(typeMap: Map<string, GraphQLType>) {
    return new GraphQLObjectType({
      name: this.typename,
      description: this.description,
      fields: {},
    });
  }
}
