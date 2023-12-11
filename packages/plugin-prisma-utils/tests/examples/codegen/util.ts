import ts from 'typescript';
import { DMMF } from '@prisma/generator-helper';

export function updateOptionNode(
  statement: ts.Node,
  name: string,
  cb: (value: ts.PropertyAssignment) => ts.PropertyAssignment,
) {
  if (!ts.isVariableStatement(statement)) {
    throw new Error(`Unexpected statement kind: ${statement.kind}`);
  }

  const expression = statement.declarationList.declarations[0].initializer;

  if (!expression || !ts.isCallExpression(expression)) {
    throw new Error(`Unable to find call expression for statement kind ${statement.kind}`);
  }

  return ts.factory.updateVariableStatement(
    statement,
    statement.modifiers,
    ts.factory.updateVariableDeclarationList(statement.declarationList, [
      ts.factory.updateVariableDeclaration(
        statement.declarationList.declarations[0],
        statement.declarationList.declarations[0].name,
        statement.declarationList.declarations[0].exclamationToken,
        statement.declarationList.declarations[0].type,
        ts.factory.updateCallExpression(
          expression,
          expression.expression,
          expression.typeArguments,
          expression.arguments.map((arg, i) => {
            if (i !== 1) {
              return arg;
            }

            if (!ts.isObjectLiteralExpression(arg)) {
              throw new Error(`Unexpected options argument kind: ${arg.kind}`);
            }

            return ts.factory.updateObjectLiteralExpression(
              arg,
              arg.properties.map((prop) => {
                if (!ts.isPropertyAssignment(prop)) {
                  return prop;
                }

                if (ts.isIdentifier(prop.name) && prop.name.escapedText === name) {
                  return cb(prop);
                }

                return prop;
              }),
            );
          }),
        ),
      ),
    ]),
  );
}

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

export function printExpression(expression: ts.Expression) {
  const statement = ts.factory.createExpressionStatement(expression);

  return printStatements([statement]);
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

export function capitalize(str: string) {
  return str[0].toUpperCase() + str.slice(1);
}

export function mapFields(model: DMMF.Model, mapper: (field: DMMF.Field) => ts.Statement[] | null) {
  const fieldProps = model.fields
    .map((field) => mapper(field))
    .filter(Boolean)
    .map((node) => {
      if (!node) {
        throw new Error('Expected node');
      }

      if (!ts.isExpressionStatement(node[0])) {
        throw new Error('Expected Expression statement');
      }

      if (!ts.isParenthesizedExpression(node[0].expression)) {
        throw new Error('Expected Parenthesized Expression');
      }

      if (!ts.isObjectLiteralExpression(node[0].expression.expression)) {
        throw new Error('Expected Object Literal Expression');
      }

      return node[0].expression.expression.properties[0];
    });

  return ts.factory.createObjectLiteralExpression(fieldProps, true);
}

export function mapUniqueFields(
  model: DMMF.Model,
  mapper: (field: {
    name: string;
    kind: 'field' | 'id' | 'index';
    type: string;
  }) => ts.Statement[] | null,
) {
  const fields = model.fields
    .filter((field) => field.isUnique || field.isId)
    .map((field) => ({
      name: field.name,
      kind: field.isId ? ('id' as const) : ('field' as const),
      type: field.type,
    }));
  const indexes = model.uniqueIndexes
    .filter((index) => index.fields.length > 1)
    .map((index) => ({
      name: index.name ?? index.fields.join('_'),
      kind: 'index' as const,
      type: model.fields.find((field) => field.name === index.fields[0])!.type,
    }));

  const primaryKeys = (
    model.primaryKey && model.primaryKey.fields.length > 1 ? [model.primaryKey] : []
  ).map((key) => ({
    name: key.name ?? key.fields.join('_'),
    kind: 'id' as const,
    type: model.fields.find((field) => field.name === key.fields[0])!.type,
  }));

  const fieldProps = [...fields, ...indexes, ...primaryKeys]
    .map((field) => mapper(field))
    .filter(Boolean)
    .map((node) => {
      if (!node) {
        throw new Error('Expected node');
      }

      if (!ts.isExpressionStatement(node[0])) {
        throw new Error('Expected Expression statement');
      }

      if (!ts.isParenthesizedExpression(node[0].expression)) {
        throw new Error('Expected Parenthesized Expression');
      }

      if (!ts.isObjectLiteralExpression(node[0].expression.expression)) {
        throw new Error('Expected Object Literal Expression');
      }

      return node[0].expression.expression.properties[0];
    });

  return ts.factory.createObjectLiteralExpression(fieldProps, true);
}
