import SchemaBuilder from '@pothos/core';
import PrismaPlugin from '@pothos/plugin-prisma';
import ValidationPlugin from '@pothos/plugin-zod';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../../prisma/client/client';
import type PrismaTypes from '../../prisma/generated';
import { getDatamodel } from '../../prisma/generated';
import WithInputPlugin from '../../src';

const adapter = new PrismaBetterSqlite3({ url: 'file:./prisma/dev.db' });

export const prisma = new PrismaClient({ adapter });

export default new SchemaBuilder<{
  PrismaTypes: PrismaTypes;
  Scalars: {
    ID: { Input: string; Output: number | string };
  };
}>({
  plugins: [ValidationPlugin, WithInputPlugin, PrismaPlugin],
  withInput: {
    argOptions: {
      description: 'input arg',
    },
  },
  prisma: {
    client: prisma,
    dmmf: getDatamodel(),
  },
});

export const builderWithNonRequireInputs = new SchemaBuilder<{
  PrismaTypes: PrismaTypes;
  WithInputArgRequired: false;
  Scalars: {
    ID: { Input: string; Output: number | string };
  };
}>({
  plugins: [ValidationPlugin, WithInputPlugin],
  withInput: {
    typeOptions: {
      name: ({ parentTypeName, fieldName }) => {
        const capitalizedFieldName = `${fieldName[0].toUpperCase()}${fieldName.slice(1)}`;
        // This will remove the default Query/Mutation prefix from the input type name
        if (parentTypeName === 'Query' || parentTypeName === 'Mutation') {
          return `${capitalizedFieldName}Input`;
        }

        return `${parentTypeName}${capitalizedFieldName}Input`;
      },
    },
    argOptions: {
      required: false,
      description: 'input arg',
    },
  },
  prisma: {
    client: prisma,
    dmmf: getDatamodel(),
  },
});

builderWithNonRequireInputs.queryType({
  fields: (t) => ({
    default: t.fieldWithInput({
      type: 'Boolean',
      input: {
        example: t.input.boolean({
          required: true,
        }),
      },
      resolve: (_root, args) => {
        // @ts-expect-error input is not required
        const result = args.input.example;

        return result;
      },
    }),
    overwrite: t.fieldWithInput({
      type: 'Boolean',
      argOptions: {
        required: true,
      },
      input: {
        example: t.input.boolean({
          required: true,
        }),
      },
      resolve: (_root, args) => {
        const result = args.input.example;

        return result;
      },
    }),
  }),
});
