import SchemaBuilder from '@pothos/core';
import PrismaPlugin from '@pothos/plugin-prisma';
import PrismaUtils from '../../../src';
import { PrismaClient } from '../../client/index';
import type PrismaTypes from '../../generated.js';

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

export interface Types {
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

export const builder = new SchemaBuilder<Types>({
  plugins: [PrismaPlugin, PrismaUtils],
  prisma: {
    client: prisma,
    exposeDescriptions: true,
  },
});
