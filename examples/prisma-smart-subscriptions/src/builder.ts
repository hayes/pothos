import SchemaBuilder from '@pothos/core';
import PrismaPlugin from '@pothos/plugin-prisma';
import SmartSubscriptionsPlugin, {
  subscribeOptionsFromIterator,
} from '@pothos/plugin-smart-subscriptions';
import type PrismaTypes from '../prisma/generated.ts';
import { getDatamodel } from '../prisma/generated.ts';
import type { Context } from './context.ts';
import { db } from './db.ts';
import { pubsub } from './pubsub.ts';

export const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypes;
  Context: Context;
}>({
  plugins: [PrismaPlugin, SmartSubscriptionsPlugin],
  prisma: {
    client: db,
    dmmf: getDatamodel(),
  },
  smartSubscriptions: {
    ...subscribeOptionsFromIterator((name) => pubsub.asyncIterableIterator(name)),
  },
});
