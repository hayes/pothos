import { GraphQLScalarType } from 'graphql';
import BaseInputType from './base-input';

export default class ScalarType extends BaseInputType {
  kind: 'Scalar' = 'Scalar';

  options: GiraphQLSchemaTypes.ScalarOptions<unknown, unknown>;

  constructor(name: string, options: Omit<GiraphQLSchemaTypes.ScalarOptions, 'name'>) {
    super(name);

    this.options = options;
  }

  buildType() {
    return new GraphQLScalarType({
      name: this.typename,
      description: this.options.description,
      serialize: this.options.serialize,
      parseLiteral: this.options.parseLiteral,
      parseValue: this.options.parseValue,
      extensions: this.options.extensions,
    });
  }
}
