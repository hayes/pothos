import SchemaBuilder from '@giraphql/core';
import PrismaPlugin from '@giraphql/plugin-prisma';
import PrismaTypes from '@giraphql/plugin-prisma/generated';
import RelayPlugin from '@giraphql/plugin-relay';
import { db } from './db';

export const builder = new SchemaBuilder<{ PrismaTypes: PrismaTypes }>({
  plugins: [PrismaPlugin, RelayPlugin],
  relayOptions: {},
  prisma: {
    client: db,
  },
});
