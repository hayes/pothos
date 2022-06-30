/* eslint-disable no-underscore-dangle */
import SchemaBuilder from '@pothos/core';
import ComplexityPlugin from '@pothos/plugin-complexity';
import ErrorsPlugin from '@pothos/plugin-errors';
import RelayPlugin from '@pothos/plugin-relay';
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
  plugins: [ErrorsPlugin, PrismaPlugin, RelayPlugin, ComplexityPlugin],
  relayOptions: {},
  prisma: {
    client: () => prisma,
    dmmf:
      (prisma as unknown as { _baseDmmf: Prisma.DMMF.Document })._baseDmmf ||
      (prisma as unknown as { _dmmf: Prisma.DMMF.Document })._dmmf,
  },
  errorOptions: {
    defaultTypes: [Error],
  },
});
