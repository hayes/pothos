/* eslint-disable unicorn/prefer-module */
/* eslint-disable no-magic-numbers */
/* eslint-disable no-nested-ternary */
import { mkdir, writeFile } from 'node:fs';
import { dirname, join, resolve as resolvePath, posix } from 'node:path';
import ts, { ListFormat, ScriptKind, ScriptTarget, SyntaxKind, version } from 'typescript';
import { DMMF, generatorHandler } from '@prisma/generator-helper';

const MIN_TS_VERSION = [4, 5, 2];

const versionParts = version.split(/[.-]/g).map((part) => Number.parseInt(part, 10));
const modifiersArg = (versionParts[0] >= 5 ? [] : [[]]) as [];

function checkTSVersion() {
  for (let i = 0; i < 3; i += 1) {
    const part = versionParts[i];
    if (part < MIN_TS_VERSION[i]) {
      throw new Error(
        `@pothos/plugin-prisma requires typescript version >${MIN_TS_VERSION.join('.')}`,
      );
    }

    if (part > MIN_TS_VERSION[i]) {
      return;
    }
  }
}

const defaultOutput = resolvePath(__dirname, '../generated.ts');

generatorHandler({
  onManifest: () => ({
    prettyName: 'Pothos integration',
    requiresGenerators: ['prisma-client-js'],
    defaultOutput,
  }),
  onGenerate: async (options) => {
    checkTSVersion();
    const config = options.generator.config as { clientOutput?: string; prismaUtils?: string };
    const prismaLocation =
      config.clientOutput ??
      options.otherGenerators.find((gen) => gen.provider.value === 'prisma-client-js')!.output!
        .value!;

    const outputLocation = options.generator.output?.value ?? defaultOutput;
    const prismaTypes = buildTypes(options.dmmf, config);

    await generateOutput(options.dmmf, prismaTypes, prismaLocation, outputLocation);

    if (outputLocation === defaultOutput) {
      await generateOutput(
        options.dmmf,
        prismaTypes,
        prismaLocation.startsWith('@') ? prismaLocation : posix.join(prismaLocation, 'index.js'),
        join(outputLocation, '../esm/generated.ts'),
      );
    }
  },
});

async function generateOutput(
  dmmf: DMMF.Document,
  prismaTypes: ts.InterfaceDeclaration,
  prismaLocation: string,
  outputLocation: string,
) {
  const importStatement = ts.factory.createImportDeclaration(
    ...modifiersArg,
    [],
    ts.factory.createImportClause(
      true,
      undefined,
      ts.factory.createNamedImports([
        ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier('Prisma')),
        ...dmmf.datamodel.models.map((model) =>
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

  const printer = ts.createPrinter({});

  const sourcefile = ts.createSourceFile(
    outputLocation,
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
    writeFile(sourcefile.fileName, `/* eslint-disable */\n${result}`, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function buildTypes(dmmf: DMMF.Document, config: { prismaUtils?: string }) {
  function getOrderByTypeName(type: string) {
    const possibleTypes = [
      `${type}OrderByWithRelationInput`,
      `${type}OrderByWithRelationAndSearchRelevanceInput`,
    ];

    const orderBy = dmmf.schema.inputObjectTypes.prisma?.find((inputType) =>
      possibleTypes.includes(inputType.name),
    );

    if (!orderBy) {
      return possibleTypes[0];
    }

    return orderBy.name;
  }

  const prismaUtils = config.prismaUtils === 'true';

  const modelTypes = dmmf.datamodel.models.map((model) => {
    const relations = model.fields.filter((field) => !!field.relationName);
    const listRelations = model.fields.filter((field) => !!field.relationName && field.isList);

    const createInputUnavailable = !dmmf.schema.inputObjectTypes.prisma.some(
      (input) => input.name === `${model.name}CreateInput`,
    );

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
          'OrderBy',
          undefined,
          ts.factory.createTypeReferenceNode(`Prisma.${getOrderByTypeName(model.name)}`),
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
        ...(prismaUtils
          ? [
              ts.factory.createPropertySignature(
                [],
                'Create',
                undefined,
                createInputUnavailable
                  ? ts.factory.createTypeLiteralNode([])
                  : ts.factory.createTypeReferenceNode(`Prisma.${model.name}CreateInput`),
              ),
              ts.factory.createPropertySignature(
                [],
                'Update',
                undefined,
                ts.factory.createTypeReferenceNode(`Prisma.${model.name}UpdateInput`),
              ),
            ]
          : [
              ts.factory.createPropertySignature(
                [],
                'Create',
                undefined,
                ts.factory.createTypeLiteralNode([]),
              ),
              ts.factory.createPropertySignature(
                [],
                'Update',
                undefined,
                ts.factory.createTypeLiteralNode([]),
              ),
            ]),
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
                      ? ts.factory.createArrayTypeNode(ts.factory.createTypeReferenceNode(typeName))
                      : field.isRequired
                        ? ts.factory.createTypeReferenceNode(typeName)
                        : ts.factory.createUnionTypeNode([
                            ts.factory.createTypeReferenceNode(typeName),
                            ts.factory.createLiteralTypeNode(ts.factory.createNull()),
                          ]),
                  ),
                  ts.factory.createPropertySignature(
                    [],
                    'Name',
                    undefined,
                    ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(typeName)),
                  ),
                  ts.factory.createPropertySignature(
                    [],
                    'Nullable',
                    undefined,
                    ts.factory.createLiteralTypeNode(
                      field.isRequired ? ts.factory.createFalse() : ts.factory.createTrue(),
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

  return ts.factory.createInterfaceDeclaration(
    ...modifiersArg,
    [
      ts.factory.createModifier(SyntaxKind.ExportKeyword),
      ts.factory.createModifier(SyntaxKind.DefaultKeyword),
    ],
    'PrismaTypes',
    [],
    [],
    modelTypes,
  );
}
