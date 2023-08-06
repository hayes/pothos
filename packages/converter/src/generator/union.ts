import { GraphQLUnionType } from 'graphql';
import * as ts from 'typescript';
import type { GeneratorSchema } from './schema';
import { TypeGenerator } from './type';
import { parse, printDescription } from './utils';

export class UnionTypeGenerator extends TypeGenerator {
  override type: GraphQLUnionType;

  constructor(schema: GeneratorSchema, type: GraphQLUnionType) {
    super(schema, type);
    this.type = type;
  }

  generate() {
    return parse`
        const ${this.type.name} = builder.unionType('${this.type.name}', {
            ${printDescription(this.type)}
            types: [${this.type
              .getTypes()
              .map((type) => this.schema.generateReference(type.name))}],
        });
    `;
  }

  generateReference() {
    return ts.factory.createIdentifier(this.type.name);
  }
}
