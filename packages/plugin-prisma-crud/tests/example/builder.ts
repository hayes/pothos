import SchemaBuilder from '@pothos/core';
import PrismaPlugin from '@pothos/plugin-prisma';
import PrismaCrud from '../../src';
import PrismaTypes from '../generated';
import PrismaCrudTypes from '../generated-crud';
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
