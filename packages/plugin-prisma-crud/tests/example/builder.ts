import SchemaBuilder from '@pothos/core';
import PrismaPlugin from '@pothos/plugin-prisma';
import PrismaCrud from '../../src';
import PrismaTypes from '../generated';
import { db } from './db';

export default new SchemaBuilder<{
  PrismaTypes: PrismaTypes;
  Scalars: {
    DateTime: { Input: Date; Output: Date };
  };
}>({
  plugins: [PrismaPlugin, PrismaCrud],
  prisma: {
    client: db,
  },
});
