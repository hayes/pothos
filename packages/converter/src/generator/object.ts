/* eslint-disable max-classes-per-file */
import { GraphQLObjectType } from 'graphql';
import * as ts from 'typescript';
import { type GeneratorSchema } from './schema';
import { TypeGenerator } from './type';
import {
  fieldBuilderMethodFromType,
  mapFields,
  parse,
  printDefaultFieldOptions,
  printDescription,
  printExpression,
} from './utils';

export abstract class ObjectGenerator extends TypeGenerator {
  override type: GraphQLObjectType;

  constructor(schema: GeneratorSchema, type: GraphQLObjectType) {
    super(schema, type);
    this.type = type;
  }

  printInterfaces() {
    const interfaces = this.type.getInterfaces();

    if (interfaces.length === 0) {
      return '';
    }

    return `interfaces: ${printExpression(
      ts.factory.createArrayLiteralExpression(
        interfaces.map((i) => this.schema.generateReference(i.name)),
      ),
    )},`;
  }

  generateReference(): ts.Expression {
    return ts.factory.createIdentifier(this.type.name);
  }
}

export class SimpleObjectGenerator extends ObjectGenerator {
  generate(): ts.Statement[] {
    return parse`
        const ${this.type.name} = builder.simpleObject('${this.type.name}', {
            ${printDescription(this.type)}
            fields: (t) => (${printExpression(this.generateFields())})
        });
    `;
  }

  generateFields() {
    return mapFields(this.type, (name, field) => {
      const method = fieldBuilderMethodFromType(field.type);

      return parse`
        t.${fieldBuilderMethodFromType(field.type)}(${printDefaultFieldOptions(field, {
          method,
          schema: this.schema,
        })})
      `[0];
    });
  }
}
