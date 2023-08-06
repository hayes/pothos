/* eslint-disable max-classes-per-file */
import { GraphQLScalarType } from 'graphql';
import * as ts from 'typescript';
import type { GeneratorSchema } from './schema';
import { TypeGenerator } from './type';
import { parse } from './utils';

export abstract class ScalarGenerator extends TypeGenerator {
  override type: GraphQLScalarType;

  constructor(schema: GeneratorSchema, type: GraphQLScalarType) {
    super(schema, type);
    this.type = type;
  }

  generateReference(): ts.Expression {
    return ts.factory.createStringLiteral(this.type.name);
  }
}

export class BuiltInScalarGenerator extends ScalarGenerator {
  generate(): ts.Statement[] {
    return [];
  }
}

export class CustomScalarGenerator extends ScalarGenerator {
  generate(): ts.Statement[] {
    return parse`
        builder.scalarType('${this.type.name}', {});
    `;
  }
}

export class ExternalScalarGenerator extends ScalarGenerator {
  generate(): ts.Statement[] {
    return parse`
          builder.addScalarType('${this.type.name}', ${this.type.name}Resolver, {});
      `;
  }
}
