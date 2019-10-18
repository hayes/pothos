import { GraphQLInterfaceType, GraphQLType } from 'graphql';
import BaseType from './base';
import { TypeMap, TypeParam, ShapeFromTypeParam, InterfaceTypeOptions } from './types';

export default class InterfaceType<
  Shape extends {},
  Types extends TypeMap,
  Type extends TypeParam<Types>,
  Context = {}
> extends BaseType<ShapeFromTypeParam<Types, Type, true>> {
  kind: 'Interface' = 'Interface';

  description?: string;

  fields!: Shape;

  constructor(name: Type, options: InterfaceTypeOptions<Shape, Types, Type, Context>) {
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
