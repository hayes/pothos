import SchemaBuilder from '@pothos/core';
import PrismaPlugin from '@pothos/plugin-prisma';
import RelayPlugin from '@pothos/plugin-relay';
import type PrismaTypes from '../prisma/generated.ts';
import { getDatamodel } from '../prisma/generated.ts';
import { db } from './db.ts';

export const builder = new SchemaBuilder<{ PrismaTypes: PrismaTypes }>({
  plugins: [PrismaPlugin, RelayPlugin],
  relay: {},
  prisma: {
    client: db,
    dmmf: getDatamodel(),
  },
});
