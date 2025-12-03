import SchemaBuilder from '@pothos/core';
import PrismaPlugin from '@pothos/plugin-prisma';
import type PrismaTypes from '../prisma/generated';
import { getDatamodel } from '../prisma/generated';
import { db } from './db';
import type { pubsub } from './pubsub';

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
