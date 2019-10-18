import { GraphQLInterfaceType, GraphQLType } from 'graphql';
import BaseType from './base';
import { TypeMap, ShapeFromTypeParam, InterfaceTypeOptions, NamedTypeParam } from './types';

export default class InterfaceType<
  Shape extends {},
  Types extends TypeMap,
  Name extends NamedTypeParam<Types>,
  Context = {}
> extends BaseType<ShapeFromTypeParam<Types, Name, true>, Name> {
  kind: 'Interface' = 'Interface';

  description?: string;

  fields!: Shape;

  constructor(name: Name, options: InterfaceTypeOptions<Shape, Types, Name, Context>) {
    super(name);

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
