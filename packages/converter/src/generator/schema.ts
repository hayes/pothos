import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLNamedType,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLUnionType,
} from 'graphql';
import * as ts from 'typescript';
import { EnumTypeGenerator } from './enum';
import { InputObjectGenerator } from './input';
import { SimpleInterfaceGenerator } from './interface';
import { SimpleObjectGenerator } from './object';
import { BuiltInScalarGenerator, CustomScalarGenerator } from './scalar';
import { TypeGenerator } from './type';
import { UnionTypeGenerator } from './union';
import { printStatements } from './utils';

export class GeneratorSchema {
  schema: GraphQLSchema;
  typeGenerators: Map<string, TypeGenerator> = new Map();

  constructor(schema: GraphQLSchema) {
    this.schema = schema;
  }

  static fromSchema(schema: GraphQLSchema) {
    const generatorSchema = new GeneratorSchema(schema);

    for (const type of Object.values(schema.getTypeMap())) {
      if (type.name.startsWith('__')) {
        // eslint-disable-next-line no-continue
        continue;
      }

      generatorSchema.typeGenerators.set(type.name, defaultGeneratorForType(type, generatorSchema));
    }

    return generatorSchema;
  }

  generateReference(name: string): ts.Expression {
    const generator = this.typeGenerators.get(name);

    if (!generator) {
      throw new Error(`No generator for ${name}`);
    }

    return generator.generateReference();
  }

  generateTypeReference(name: string): ts.TypeNode {
    const generator = this.typeGenerators.get(name);

    if (!generator) {
      throw new Error(`No generator for ${name}`);
    }

    return generator.generateTypeReference();
  }

  print() {
    const statements = [...this.typeGenerators.values()].flatMap((generator) =>
      generator.generate(),
    );

    return printStatements(statements);
  }
}

function defaultGeneratorForType(type: GraphQLNamedType, schema: GeneratorSchema) {
  if (type instanceof GraphQLEnumType) {
    return new EnumTypeGenerator(schema, type);
  }

  if (type instanceof GraphQLInputObjectType) {
    return new InputObjectGenerator(schema, type);
  }

  if (type instanceof GraphQLInterfaceType) {
    return new SimpleInterfaceGenerator(schema, type);
  }

  if (type instanceof GraphQLObjectType) {
    return new SimpleObjectGenerator(schema, type);
  }

  if (type instanceof GraphQLScalarType) {
    if (['String', 'ID', 'Boolean', 'Int', 'Float'].includes(type.name)) {
      return new BuiltInScalarGenerator(schema, type);
    }

    return new CustomScalarGenerator(schema, type);
  }

  if (type instanceof GraphQLUnionType) {
    return new UnionTypeGenerator(schema, type);
  }

  throw new Error(`No generator for type ${(type as GraphQLNamedType).name}`);
}
