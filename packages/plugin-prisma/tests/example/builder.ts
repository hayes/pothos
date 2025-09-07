import SchemaBuilder from '@pothos/core';
import ComplexityPlugin from '@pothos/plugin-complexity';
import ErrorsPlugin from '@pothos/plugin-errors';
import RelayPlugin from '@pothos/plugin-relay';
import SimpleObjects from '@pothos/plugin-simple-objects';
import PrismaPlugin, { type PrismaTypesFromClient } from '../../src';
import { Prisma, PrismaClient } from '../client/client.js';
import { getDatamodel } from '../generated.js';

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
