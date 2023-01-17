import SchemaBuilder from '@pothos/core';
import PrismaPlugin from '@pothos/plugin-prisma';
import SmartSubscriptionsPlugin, {
  subscribeOptionsFromIterator,
} from '@pothos/plugin-smart-subscriptions';
import type PrismaTypes from '../prisma/generated';
import { db } from './db';
import { pubsub } from './pubsub';
import { Context } from './context';

export const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypes;
  Context: Context;
}>({
  plugins: [PrismaPlugin, SmartSubscriptionsPlugin],
  prisma: {
    client: db,
  },
  smartSubscriptions: {
    ...subscribeOptionsFromIterator((name, context) => {
      return pubsub.asyncIterator(name);
    }),
  },
});
