import SchemaBuilder from '@pothos/core';
import ComplexityPlugin from '@pothos/plugin-complexity';
import ErrorsPlugin from '@pothos/plugin-errors';
import RelayPlugin from '@pothos/plugin-relay';
import SimpleObjects from '@pothos/plugin-simple-objects';
import PrismaPlugin, { queryFromInfo, type PrismaTypesFromClient } from '../../src';
import { Prisma, PrismaClient } from '../client/index';
import { getDatamodel } from '../generated.js';

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

type PrismaTypes = PrismaTypesFromClient<typeof prisma>;

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
  relay: {
    nodeFieldOptions: {
      nullable: false,
    },
  },
  prisma: {
    filterConnectionTotalCount: true,
    client: () => prisma,
    dmmf: getDatamodel(),
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
