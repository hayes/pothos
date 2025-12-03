import SchemaBuilder from '@pothos/core';
import PrismaPlugin from '@pothos/plugin-prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import PrismaUtils from '../../../src';
import { PrismaClient } from '../../client/client';
import type PrismaTypes from '../../generated.js';
import { getDatamodel } from '../../generated.js';

const pool = new pg.Pool({
  connectionString: 'postgresql://prisma:prisma@localhost:5455/tests',
});
const adapter = new PrismaPg(pool, { schema: 'prisma-utils' });

export const queries: unknown[] = [];
export const prisma = new PrismaClient({
  adapter,
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
    dmmf: getDatamodel(),
    exposeDescriptions: true,
  },
});
