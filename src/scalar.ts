import { GraphQLScalarType } from 'graphql';
import BaseType from './base';
import { NamedTypeParam, TypeMap } from './types';

export default class ScalarType<
  Types extends TypeMap,
  Name extends NamedTypeParam<Types>,
  Shape
> extends BaseType<Types, Name, Shape> {
  scalar: GraphQLScalarType;

  kind: 'Scalar' = 'Scalar';

  constructor(name: Name, scalar: GraphQLScalarType) {
    super(name);

    this.scalar = scalar;
  }

  buildType() {
    return this.scalar;
  }
}
