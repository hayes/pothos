/* eslint-disable no-nested-ternary */
import { mkdir, writeFile } from 'fs';
import { dirname } from 'path';
import ts, { ListFormat, ScriptKind, ScriptTarget, SyntaxKind } from 'typescript';
import { generatorHandler } from '@prisma/generator-helper';

const ScalarTypes = [
  'String',
  'Bool',
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
          ...options.dmmf.datamodel.models.map((model) =>
            ts.factory.createImportSpecifier(
              false,
              undefined,
              ts.factory.createIdentifier(model.name),
            ),
          ),
        ]),
      ),
      ts.factory.createStringLiteral(prismaLocation),
    );

    const modelTypes = options.dmmf.datamodel.models.map((model) => {
      const relations = model.fields.filter((field) => !!field.relationName);
      const listRelations = model.fields.filter((field) => !!field.relationName && field.isList);

      return ts.factory.createPropertySignature(
        [],
        model.name,
        undefined,

        ts.factory.createTypeLiteralNode([
          ts.factory.createPropertySignature(
            [],
            'Name',
            undefined,
            ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(model.name)),
          ),
          ts.factory.createPropertySignature(
            [],
            'Shape',
            undefined,
            ts.factory.createTypeReferenceNode(model.name),
          ),
          ts.factory.createPropertySignature(
            [],
            'Include',
            undefined,
            relations.length > 0
              ? ts.factory.createTypeReferenceNode(`Prisma.${model.name}Include`)
              : ts.factory.createTypeReferenceNode('never'),
          ),
          ts.factory.createPropertySignature(
            [],
            'Select',
            undefined,
            ts.factory.createTypeReferenceNode(`Prisma.${model.name}Select`),
          ),
          ts.factory.createPropertySignature(
            [],
            'WhereUnique',
            undefined,
            ts.factory.createTypeReferenceNode(`Prisma.${model.name}WhereUniqueInput`),
          ),
          ts.factory.createPropertySignature(
            [],
            'Where',
            undefined,
            ts.factory.createTypeReferenceNode(`Prisma.${model.name}WhereInput`),
          ),
          ts.factory.createPropertySignature(
            [],
            'Fields',
            undefined,
            relations.length > 0
              ? ts.factory.createUnionTypeNode(
                  relations.map((field) =>
                    ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(field.name)),
                  ),
                )
              : ts.factory.createTypeReferenceNode('never'),
          ),
          ts.factory.createPropertySignature(
            [],
            'RelationName',
            undefined,
            relations.length > 0
              ? ts.factory.createUnionTypeNode(
                  relations.map((field) =>
                    ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(field.name)),
                  ),
                )
              : ts.factory.createTypeReferenceNode('never'),
          ),
          ts.factory.createPropertySignature(
            [],
            'ListRelations',
            undefined,
            listRelations.length > 0
              ? ts.factory.createUnionTypeNode(
                  listRelations.map((field) =>
                    ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(field.name)),
                  ),
                )
              : ts.factory.createTypeReferenceNode('never'),
          ),
          ts.factory.createPropertySignature(
            [],
            'Relations',
            undefined,
            ts.factory.createTypeLiteralNode(
              relations.map((field) => {
                const typeName = field.type;

                return ts.factory.createPropertySignature(
                  [],
                  field.name,
                  undefined,
                  ts.factory.createTypeLiteralNode([
                    ts.factory.createPropertySignature(
                      [],
                      'Shape',
                      undefined,
                      field.isList
                        ? ts.factory.createArrayTypeNode(
                            ts.factory.createTypeReferenceNode(typeName),
                          )
                        : field.isRequired
                        ? ts.factory.createTypeReferenceNode(typeName)
                        : ts.factory.createUnionTypeNode([
                            ts.factory.createTypeReferenceNode(typeName),
                            ts.factory.createLiteralTypeNode(ts.factory.createNull()),
                          ]),
                    ),
                    ts.factory.createPropertySignature(
                      [],
                      'Types',
                      undefined,
                      ts.factory.createIndexedAccessTypeNode(
                        ts.factory.createTypeReferenceNode('PrismaTypes'),
                        ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(typeName)),
                      ),
                    ),
                  ]),
                );
              }),
            ),
          ),
        ]),
      );
    });

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
          includedScalars.map((scalar) =>
            ts.factory.createPropertySignature(
              [],
              scalar,
              undefined,
              ts.factory.createTypeReferenceNode(`Prisma.Nested${scalar}Filter`),
            ),
          ),
        ),
      ),
    ];

    const prismaTypes = ts.factory.createInterfaceDeclaration(
      [],
      [ts.factory.createModifier(SyntaxKind.ExportKeyword)],
      'PrismaTypes',
      [],
      [],
      modelTypes,
    );

    const prismaCrudExport = ts.factory.createInterfaceDeclaration(
      [],
      [ts.factory.createModifier(SyntaxKind.ExportKeyword)],
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

    const nodes = ts.factory.createNodeArray([importStatement, prismaTypes, prismaCrudExport]);

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
