/* eslint-disable unicorn/prefer-module */
/* eslint-disable no-magic-numbers */
/* eslint-disable no-nested-ternary */
import { mkdir, writeFile } from 'node:fs';
import { dirname, join, resolve as resolvePath, posix } from 'node:path';
import ts, { ListFormat, ScriptKind, ScriptTarget, SyntaxKind, version } from 'typescript';
import { DMMF, generatorHandler } from '@prisma/generator-helper';
import { PothosPrismaDatamodel } from './types';

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

interface GeneratorConfig {
  clientOutput?: string;
  prismaUtils?: string;
  generateDatamodel?: string;
  documentation?: string;
}

generatorHandler({
  onManifest: () => ({
    prettyName: 'Pothos integration',
    requiresGenerators: ['prisma-client-js'],
    defaultOutput,
  }),
  onGenerate: async (options) => {
    checkTSVersion();
    const config = options.generator.config as GeneratorConfig;
    const prismaLocation =
      config.clientOutput ??
      options.otherGenerators.find((gen) => gen.provider.value === 'prisma-client-js')!.output!
        .value!;

    const outputLocation = options.generator.output?.value ?? defaultOutput;
    const prismaTypes = buildTypes(options.dmmf, config);

    await generateOutput(options.dmmf, prismaTypes, prismaLocation, outputLocation, config);

    if (outputLocation === defaultOutput) {
      await generateOutput(
        options.dmmf,
        prismaTypes,
        prismaLocation.startsWith('@') ? prismaLocation : posix.join(prismaLocation, 'index.js'),
        join(outputLocation, '../esm/generated.ts'),
        config,
      );
    }
  },
});

function trimDmmf(dmmf: DMMF.Document, documentation = false): PothosPrismaDatamodel {
  const trimmed: PothosPrismaDatamodel = {
    datamodel: {
      models: {},
    },
  };

  dmmf.datamodel.models.forEach((model) => {
    trimmed.datamodel.models[model.name] = {
      fields: model.fields.map((field) => ({
        type: field.type,
        kind: field.kind,
        name: field.name,
        isRequired: field.isRequired,
        isList: field.isList,
        hasDefaultValue: field.hasDefaultValue,
        isUnique: field.isUnique,
        isId: field.isId,
        relationName: field.relationName,
        relationFromFields: field.relationFromFields,
        isUpdatedAt: field.isUpdatedAt,
        documentation: documentation ? field.documentation : undefined,
      })),
      primaryKey: model.primaryKey
        ? { name: model.primaryKey.name, fields: model.primaryKey.fields }
        : null,
      uniqueIndexes: model.uniqueIndexes.map((index) => ({
        name: index.name,
        fields: index.fields,
      })),
      documentation: documentation ? model.documentation : undefined,
    };
  });

  return trimmed;
}

async function generateOutput(
  dmmf: DMMF.Document,
  prismaTypes: ts.InterfaceDeclaration,
  prismaLocation: string,
  outputLocation: string,
  config: GeneratorConfig,
) {
  const prismaImportStatement = ts.factory.createImportDeclaration(
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

  const dmmfImportStatement = ts.factory.createImportDeclaration(
    ...modifiersArg,
    [],
    ts.factory.createImportClause(
      true,
      undefined,
      ts.factory.createNamedImports([
        ts.factory.createImportSpecifier(
          false,
          undefined,
          ts.factory.createIdentifier('PothosPrismaDatamodel'),
        ),
      ]),
    ),
    ts.factory.createStringLiteral('@pothos/plugin-prisma'),
  );

  const printer = ts.createPrinter({});

  const sourcefile = ts.createSourceFile(
    outputLocation,
    '',
    ScriptTarget.ESNext,
    false,
    ScriptKind.TS,
  );

  const trimmedDatamodel = trimDmmf(dmmf, config.documentation === 'true');

  const dmmfExport = ts.factory.createFunctionDeclaration(
    [ts.factory.createModifier(SyntaxKind.ExportKeyword)],
    undefined,
    'getDatamodel',
    [],
    [],
    ts.factory.createTypeReferenceNode('PothosPrismaDatamodel'),
    ts.factory.createBlock([
      ts.factory.createReturnStatement(
        ts.factory.createCallExpression(
          ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('JSON'), 'parse'),
          [],
          [ts.factory.createStringLiteral(JSON.stringify(trimmedDatamodel))],
        ),
      ),
    ]),
  );

  const nodes = ts.factory.createNodeArray(
    config.generateDatamodel === 'true'
      ? [prismaImportStatement, dmmfImportStatement, prismaTypes, dmmfExport]
      : [prismaImportStatement, prismaTypes],
  );

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
