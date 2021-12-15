import SchemaBuilder from '@giraphql/core';
import PrismaPlugin from '@giraphql/plugin-prisma';
import PrismaTypes from '@giraphql/plugin-prisma/generated';
import { db } from './db';

export const builder = new SchemaBuilder<{ PrismaTypes: PrismaTypes }>({
  plugins: [PrismaPlugin],
  prisma: {
    client: db,
  },
});
