import SchemaBuilder from '@pothos/core';
import PrismaPlugin from '@pothos/plugin-prisma';
import PrismaCrud from '../../src';
import { PrismaCrudTypes, PrismaTypes } from '../generated-crud';
import { db } from './db';

export default new SchemaBuilder<{
  PrismaTypes: PrismaTypes;
  PrismaCrudTypes: PrismaCrudTypes;
}>({
  plugins: [PrismaPlugin, PrismaCrud],
  prisma: {
    client: db,
  },
});
