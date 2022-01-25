import SchemaBuilder from '@pothos/core';
import ErrorsPlugin from '@pothos/plugin-errors';
import RelayPlugin from '@pothos/plugin-relay';
// eslint-disable-next-line import/no-named-as-default
import PrismaPlugin from '../../src';
import { PrismaClient } from '../client';
import PrismaTypes from '../generated';

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
  PrismaTypes: PrismaTypes;
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
