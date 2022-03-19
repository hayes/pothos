import { mkdir, writeFile } from 'fs';
import { dirname } from 'path';
import ts, { ListFormat, ScriptKind, ScriptTarget, SyntaxKind } from 'typescript';
import { generatorHandler } from '@prisma/generator-helper';

const ScalarTypes = [
  'String',
  'Boolean',
  'Int',
  'BigInt',
  'Float',
  'Decimal',
  'DateTime',
  'Json',
  'Bytes',
] as const;

generatorHandler({
  onManifest: () => ({
    prettyName: 'CRUD helpers for Pothos',
    defaultOutput: 'node_modules/@pothos/plugin-prisma-crud/generated.ts',
    requiresGenerators: ['prisma-client-js'],
  }),
  onGenerate: async (options) => {
    const config = options.generator.config as { clientOutput?: string };
    const prismaLocation =
      config.clientOutput ??
      options.otherGenerators.find((gen) => gen.provider.value === 'prisma-client-js')!.output!
        .value;

    const importStatement = ts.factory.createImportDeclaration(
      [],
      [],
      ts.factory.createImportClause(
        true,
        undefined,
        ts.factory.createNamedImports([
          ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier('Prisma')),
        ]),
      ),
      ts.factory.createStringLiteral(prismaLocation),
    );

    const includedScalars = ScalarTypes.filter((scalarName) =>
      options.dmmf.schema.inputObjectTypes.prisma.find(
        (input) => input.name === `Nested${scalarName}Filter`,
      ),
    );

    const prismaCrudTypes = [
      ts.factory.createPropertySignature(
        [],
        'ScalarFilters',
        undefined,
        ts.factory.createTypeLiteralNode(
          includedScalars.map((scalarName) =>
            ts.factory.createPropertySignature(
              [],
              scalarName,
              undefined,
              ts.factory.createTypeReferenceNode(`Prisma.Nested${scalarName}Filter`),
            ),
          ),
        ),
      ),
    ];

    const prismaTypes = ts.factory.createInterfaceDeclaration(
      [],
      [
        ts.factory.createModifier(SyntaxKind.ExportKeyword),
        ts.factory.createModifier(SyntaxKind.DefaultKeyword),
      ],
      'PrismaCrudTypes',
      [],
      [],
      prismaCrudTypes,
    );
    const printer = ts.createPrinter({});

    const sourcefile = ts.createSourceFile(
      options.generator.output!.value,
      '',
      ScriptTarget.ESNext,
      false,
      ScriptKind.TS,
    );

    const nodes = ts.factory.createNodeArray([importStatement, prismaTypes]);

    const result = printer.printList(ListFormat.SourceFileStatements, nodes, sourcefile);

    await new Promise<void>((resolve, reject) => {
      mkdir(dirname(sourcefile.fileName), { recursive: true }, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    return new Promise<void>((resolve, reject) => {
      writeFile(sourcefile.fileName, result, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  },
});
