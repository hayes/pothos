import { GraphQLObjectType, GraphQLType } from 'graphql';
import BaseType from './base';
import { TypeMap, ShapeFromTypeParam, ObjectTypeOptions, CompatibleInterfaceNames } from './types';
import InterfaceType from './interface';

export default class ObjectType<
  Shape extends {},
  Interfaces extends InterfaceType<
    {},
    Types,
    CompatibleInterfaceNames<Types, ShapeFromTypeParam<Types, Type, true>>,
    {}
  >[],
  Types extends TypeMap,
  Type extends Extract<keyof Types, string>,
  Context
> extends BaseType<ShapeFromTypeParam<Types, Type, true>> {
  kind: 'Object' = 'Object';

  description?: string;

  constructor(name: Type, options: ObjectTypeOptions<Shape, Interfaces, Types, Type, Context>) {
    super(name as string);

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
