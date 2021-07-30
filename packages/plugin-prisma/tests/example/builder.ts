import SchemaBuilder from '@giraphql/core';
import { PrismaClient } from '@prisma/client';
// eslint-disable-next-line import/no-named-as-default
import PrismaPlugin from '../../src';

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
});

export default new SchemaBuilder<{
  Context: {
    user: { id: number };
  };
  PrismaClient: typeof prisma;
}>({
  plugins: [PrismaPlugin],
  prisma: {
    client: prisma,
  },
});
