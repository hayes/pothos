import SchemaBuilder from '@pothos/core';
import PrismaNextPlugin from '@pothos/plugin-prisma-next';
import RelayPlugin from '@pothos/plugin-relay';
import { contract } from './database';

export const builder = new SchemaBuilder<{ PrismaNextContract: typeof contract }>({
  plugins: [RelayPlugin, PrismaNextPlugin],
  prismaNext: { contract },
});
