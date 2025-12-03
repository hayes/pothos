import { PubSub } from 'graphql-subscriptions';
import type { User } from '../prisma/client/client';
import { db } from './db';

interface SelectType {
  select?: Record<string, string>;
}

export interface Context {
  db: typeof db;
  select: SelectType;
  user?: User;
  pubsub: PubSub;
}

export const pubsub = new PubSub();

export async function createContext(): Promise<Context> {
  return {
    db,
    pubsub,
    select: {},
    user: (await db.user.findFirst()) ?? undefined,
  };
}
