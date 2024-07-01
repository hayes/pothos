import SchemaBuilder from '@pothos/core';
import ComplexityPlugin from '@pothos/plugin-complexity';
import ErrorsPlugin from '@pothos/plugin-errors';
import RelayPlugin from '@pothos/plugin-relay';
import SimpleObjects from '@pothos/plugin-simple-objects';
import PrismaPlugin from '../../src';
// eslint-disable-next-line import/no-useless-path-segments
import { Prisma, PrismaClient } from '../client/index';
import PrismaTypes from '../generated.js';

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

interface Types {
  Scalars: {
    Decimal: {
      Input: Prisma.Decimal;
      Output: Prisma.Decimal;
    };
  };
  Context: {
    user: { id: number };
  };
  PrismaTypes: PrismaTypes;
  AuthScopes: {
    user: boolean;
  };
}

const builder = new SchemaBuilder<Types>({
  plugins: [ErrorsPlugin, PrismaPlugin, RelayPlugin, ComplexityPlugin, SimpleObjects],
  relay: {},
  prisma: {
    filterConnectionTotalCount: true,
    client: () => prisma,
    dmmf: Prisma.dmmf,
    exposeDescriptions: true,
    onUnusedQuery: 'error',
  },
  errors: {
    defaultTypes: [Error],
  },
});

builder.scalarType('Decimal', {
  serialize: (value) => value.toString(),
  parseValue: (value) => {
    if (typeof value !== 'string') {
      throw new TypeError('Decimal must be a string');
    }

    return new Prisma.Decimal(value);
  },
});

export default builder;
