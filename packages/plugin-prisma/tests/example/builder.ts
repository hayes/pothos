import SchemaBuilder from '@giraphql/core';
import ErrorsPlugin from '@giraphql/plugin-errors';
import RelayPlugin from '@giraphql/plugin-relay';
import { PrismaClient } from '@prisma/client';
import PrismaPlugin from '../../lib/index.js';

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
}>({
  plugins: [ErrorsPlugin, PrismaPlugin, RelayPlugin],
  relayOptions: {},
  prisma: {
    client: prisma,
  },
  errorOptions: {
    defaultTypes: [Error],
  },
});
