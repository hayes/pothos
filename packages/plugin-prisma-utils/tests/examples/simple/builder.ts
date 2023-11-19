import SchemaBuilder from '@pothos/core';
import PrismaPlugin from '@pothos/plugin-prisma';
import PrismaUtils from '../../../src';
// eslint-disable-next-line import/no-useless-path-segments
import { PrismaClient } from '../../client/index';
import PrismaTypes from '../../generated';

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

interface PothosTypes {
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
}

export default new SchemaBuilder<PothosTypes>({
  plugins: [PrismaPlugin, PrismaUtils],
  prisma: {
    client: prisma,
    exposeDescriptions: true,
  },
});
