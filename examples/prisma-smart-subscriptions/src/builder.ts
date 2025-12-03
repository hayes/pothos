import SchemaBuilder from '@pothos/core';
import PrismaPlugin from '@pothos/plugin-prisma';
import SmartSubscriptionsPlugin, {
  subscribeOptionsFromIterator,
} from '@pothos/plugin-smart-subscriptions';
import type PrismaTypes from '../prisma/generated';
import { getDatamodel } from '../prisma/generated';
import type { Context } from './context';
import { db } from './db';
import { pubsub } from './pubsub';

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
