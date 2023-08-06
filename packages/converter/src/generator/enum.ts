import { GraphQLEnumType, GraphQLEnumValue } from 'graphql';
import * as ts from 'typescript';
import type { GeneratorSchema } from './schema';
import { TypeGenerator } from './type';
import {
  parse,
  printDeprecation,
  printDescription,
  printExpression,
  printLiteralValue,
} from './utils';

export class EnumTypeGenerator extends TypeGenerator {
  override type: GraphQLEnumType;

  constructor(schema: GeneratorSchema, type: GraphQLEnumType) {
    super(schema, type);
    this.type = type;
  }
  generate() {
    return parse`
        const ${this.type.name} = builder.enumType('${this.type.name}', {
            ${printDescription(this.type)}
            values: ${printExpression(this.generateValues())}} as const,
        });`;
  }

  generateValues() {
    return mapEnumValues(
      this.type,
      (value) =>
        parse`({
            ${printDeprecation(value)}
            ${printDescription(value)}
            value: ${printLiteralValue(value.value ?? value.name)},
          })`,
    );
  }

  generateReference() {
    return ts.factory.createIdentifier(this.type.name);
  }
}

export function mapEnumValues(
  type: GraphQLEnumType,
  mapper: (value: GraphQLEnumValue) => ts.Statement[] | null,
) {
  const fieldProps = type
    .getValues()
    .map((value) => [value.name, mapper(value)] as const)
    .filter(([name, field]) => field)
    .map(([name, node]) => {
      if (!node) {
        throw new Error('Expected node');
      }

      if (!ts.isExpressionStatement(node[0])) {
        throw new Error('Expected expression statement');
      }

      return ts.factory.createPropertyAssignment(name, node[0].expression);
    });

  return ts.factory.createObjectLiteralExpression(fieldProps, true);
}
