import { GraphQLInterfaceType } from 'graphql';
import BaseType from './base';
import { TypeMap, ShapeFromTypeParam, InterfaceTypeOptions, NamedTypeParam } from './types';
import TypeStore from './store';

export default class InterfaceType<
  Shape extends {},
  Types extends TypeMap,
  Name extends NamedTypeParam<Types>,
  Context = {}
> extends BaseType<Types, Name, ShapeFromTypeParam<Types, Name, true>> {
  kind: 'Interface' = 'Interface';

  description?: string;

  fields!: Shape;

  constructor(name: Name, options: InterfaceTypeOptions<Shape, Types, Name, Context>) {
    super(name);

    this.description = options.description;
  }

  buildType(store: TypeStore<Types>) {
    return new GraphQLInterfaceType({
      name: this.typename,
      description: this.description,
      fields: {},
    });
  }
}
