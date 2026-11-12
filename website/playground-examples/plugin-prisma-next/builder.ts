import SchemaBuilder from '@pothos/core';
import PrismaPlugin from '@pothos/plugin-prisma-next';
import RelayPlugin from '@pothos/plugin-relay';
import type { Contract } from './contract';
import { db } from './database';

export const builder = new SchemaBuilder<{ PrismaContract: Contract }>({
  plugins: [RelayPlugin, PrismaPlugin],
  prisma: { client: db },
});
