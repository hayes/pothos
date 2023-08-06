import {
  getNamedType,
  GraphQLInputObjectType,
  GraphQLInputType,
  GraphQLNamedInputType,
  isListType,
  isNonNullType,
  isScalarType,
} from 'graphql';
import * as ts from 'typescript';
import { type GeneratorSchema } from './schema';
import { TypeGenerator } from './type';
import {
  fieldBuilderMethodFromType,
  mapInputFields,
  parse,
  printDefaultInputFieldOptions,
  printDescription,
  printExpression,
} from './utils';

export class InputObjectGenerator extends TypeGenerator {
  override type: GraphQLInputObjectType;

  constructor(schema: GeneratorSchema, type: GraphQLInputObjectType) {
    super(schema, type);
    this.type = type;
  }

  generate(): ts.Statement[] {
    if (isRecursiveInput(this.type)) {
      const iface = generateInterface(this.schema, this.type);

      const impl = parse`
        const ${this.type.name} = builder.objectRef<${this.type.name}>('${this.type.name}');
        ${this.type.name}.implement({
            ${printDescription(this.type)}
            fields: (t) => (${printExpression(this.generateFields())})
        });
        `;

      return [iface, ...impl];
    }

    return parse`
        const ${this.type.name} = builder.inputObject('${this.type.name}', {
            ${printDescription(this.type)}
            fields: (t) => (${printExpression(this.generateFields())})
        });
    `;
  }

  generateFields() {
    return mapInputFields(Object.values(this.type.getFields()), (field) => {
      const method = fieldBuilderMethodFromType(field.type);

      return parse`
        t.${fieldBuilderMethodFromType(field.type)}(${printDefaultInputFieldOptions(field, {
          method,
          schema: this.schema,
        })})
      `[0];
    });
  }

  generateReference(): ts.Expression {
    return ts.factory.createIdentifier(this.type.name);
  }

  override generateTypeReference(): ts.TypeNode {
    if (isRecursiveInput(this.type)) {
      return ts.factory.createTypeReferenceNode(this.type.name, undefined);
    }

    return ts.factory.createTypeReferenceNode('InputShapeFromRef', [
      ts.factory.createTypeQueryNode(ts.factory.createIdentifier(this.type.name)),
    ]);
  }
}

export function isRecursiveInput(type: GraphQLNamedInputType, seen = new Set<string>()): boolean {
  if (!(type instanceof GraphQLInputObjectType)) {
    return false;
  }

  const fieldMap = type.getFields();
  const fields = Object.keys(fieldMap).map((name) => fieldMap[name]);

  return fields.some((field) => {
    const fieldType = getNamedType(field.type);

    if (fieldType.name === type.name) {
      return true;
    }

    if (seen.has(fieldType.name)) {
      return true;
    }

    seen.add(type.name);
    return isRecursiveInput(fieldType, seen);
  });
}

function generateInterface(schema: GeneratorSchema, type: GraphQLInputObjectType) {
  return ts.factory.createInterfaceDeclaration(
    undefined,
    type.name,
    [],
    [],
    Object.values(type.getFields()).map((field) =>
      ts.factory.createPropertySignature(
        undefined,
        field.name,
        isNonNullType(field.type) ? undefined : ts.factory.createToken(ts.SyntaxKind.QuestionToken),
        generateInputType(schema, field.type),
      ),
    ),
  );
}

function generateInputType(schema: GeneratorSchema, wrappedType: GraphQLInputType): ts.TypeNode {
  const type = getNamedType(wrappedType);

  if (isNonNullType(wrappedType) && isListType(wrappedType.ofType)) {
    return ts.factory.createArrayTypeNode(generateNonNullableInputType(schema, type));
  }

  if (isListType(wrappedType)) {
    return ts.factory.createArrayTypeNode(
      ts.factory.createUnionTypeNode([
        generateInputType(schema, type),
        ts.factory.createLiteralTypeNode(ts.factory.createNull()),
        ts.factory.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword),
      ]),
    );
  }

  if (!isNonNullType(wrappedType)) {
    return ts.factory.createUnionTypeNode([
      generateInputType(schema, type),
      ts.factory.createLiteralTypeNode(ts.factory.createNull()),
      ts.factory.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword),
    ]);
  }

  return generateNonNullableInputType(schema, type);
}

function generateNonNullableInputType(
  schema: GeneratorSchema,
  type: GraphQLNamedInputType,
): ts.TypeNode {
  if (isScalarType(type)) {
    switch (type.name) {
      case 'String':
        return ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
      case 'Int':
        return ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
      case 'Float':
        return ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
      case 'ID':
        return ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
      case 'Boolean':
        return ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword);
      default:
        break;
    }
  }

  return schema.generateTypeReference(type.name);
}
