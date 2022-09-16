import SchemaBuilder from '@pothos/core';
import PrismaPlugin from '@pothos/plugin-prisma';
import ValidationPlugin from '@pothos/plugin-validation';
import { PrismaClient } from '../../prisma/client';
import type PrismaTypes from '../../prisma/generated';
import WithInputPlugin from '../../src';

export const prisma = new PrismaClient();

export default new SchemaBuilder<{
  PrismaTypes: PrismaTypes;
  Scalars: {
    ID: { Input: string; Output: string | number };
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
  },
});

const builderWithNonRequireInputs = new SchemaBuilder<{
  PrismaTypes: PrismaTypes;
  WithInputArgRequired: false;
  Scalars: {
    ID: { Input: string; Output: string | number };
  };
}>({
  plugins: [ValidationPlugin, WithInputPlugin],
  withInput: {
    argOptions: {
      required: false,
      description: 'input arg',
    },
  },
  prisma: {
    client: prisma,
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
      resolve: (root, args) => {
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
      resolve: (root, args) => {
        const result = args.input.example;

        return result;
      },
    }),
  }),
});
