import SchemaBuilder from '@pothos/core';
import ComplexityPlugin from '@pothos/plugin-complexity';
import ErrorsPlugin from '@pothos/plugin-errors';
import RelayPlugin from '@pothos/plugin-relay';
import SimpleObjects from '@pothos/plugin-simple-objects';
// eslint-disable-next-line import/no-named-as-default
import PrismaPlugin from '../../src';
import { Prisma, PrismaClient } from '../client';
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
  AuthScopes: {
    user: boolean;
  };
}>({
  plugins: [ErrorsPlugin, PrismaPlugin, RelayPlugin, ComplexityPlugin, SimpleObjects],
  relayOptions: {},
  prisma: {
    client: () => prisma,
    dmmf: Prisma.dmmf,
    exposeDescriptions: true,
  },
  errorOptions: {
    defaultTypes: [Error],
  },
});
