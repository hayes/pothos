import { GraphQLNamedType } from 'graphql';
import * as ts from 'typescript';
import type { GeneratorSchema } from './schema';

export abstract class TypeGenerator {
  schema: GeneratorSchema;
  type: GraphQLNamedType;

  constructor(schema: GeneratorSchema, type: GraphQLNamedType) {
    this.schema = schema;
    this.type = type;
  }
  generateTypeReference(): ts.TypeNode {
    throw new Error('Generating a type reference is not supported for this type');
  }

  abstract generate(): ts.Statement[];
  abstract generateReference(): ts.Expression;
}
