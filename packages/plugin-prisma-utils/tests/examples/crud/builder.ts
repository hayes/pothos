import SchemaBuilder from '@pothos/core';
import PrismaPlugin from '@pothos/plugin-prisma';
import PrismaUtils from '../../../src';
import { PrismaClient } from '../../client/index';
import type PrismaTypes from '../../generated.js';

export const queries: unknown[] = [];
export const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'stdout',
      level: 'error',
    },
    {
      emit: 'event',
      level: 'info',
    },
    {
      emit: 'stdout',
      level: 'warn',
    },
  ],
}).$extends({
  query: {
    $allModels: {
      $allOperations({ model, operation, args, query }) {
        queries.push({ action: operation, model, args });
        return query(args);
      },
    },
  },
});

export default new SchemaBuilder<{
  Context: {
    user: { id: number };
  };
  Scalars: {
    DateTime: {
      Input: Date;
      Output: Date;
    };
  };
  PrismaTypes: PrismaTypes;
}>({
  plugins: [PrismaPlugin, PrismaUtils],
  prisma: {
    client: prisma,
    exposeDescriptions: true,
  },
});
