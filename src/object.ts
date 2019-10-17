import { GraphQLObjectType, GraphQLType } from 'graphql';
import BaseType from './base';
import { TypeMap, ShapeFromTypeParam, ObjectTypeOptions, CompatibleInterfaceNames } from './types';
import InterfaceType from './interface';

export default class ObjectType<
  Types extends TypeMap,
  Type extends Extract<keyof Types, string>,
  Shape extends {},
  Context,
  Interfaces extends InterfaceType<
    Types,
    CompatibleInterfaceNames<Types, ShapeFromTypeParam<Types, Type, true>>,
    {},
    {}
  >[]
> extends BaseType<ShapeFromTypeParam<Types, Type, true>> {
  kind: 'Object' = 'Object';

  description?: string;

  constructor(name: Type, options: ObjectTypeOptions<Types, Type, Shape, Context, Interfaces>) {
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
