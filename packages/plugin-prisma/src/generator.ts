/* eslint-disable unicorn/prefer-module */
/* eslint-disable node/prefer-promises/fs */
/* eslint-disable no-magic-numbers */
/* eslint-disable no-nested-ternary */
import { mkdir, writeFile } from 'fs';
import { dirname, join, resolve as resolvePath } from 'path';
import ts, { ListFormat, ScriptKind, ScriptTarget, SyntaxKind, version } from 'typescript';
import { DMMF, generatorHandler } from '@prisma/generator-helper';

const MIN_TS_VERSION = [4, 5, 2];

function checkTSVersion() {
  const versionParts = version.split(/[.-]/g);

  for (let i = 0; i < 3; i += 1) {
    const part = Number.parseInt(versionParts[i], 10);
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
    const config = options.generator.config as { clientOutput?: string };
    const prismaLocation =
      config.clientOutput ??
      options.otherGenerators.find((gen) => gen.provider.value === 'prisma-client-js')!.output!
        .value!;

    const outputLocation = options.generator.output?.value ?? defaultOutput;
    const prismaTypes = buildTypes(options.dmmf);

    await generateOutput(options.dmmf, prismaTypes, prismaLocation, outputLocation);

    if (outputLocation === defaultOutput) {
      await generateOutput(
        options.dmmf,
        prismaTypes,
        join(prismaLocation.replace('../', '../../'), 'index.js'),
        outputLocation.replace('/generated.ts', '/esm/generated.ts'),
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
    [],
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

function buildTypes(dmmf: DMMF.Document) {
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

  const modelTypes = dmmf.datamodel.models.map((model) => {
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
                  // ts.factory.createPropertySignature(
                  //   [],
                  //   'Types',
                  //   undefined,
                  //   ts.factory.createIndexedAccessTypeNode(
                  //     ts.factory.createTypeReferenceNode('PrismaTypes'),
                  //     ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(typeName)),
                  //   ),
                  // ),
                  ts.factory.createPropertySignature(
                    [],
                    'Name',
                    undefined,
                    ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(typeName)),
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
    [],
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
