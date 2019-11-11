import { GraphQLScalarType } from 'graphql';
import BaseType from './base';
import { NamedInputAndOutput } from '../types';

export default class ScalarType<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Name extends NamedInputAndOutput<Types>,
  OutputShape extends Types['Output'][Name] = Types['Output'][Name],
  InputShape extends Types['Input'][Name] = Types['Input'][Name]
> extends BaseType<Types, Name, OutputShape, InputShape> {
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
