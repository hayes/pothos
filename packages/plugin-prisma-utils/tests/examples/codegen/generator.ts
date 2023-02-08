import ts from 'typescript';
import * as Prisma from '../../client';

const filterOps = ['equals', 'in', 'notIn', 'not', 'is', 'isNot'] as const;
const sortableFilterProps = ['lt', 'lte', 'gt', 'gte'] as const;
const stringFilterOps = [...filterOps, 'contains', 'startsWith', 'endsWith'] as const;
const sortableTypes = ['String', 'Int', 'Float', 'DateTime', 'BigInt'] as const;
const listOps = ['every', 'some', 'none'] as const;

const dmmf = Prisma.Prisma.dmmf;

class PrismaGenerator {
  statements: ts.Statement[] = [];
  addedTypes: Set<string> = new Set();

  addPrismaFilter(type: string) {
    const name = `${type}Filter`;

    if (this.addedTypes.has(name)) {
      return name;
    }
    const ops: string[] = [...filterOps];

    if (type === 'String') {
      ops.push(...stringFilterOps);
    }

    if (sortableTypes.includes(type as never)) {
      ops.push(...sortableFilterProps);
    }

    this.statements.push(
      ...parse/* ts */ `
      const ${name} = builder.prismaFilter('${type}', {
        name: '${name}',
        ops: [${ops.map((op) => `'${op}'`).join(', ')}],
      });
    `,
    );

    return name;
  }

  addPrismaListFilter(type: string) {
    const name = `${type}ListFilter`;

    if (this.addedTypes.has(name)) {
      return name;
    }

    const filter = this.addPrismaFilter(type);

    const ops: string[] = [...listOps];

    this.statements.push(
      ...parse/* ts */ `
      const ${name} = builder.prismaListFilter(${filter}, {
        name: '${name}',
        ops: [${ops.map((op) => `'${op}'`).join(', ')}],
      });
    `,
    );

    return name;
  }

  addEnum(name: string) {
    if (this.addedTypes.has(name)) {
      return name;
    }

    this.statements.push(
      ...parse/* ts */ `
      builder.enumType(Prisma.${name}, {
        name: '${name}',
      });
    `,
    );

    return name;
  }
}

const generator = new PrismaGenerator();

generator.addPrismaListFilter('String');
generator.addEnum('Role');

console.log(printStatements(generator.statements));

function updateOptionNode(
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

function printStatements(statements: ts.Statement[]) {
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

function parse(strings: TemplateStringsArray, ...values: unknown[]) {
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
