import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, resolve as resolvePath } from 'node:path';
import { type DMMF, generatorHandler } from '@prisma/generator-helper';
import type { PothosPrismaDatamodel } from './types.js';

const defaultOutput = resolvePath(__dirname, '../generated.d.ts');

interface GeneratorConfig {
  clientOutput?: string;
  prismaUtils?: string;
  pluginPath?: string;
  generateDatamodel?: string;
  documentation?: string;
}

generatorHandler({
  onManifest: () => ({
    prettyName: 'Pothos integration',
    defaultOutput,
  }),
  onGenerate: async (options) => {
    const config = options.generator.config as GeneratorConfig;
    const prismaOutputLocation =
      config.clientOutput ??
      options.otherGenerators.find((gen) => gen.provider.value === 'prisma-client')?.output
        ?.value ??
      options.otherGenerators.find((gen) => gen.provider.value === 'prisma-client-js')!.output!
        .value!;

    const usingPureTsGenerator = !!options.otherGenerators.find(
      (gen) => gen.provider.value === 'prisma-client',
    );
    const extensions = ['.js', '.ts', '.cjs', '.mjs', '.cts', '.mts'];

    const prismaLocation =
      prismaOutputLocation.startsWith('@') ||
      extensions.some((ext) => prismaOutputLocation.endsWith(ext))
        ? prismaOutputLocation
        : prismaOutputLocation.startsWith('./')
          ? `./${posix.join(prismaOutputLocation, usingPureTsGenerator ? 'client.js' : 'index.js')}`
          : posix.join(prismaOutputLocation, usingPureTsGenerator ? 'client.js' : 'index.js');

    if (!prismaLocation) {
      throw new Error('Unable to find prisma client output when generating pothos types');
    }

    const outputLocation = options.generator.output?.value ?? defaultOutput;
    const prismaTypes = buildTypes(options.dmmf, config);

    await generateOutput(
      options.dmmf,
      prismaTypes,
      prismaLocation,
      outputLocation,
      config,
      outputLocation === defaultOutput ? 'cjs' : undefined,
    );

    if (outputLocation === defaultOutput) {
      await generateOutput(
        options.dmmf,
        prismaTypes,
        prismaLocation,
        join(outputLocation, '../esm/generated.d.ts'),
        config,
        'esm',
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

  for (const model of dmmf.datamodel.models) {
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
  }

  return trimmed;
}

// Double-quoted string literal, matching the output of the typescript printer
// previously used to emit these files
function stringLiteral(value: string) {
  return JSON.stringify(value);
}

// biome-ignore lint/suspicious/useAwait: needs to be async
async function generateOutput(
  dmmf: DMMF.Document,
  prismaTypes: string,
  prismaLocation: string,
  outputLocation: string,
  config: GeneratorConfig,
  datamodel?: 'esm' | 'cjs',
) {
  const modelNames = dmmf.datamodel.models.map((model) => model.name);
  const prismaImportStatement = `import type { ${['Prisma', ...modelNames].join(', ')} } from ${stringLiteral(prismaLocation)};`;

  const dmmfImportStatement = `import type { PothosPrismaDatamodel } from ${stringLiteral(config.pluginPath ?? '@pothos/plugin-prisma')};`;

  const trimmedDatamodel = trimDmmf(dmmf, config.documentation === 'true');

  const dmmfExport = outputLocation.endsWith('.d.ts')
    ? 'export function getDatamodel(): PothosPrismaDatamodel;'
    : `export function getDatamodel(): PothosPrismaDatamodel { return JSON.parse(${JSON.stringify(JSON.stringify(trimmedDatamodel))}); }`;

  const statements =
    config.generateDatamodel !== 'false'
      ? [prismaImportStatement, dmmfImportStatement, prismaTypes, dmmfExport]
      : [prismaImportStatement, prismaTypes];

  mkdirSync(dirname(outputLocation), { recursive: true });
  writeFileSync(outputLocation, `/* eslint-disable */\n${statements.join('\n')}`);

  if (outputLocation.endsWith('.d.ts')) {
    if (config.generateDatamodel === 'true' && datamodel === 'cjs') {
      writeFileSync(
        outputLocation.replace(/\.d\.ts$/, '.js'),
        `/* eslint-disable */\nmodule.exports = { getDatamodel: () => JSON.parse(${JSON.stringify(JSON.stringify(trimmedDatamodel))}) }\n`,
      );
    }

    if (config.generateDatamodel === 'true' && datamodel === 'esm') {
      writeFileSync(
        outputLocation.replace(/\.d\.ts$/, '.js'),
        `/* eslint-disable */\nexport function getDatamodel() { return JSON.parse(${JSON.stringify(JSON.stringify(trimmedDatamodel))}) }\n`,
      );
    }
  }
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

  function stringUnion(values: readonly string[]) {
    return values.length > 0 ? values.map((value) => stringLiteral(value)).join(' | ') : 'never';
  }

  const modelTypes = dmmf.datamodel.models.map((model) => {
    const relations = model.fields.filter((field) => !!field.relationName);
    const listRelations = model.fields.filter((field) => !!field.relationName && field.isList);

    const createInputUnavailable = !dmmf.schema.inputObjectTypes.prisma?.some(
      (input) => input.name === `${model.name}CreateInput`,
    );

    const updateInputUnavailable = !dmmf.schema.inputObjectTypes.prisma?.some(
      (input) => input.name === `${model.name}UpdateInput`,
    );

    const relationEntries = relations.map((field) => {
      const typeName = field.type;
      const shape = field.isList
        ? `${typeName}[]`
        : field.isRequired
          ? typeName
          : `${typeName} | null`;

      return [
        `            ${field.name}: {`,
        `                Shape: ${shape};`,
        `                Name: ${stringLiteral(typeName)};`,
        `                Nullable: ${field.isRequired ? 'false' : 'true'};`,
        '            };',
      ].join('\n');
    });

    return [
      `    ${model.name}: {`,
      `        Name: ${stringLiteral(model.name)};`,
      `        Shape: ${model.name};`,
      `        Include: ${relations.length > 0 ? `Prisma.${model.name}Include` : 'never'};`,
      `        Select: Prisma.${model.name}Select;`,
      `        OrderBy: Prisma.${getOrderByTypeName(model.name)};`,
      `        WhereUnique: Prisma.${model.name}WhereUniqueInput;`,
      `        Where: Prisma.${model.name}WhereInput;`,
      `        Create: ${prismaUtils && !createInputUnavailable ? `Prisma.${model.name}CreateInput` : '{}'};`,
      `        Update: ${prismaUtils && !updateInputUnavailable ? `Prisma.${model.name}UpdateInput` : '{}'};`,
      `        RelationName: ${stringUnion(relations.map((field) => field.name))};`,
      `        ListRelations: ${stringUnion(listRelations.map((field) => field.name))};`,
      relationEntries.length > 0
        ? `        Relations: {\n${relationEntries.join('\n')}\n        };`
        : '        Relations: {};',
      '    };',
    ].join('\n');
  });

  return ['export default interface PrismaTypes {', ...modelTypes, '}'].join('\n');
}
