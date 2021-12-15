import SchemaBuilder from '@giraphql/core';
import PrismaPlugin from '@giraphql/plugin-prisma';
import RelayPlugin from '@giraphql/plugin-relay';
import type PrismaTypes from '../prisma/generated';
import { db } from './db';

export const builder = new SchemaBuilder<{ PrismaTypes: PrismaTypes }>({
  plugins: [PrismaPlugin, RelayPlugin],
  relayOptions: {},
  prisma: {
    client: db,
  },
});
