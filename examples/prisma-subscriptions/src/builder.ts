import SchemaBuilder from '@pothos/core';
import PrismaPlugin from '@pothos/plugin-prisma';
import type PrismaTypes from '../prisma/generated.ts';
import { getDatamodel } from '../prisma/generated.ts';
import { db } from './db.ts';
import type { pubsub } from './pubsub.ts';

export const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypes;
  Context: { pubsub: typeof pubsub };
}>({
  plugins: [PrismaPlugin],
  prisma: {
    client: db,
    dmmf: getDatamodel(),
  },
});
