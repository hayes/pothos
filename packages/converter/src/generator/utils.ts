import {
  getNamedType,
  GraphQLArgument,
  GraphQLEnumValue,
  GraphQLField,
  GraphQLInputField,
  GraphQLInterfaceType,
  GraphQLNamedType,
  GraphQLObjectType,
  GraphQLType,
  isListType,
  isNonNullType,
} from 'graphql';
import * as ts from 'typescript';
import type { GeneratorSchema } from './schema';

export function printStatements(statements: ts.Statement[]) {
  const nodes = ts.factory.createNodeArray(statements);
  const printer = ts.createPrinter({});
  const sourcefile = ts.createSourceFile(
    'file.ts',
    '',
    ts.ScriptTarget.ESNext,
    false,
    ts.ScriptKind.TS,
  );

  return printer.printList(ts.ListFormat.SourceFileStatements, nodes, sourcefile);
}

export function parse(strings: TemplateStringsArray, ...values: unknown[]) {
  const source = strings.reduce(
    (acc, str, i) => `${acc}${str}${i < values.length ? String(values[i]) : ''}`,
    '',
  );

  const lines = source.replace(/^\s/m, '').split('\n');
  const firstLine = lines[0];
  const indent = firstLine.match(/^\s*/)?.[0] ?? '';
  const unIndented = lines.map((line) => line.replace(indent, '')).join('\n');

  const sourceFile = ts.createSourceFile('file.ts', unIndented, ts.ScriptTarget.Latest, false);

  return [...sourceFile.statements.values()];
}

export function printExpression(expression: ts.Expression) {
  const statement = ts.factory.createExpressionStatement(expression);

  return printStatements([statement]);
}

export function mapFields(
  type: GraphQLObjectType | GraphQLInterfaceType,
  mapper: (name: string, field: GraphQLField<unknown, unknown>) => ts.Statement | null,
) {
  const fieldProps = Object.entries(type.getFields())
    .map(([name, field]) => [name, mapper(name, field)] as const)
    .filter(([name, field]) => field)
    .map(([name, node]) => {
      if (!node) {
        throw new Error('Expected node');
      }

      if (!ts.isExpressionStatement(node)) {
        throw new Error('Expected expression statement');
      }

      return ts.factory.createPropertyAssignment(name, node.expression);
    });

  return ts.factory.createObjectLiteralExpression(fieldProps, true);
}

export function mapInputFields<T extends GraphQLInputField | GraphQLArgument>(
  fields: readonly T[],
  mapper: (field: T) => ts.Statement | null,
) {
  const fieldProps = fields
    .map((field) => [field.name, mapper(field)] as const)
    .filter(([name, field]) => field)
    .map(([name, node]) => {
      if (!node) {
        throw new Error('Expected node');
      }

      if (!ts.isExpressionStatement(node)) {
        throw new Error('Expected expression statement');
      }

      return ts.factory.createPropertyAssignment(name, node.expression);
    });

  return ts.factory.createObjectLiteralExpression(fieldProps, true);
}

export function capitalize(str: string) {
  return str[0].toUpperCase() + str.slice(1);
}

export function fieldBuilderMethodFromType(
  type: GraphQLType,
  { expose }: { expose?: boolean } = {},
) {
  const isList = isListType(isNonNullType(type) ? type.ofType : type);
  const named = getNamedType(type);

  let method;
  switch (named.name) {
    case 'String':
      method = 'string';
      break;
    case 'Int':
      method = 'int';
      break;
    case 'Float':
      method = 'float';
      break;
    case 'Boolean':
      method = 'boolean';
      break;
    case 'ID':
      method = 'id';
      break;
    default:
      method = 'field';
  }

  if (isList && method !== 'field') {
    method = `${method}List`;
  }

  if (expose) {
    return method === 'field' ? 'expose' : `expose${capitalize(method)}`;
  }

  return method;
}

export function generateNullable(type: GraphQLType) {
  const isNonNullable = isNonNullType(type);
  const nullable = isNonNullable ? type.ofType : type;
  const isList = isListType(nullable);
  const itemsNonNullable = isList ? isNonNullType(nullable.ofType) : false;

  if (isList) {
    return ts.factory.createObjectLiteralExpression([
      ts.factory.createPropertyAssignment(
        'list',
        nullable ? ts.factory.createTrue() : ts.factory.createFalse(),
      ),
      ts.factory.createPropertyAssignment(
        'items',
        itemsNonNullable ? ts.factory.createFalse() : ts.factory.createTrue(),
      ),
    ]);
  }

  return nullable ? ts.factory.createTrue() : ts.factory.createFalse();
}

export function generateRequired(type: GraphQLType) {
  const isNonNullable = isNonNullType(type);
  const nullable = isNonNullable ? type.ofType : type;
  const isList = isListType(nullable);
  const itemsNonNullable = isList ? isNonNullType(nullable.ofType) : false;

  if (isList) {
    return ts.factory.createObjectLiteralExpression([
      ts.factory.createPropertyAssignment(
        'list',
        nullable ? ts.factory.createFalse() : ts.factory.createTrue(),
      ),
      ts.factory.createPropertyAssignment(
        'items',
        itemsNonNullable ? ts.factory.createTrue() : ts.factory.createFalse(),
      ),
    ]);
  }

  return nullable ? ts.factory.createFalse() : ts.factory.createTrue();
}

export function printDescription(
  type:
    | GraphQLNamedType
    | GraphQLField<unknown, unknown>
    | GraphQLEnumValue
    | GraphQLInputField
    | GraphQLArgument,
) {
  if (!type.description) {
    return '';
  }

  return `description: \`${type.description}\`,`;
}

export function printDeprecation(
  type: GraphQLField<unknown, unknown> | GraphQLEnumValue | GraphQLInputField | GraphQLArgument,
) {
  if (!type.deprecationReason) {
    return '';
  }

  return `deprecationReason: \`${type.deprecationReason}\`,`;
}

export function printDefaultFieldOptions(
  field: GraphQLField<unknown, unknown>,
  {
    schema,
    method,
  }: {
    schema: GeneratorSchema;
    method: string;
  },
) {
  const isList = isListType(isNonNullType(field.type) ? field.type.ofType : field.type);

  return `{
    ${
      method === 'field'
        ? `type: ${
            isList
              ? `[${printExpression(schema.generateReference(getNamedType(field.type).name))}]`
              : printExpression(schema.generateReference(getNamedType(field.type).name))
          },`
        : ''
    }
    nullable: ${printExpression(generateNullable(field.type))},
    ${printDefaultFieldArgs(field, { schema })}
    ${printDeprecation(field)}
    ${printDescription(field)}
  }`;
}

export function printDefaultFieldArgs(
  field: GraphQLField<unknown, unknown>,
  {
    schema,
  }: {
    schema: GeneratorSchema;
  },
) {
  if (field.args.length === 0) {
    return '';
  }

  const args = mapInputFields(field.args, (arg) => {
    const rawMethod = fieldBuilderMethodFromType(arg.type);
    const method = rawMethod === 'field' ? 'arg' : `arg.${rawMethod}`;

    return parse`
      t.${method}(${printDefaultInputFieldOptions(arg, {
        method,
        schema,
      })})
    `[0];
  });

  return `args: ${printExpression(args)},`;
}

export function printDefaultInputFieldOptions(
  field: GraphQLInputField | GraphQLArgument,
  {
    schema,
    method,
  }: {
    schema: GeneratorSchema;
    method: string;
  },
) {
  const isList = isListType(isNonNullType(field.type) ? field.type.ofType : field.type);

  return `{
    ${
      method === 'arg'
        ? `type: ${
            isList
              ? `[${printExpression(schema.generateReference(getNamedType(field.type).name))}]`
              : printExpression(schema.generateReference(getNamedType(field.type).name))
          },`
        : ''
    }
    required: ${printExpression(generateRequired(field.type))},
    ${printDeprecation(field)}
    ${printDescription(field)}
  }`;
}

export function printLiteralValue(value: unknown) {
  return printExpression(generateLiteralValue(value));
}

export function generateLiteralValue(value: unknown): ts.Expression {
  switch (typeof value) {
    case 'string':
      return ts.factory.createStringLiteral(value);
    case 'number':
      return ts.factory.createNumericLiteral(String(value));
    case 'boolean':
      return value ? ts.factory.createTrue() : ts.factory.createFalse();
    case 'object':
      if (value === null) {
        return ts.factory.createNull();
      }

      if (Array.isArray(value)) {
        return ts.factory.createArrayLiteralExpression(
          value.map((item) => generateLiteralValue(item)),
        );
      }

      return ts.factory.createObjectLiteralExpression(
        Object.entries(value).map(([key, prop]) =>
          ts.factory.createPropertyAssignment(key, generateLiteralValue(prop)),
        ),
      );

    default:
      throw new Error(`Unsupported literal value: ${value}`);
  }
}
