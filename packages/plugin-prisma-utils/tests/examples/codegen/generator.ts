/* eslint-disable unicorn/no-process-exit */
/* eslint-disable unicorn/prefer-module */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format, resolveConfig } from 'prettier';
import ts from 'typescript';
import { PothosSchemaError } from '@pothos/core';
import * as Prisma from '../../client';
import {
  capitalize,
  mapFields,
  mapUniqueFields,
  parse,
  printExpression,
  printStatements,
} from './util';

const filterOps = ['equals', 'in', 'notIn', 'not', 'is', 'isNot'] as const;
const sortableFilterProps = ['lt', 'lte', 'gt', 'gte'] as const;
const stringFilterOps = [...filterOps, 'contains', 'startsWith', 'endsWith', 'mode'] as const;
const sortableTypes = ['String', 'Int', 'Float', 'DateTime', 'BigInt'] as const;
const listOps = ['every', 'some', 'none'] as const;
const scalarListOps = ['has', 'hasSome', 'hasEvery', 'isEmpty', 'equals'] as const;

const { dmmf } = Prisma.Prisma;

class PrismaGenerator {
  statements: ts.Statement[] = [];

  addedTypes: Set<string> = new Set();

  addCreate(type: string, without: string[] = []) {
    const withoutName = without.map((typeName) => `Without${capitalize(typeName)}`).join('');
    const name = `${type}Create${withoutName}`;

    if (this.addedTypes.has(name)) {
      return name;
    }

    this.addedTypes.add(name);

    const model = getModel(type);
    const withoutFields = model.fields.filter((field) => without?.includes(field.name));

    const fields = mapFields(model, (field) => {
      if (
        withoutFields.some(
          (f) => f.name === field.name || f.relationFromFields?.includes(field.name),
        )
      ) {
        return null;
      }

      let filter: string | undefined;

      if (field.kind === 'scalar') {
        filter = `'${field.type}'`;
      }

      if (field.kind === 'enum') {
        filter = this.addEnum(field.type);
      }

      if (field.kind === 'object') {
        filter = this.addCreateRelation(model.name, field.name);
      }

      if (filter) {
        return parse`({ ${field.name}: ${filter}})`;
      }

      return null;
    });

    this.statements.push(
      ...parse/* ts */ `
      export const ${name}: InputObjectRef<Types, Prisma.Prisma.${type}Create${withoutName}Input> = builder.prismaCreate('${type}', {
        name: '${name}',
        fields: () => (${printExpression(fields)})
      });
    `,
    );

    return name;
  }

  addCreateRelation(modelName: string, relation: string) {
    const name = `${modelName}Create${capitalize(relation)}`;

    if (this.addedTypes.has(name)) {
      return name;
    }

    this.addedTypes.add(name);

    const model = getModel(modelName);
    const relationField = model.fields.find((field) => field.name === relation)!;
    const relatedModel = getModel(relationField.type);
    const relatedFieldName = relatedModel.fields.find(
      (field) => field.relationName === relationField.relationName,
    )!;

    this.statements.push(
      ...parse/* ts */ `
      export const ${name} = builder.prismaCreateRelation('${modelName}', '${relation}', {
        fields: () => ({
          create: ${this.addCreate(relatedModel.name, [relatedFieldName.name])},
          connect: ${this.addWhereUnique(relatedModel.name)},
        })
      });
    `,
    );

    return name;
  }

  addUpdate(type: string, without: string[] = []) {
    const withoutName = without.map((typeName) => `Without${capitalize(typeName)}`).join('');
    const name = `${type}Update${withoutName}`;

    if (this.addedTypes.has(name)) {
      return name;
    }

    this.addedTypes.add(name);

    const model = getModel(type);
    const withoutFields = model.fields.filter((field) => without?.includes(field.name));

    const fields = mapFields(model, (field) => {
      if (
        withoutFields.some(
          (f) => f.name === field.name || f.relationFromFields?.includes(field.name),
        )
      ) {
        return null;
      }

      let filter: string | undefined;

      if (field.kind === 'scalar') {
        filter = `'${field.type}'`;
      }

      if (field.kind === 'enum') {
        filter = this.addEnum(field.type);
      }

      if (field.kind === 'object') {
        filter = this.addUpdateRelation(model.name, field.name);
      }

      if (filter) {
        return parse`({ ${field.name}: ${filter}})`;
      }

      return null;
    });

    this.statements.push(
      ...parse/* ts */ `
      export const ${name}: InputObjectRef<Types, Prisma.Prisma.${type}Update${withoutName}Input> = builder.prismaUpdate('${type}', {
        name: '${name}',
        fields: () => (${printExpression(fields)})
      });
    `,
    );

    return name;
  }

  addUpdateRelation(modelName: string, relation: string) {
    const name = `${modelName}Update${capitalize(relation)}`;

    if (this.addedTypes.has(name)) {
      return name;
    }

    this.addedTypes.add(name);

    const model = getModel(modelName);
    const relationField = model.fields.find((field) => field.name === relation)!;
    const relatedModel = getModel(relationField.type);
    const relatedFieldName = relatedModel.fields.find(
      (field) => field.relationName === relationField.relationName,
    )!;
    const relatedField = relatedModel.fields.find((field) => field.name === relatedFieldName.name)!;
    const relatedFieldIsList =
      (relatedField.kind === 'object' && relatedField.isList) ||
      ('list' in relatedField && relatedField.list);

    if (relationField.isList) {
      this.statements.push(
        ...parse/* ts */ `
        export const ${name} = builder.prismaUpdateRelation('${modelName}', '${relation}', {
          fields: () => ({
            create: ${this.addCreate(relatedModel.name, [relatedFieldName.name])},
            set: ${this.addWhereUnique(relatedModel.name)},
            disconnect: ${this.addWhereUnique(relatedModel.name)},
            delete: ${this.addWhereUnique(relatedModel.name)},
            connect: ${this.addWhereUnique(relatedModel.name)},
            update: {
              where: ${this.addWhereUnique(relatedModel.name)},
              data: ${this.addUpdate(relatedModel.name, [relatedFieldName.name])},
            },
            updateMany: {
              where: ${this.addWhere(relatedModel.name, [relatedFieldName.name])},
              data: ${this.addUpdate(relatedModel.name, [relatedFieldName.name])},
            },
            deleteMany: ${this.addWhere(relatedModel.name, [relatedFieldName.name])},
          })
        });
      `,
      );
    } else {
      this.statements.push(
        ...parse/* ts */ `
      export const ${name} = builder.prismaUpdateRelation('${modelName}', '${relation}', {
        fields: () => ({
          create: ${this.addCreate(relatedModel.name, [relatedFieldName.name])},
          update: ${this.addUpdate(relatedModel.name, [relatedFieldName.name])},
          connect: ${this.addWhereUnique(relatedModel.name)},
          ${relatedFieldIsList ? '' : 'disconnect: true, delete: true,'}
        })
      });
    `,
      );
    }

    return name;
  }

  addWhere(type: string, without: string[] = []) {
    const withoutName = without.map((typeName) => `Without${capitalize(typeName)}`).join('');

    const name = `${type}${withoutName}Filter`;

    if (this.addedTypes.has(name)) {
      return name;
    }

    const index = this.statements.length;

    this.addedTypes.add(name);

    const model = getModel(type);

    const withoutFields = model.fields.filter((field) => without?.includes(field.name));

    const fields = mapFields(model, (field) => {
      if (
        withoutFields.some(
          (f) => f.name === field.name || f.relationFromFields?.includes(field.name),
        )
      ) {
        return null;
      }

      let filter: string | undefined;

      if (field.isList) {
        if (field.kind === 'scalar') {
          filter = this.addPrismaScalarListFilter(field.type);
        }

        if (field.kind === 'enum') {
          filter = this.addPrismaScalarListFilter(field.type, this.addEnum(field.type));
        }

        if (field.kind === 'object') {
          filter = this.addPrismaListFilter(field.type, this.addWhere(field.type));
        }
      } else {
        if (field.kind === 'scalar') {
          filter = this.addPrismaFilter(field.type);
        }

        if (field.kind === 'enum') {
          filter = this.addPrismaFilter(field.type, this.addEnum(field.type));
        }

        if (field.kind === 'object') {
          filter = this.addWhere(field.type);
        }
      }

      if (filter) {
        return parse`({ ${field.name}: ${filter} })`;
      }

      return null;
    });

    this.statements.splice(
      index,
      0,
      ...parse/* ts */ `
      export const ${name}: InputObjectRef<Types, Prisma.Prisma.${type}WhereInput> = builder.prismaWhere('${type}', {
        name: '${name}',
        fields: () => (${printExpression(fields)})
      });
    `,
    );

    return name;
  }

  addWhereUnique(type: string) {
    const name = `${type}UniqueFilter`;

    if (this.addedTypes.has(name)) {
      return name;
    }

    this.addedTypes.add(name);

    const model = getModel(type);

    const fields = mapUniqueFields(model, (field) => parse`({ ${field.name}: '${field.type}' })`);

    this.statements.push(
      ...parse/* ts */ `
      export const ${name} = builder.prismaWhereUnique('${type}', {
        name: '${name}',
        fields: () => (${printExpression(fields)})
      });
    `,
    );

    return name;
  }

  addOrderBy(type: string) {
    const name = `${type}OrderBy`;

    if (this.addedTypes.has(name)) {
      return name;
    }

    this.addedTypes.add(name);

    const model = getModel(type);

    const fields = mapFields(model, (field) => {
      if (field.kind === 'scalar' || field.kind === 'enum') {
        return parse`({ ${field.name}: true })`;
      }

      if (field.kind === 'object') {
        return parse`({ ${field.name}: ${this.addOrderBy(field.type)}})`;
      }

      return null;
    });

    this.statements.push(
      ...parse/* ts */ `
      export const ${name}: InputObjectRef<Types, Prisma.Prisma.${type}OrderByWithRelationInput> = builder.prismaOrderBy('${type}', {
        name: '${name}',
        fields: () => (${printExpression(fields)})
      });
    `,
    );

    return name;
  }

  addPrismaFilter(type: string, ref = `'${type}'`) {
    const name = `${type}Filter`;

    if (this.addedTypes.has(name)) {
      return name;
    }
    this.addedTypes.add(name);

    const ops: string[] = [...filterOps];

    if (type === 'String') {
      ops.push(...stringFilterOps);
    }

    if (sortableTypes.includes(type as never)) {
      ops.push(...sortableFilterProps);
    }

    this.statements.push(
      ...parse/* ts */ `
      export const ${name} = builder.prismaFilter(${ref}, {
        name: '${name}',
        ops: [${ops.map((op) => `'${op}'`).join(', ')}],
      });
    `,
    );

    return name;
  }

  addPrismaScalarListFilter(type: string, ref = `'${type}'`) {
    const name = `${type}ListFilter`;

    if (this.addedTypes.has(name)) {
      return name;
    }
    this.addedTypes.add(name);

    const ops: string[] = [...scalarListOps];

    this.statements.push(
      ...parse/* ts */ `
      export const ${name} = builder.prismaScalarListFilter(${ref}, {
        name: '${name}',
        ops: [${ops.map((op) => `'${op}'`).join(', ')}],
      });
    `,
    );

    return name;
  }

  addPrismaListFilter(type: string, filter: string) {
    const name = `${type}ListFilter`;

    if (this.addedTypes.has(name)) {
      return name;
    }
    this.addedTypes.add(name);

    const ops: string[] = [...listOps];

    this.statements.push(
      ...parse/* ts */ `
      export const ${name} = builder.prismaListFilter(${filter}, {
        name: '${name}',
        ops: [${ops.map((op) => `'${op}'`).join(', ')}],
      });
    `,
    );

    return name;
  }

  addEnum(name: string) {
    if (this.addedTypes.has(name)) {
      return `Prisma.${name}`;
    }
    this.addedTypes.add(name);

    this.statements.push(
      ...parse/* ts */ `
      builder.enumType(Prisma.${name}, {
        name: '${name}',
      });
    `,
    );

    return `Prisma.${name}`;
  }
}

function getModel(name: string) {
  const modelData = dmmf.datamodel.models.find((model) => model.name === name);

  if (!modelData) {
    throw new PothosSchemaError(`Model '${name}' not found in DMMF`);
  }

  return modelData;
}

const generator = new PrismaGenerator();

dmmf.datamodel.enums.forEach((enumData) => {
  generator.addEnum(enumData.name);
});

dmmf.datamodel.models.forEach((model) => {
  generator.addWhere(model.name);
  generator.addWhereUnique(model.name);
  generator.addOrderBy(model.name);
  generator.addCreate(model.name);
  generator.addUpdate(model.name);
});

const generated = printStatements(generator.statements);

// eslint-disable-next-line unicorn/prefer-top-level-await
printCode().catch((error: unknown) => {
  console.error(error);

  process.exit(1);
});

async function printCode() {
  const config = await resolveConfig(__dirname);
  const formatted = await format(
    /* ts */ `
  import { InputObjectRef } from '@pothos/core';
  import * as Prisma from '../../../client';
  import { builder } from '../builder';

  type Types = typeof builder extends PothosSchemaTypes.SchemaBuilder<infer T> ? T : never;

  ${generated}`,
    { ...config, parser: 'typescript' },
  );

  writeFileSync(resolve(__dirname, './schema/prisma-inputs.ts'), formatted);
}
