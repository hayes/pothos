import SchemaBuilder from '@pothos/core';
import PrismaNextPlugin from '@pothos/plugin-prisma-next';
import RelayPlugin from '@pothos/plugin-relay';
import type { Contract } from './contract';
import { contract } from './database';

export const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [RelayPlugin, PrismaNextPlugin],
  prismaNext: { contract },
});
