import { GraphQLScalarType } from 'graphql';
import BaseType from './base';
import { ScalarName } from '../types';

export default class ScalarType<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Name extends ScalarName<Types>
> extends BaseType<Types, Name, Types['Scalar'][Name]['Output'], Types['Scalar'][Name]['Input']> {
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
