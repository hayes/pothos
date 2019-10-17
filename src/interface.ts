import { GraphQLInterfaceType, GraphQLType } from 'graphql';
import BaseType from './base';
import { TypeMap, TypeParam, ShapeFromTypeParam, InterfaceTypeOptions } from './types';

export default class InterfaceType<
  Types extends TypeMap,
  Type extends TypeParam<Types>,
  Shape extends {},
  Context
> extends BaseType<ShapeFromTypeParam<Types, Type, true>> {
  kind: 'Interface' = 'Interface';

  objectShape!: Shape;

  description?: string;

  constructor(name: Type, options: InterfaceTypeOptions<Types, Type, Shape, Context>) {
    super(name as string);

    this.description = options.description;
  }

  buildType(typeMap: Map<string, GraphQLType>) {
    return new GraphQLInterfaceType({
      name: this.typename,
      description: this.description,
      fields: {},
    });
  }
}
