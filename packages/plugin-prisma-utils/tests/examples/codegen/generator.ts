import ts from 'typescript';
import { PothosSchemaError } from '@pothos/core';
import * as Prisma from '../../client';
import { capitalize, mapFields, parse, printExpression, printStatements } from './util';

const filterOps = ['equals', 'in', 'notIn', 'not', 'is', 'isNot'] as const;
const sortableFilterProps = ['lt', 'lte', 'gt', 'gte'] as const;
const stringFilterOps = [...filterOps, 'contains', 'startsWith', 'endsWith'] as const;
const sortableTypes = ['String', 'Int', 'Float', 'DateTime', 'BigInt'] as const;
const listOps = ['every', 'some', 'none'] as const;

const { dmmf } = Prisma.Prisma;

class PrismaGenerator {
  statements: ts.Statement[] = [];
  addedTypes: Set<string> = new Set();

  addWhere(type: string, without: string[] = []) {
    const withoutName = without.map((typeName) => `Without${capitalize(typeName)}`).join('');

    const name = `${type}${withoutName}Filter`;

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
        filter = this.addPrismaFilter(field.type);
      }

      if (field.kind === 'enum') {
        this.addEnum(field.type);
        filter = this.addPrismaFilter(field.type);
      }

      if (field.kind === 'object') {
        filter = this.addWhere(field.type);
      }

      if (filter) {
        return parse`({ ${field.name}: ${
          field.isList ? this.addPrismaListFilter(field.type, filter) : filter
        }})`;
      }

      return null;
    });

    this.statements.push(
      ...parse/* ts */ `
      const ${name} = builder.prismaFilter('${type}', {
        name: '${name}',
        fields: (t) => (${printExpression(fields)})
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

    const fields = mapFields(model, (field) => {
      let filter: string | undefined;

      if (field.kind === 'scalar') {
        filter = this.addPrismaFilter(field.type);
      }

      if (field.kind === 'enum') {
        this.addEnum(field.type);
        filter = this.addPrismaFilter(field.type);
      }

      if (field.kind === 'object') {
        filter = this.addWhere(field.type);
      }

      if (filter) {
        return parse`({ ${field.name}: ${
          field.isList ? this.addPrismaListFilter(field.type, filter) : filter
        }})`;
      }

      return null;
    });

    this.statements.push(
      ...parse/* ts */ `
      const ${name} = builder.prismaFilter('${type}', {
        name: '${name}',
        fields: (t) => (${printExpression(fields)})
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
      const ${name} = builder.prismaFilter('${type}', {
        name: '${name}',
        fields: (t) => (${printExpression(fields)})
      });
    `,
    );

    return name;
  }

  addPrismaFilter(type: string) {
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
      const ${name} = builder.prismaFilter('${type}', {
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
    this.addedTypes.add(name);

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

generator.addWhere('User');
generator.addWhereUnique('User');
generator.addOrderBy('User');

console.log(printStatements(generator.statements));

function getModel(name: string) {
  const modelData = dmmf.datamodel.models.find((model) => model.name === name);

  if (!modelData) {
    throw new PothosSchemaError(`Model '${name}' not found in DMMF`);
  }

  return modelData;
}
