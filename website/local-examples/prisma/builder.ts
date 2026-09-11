import SchemaBuilder from '@pothos/core';
import PrismaPlugin from '@pothos/plugin-prisma';
import PrismaUtils from '@pothos/plugin-prisma-utils';
import RelayPlugin from '@pothos/plugin-relay';
import type { PrismaClient } from './generated/client/client';
import type PrismaTypes from './generated/pothos';
import { getDatamodel } from './generated/pothos';

export function createSchemaBuilder(prisma: PrismaClient) {
  // #region builder
  const builder = new SchemaBuilder<{
    PrismaTypes: PrismaTypes;
    Context: { userId: number };
  }>({
    relay: { nodesOnConnection: true },
    plugins: [RelayPlugin, PrismaPlugin, PrismaUtils],
    prisma: { client: prisma, dmmf: getDatamodel(), onUnusedQuery: 'error' },
  });
  // #endregion builder
  return builder;
}
