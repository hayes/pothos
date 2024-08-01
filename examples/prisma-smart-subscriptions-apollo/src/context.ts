import type { IncomingMessage, ServerResponse } from 'node:http';
import { PubSub } from 'graphql-subscriptions';
import type { User } from '../prisma/client';
import { db } from './db';

interface SelectType {
  select?: Record<string, string>;
}

export interface Context {
  db: typeof db;
  select: SelectType;
  user?: User;
  request: IncomingMessage;
  response: ServerResponse;
  pubsub: PubSub;
}

export const pubsub = new PubSub();

export const defaultContext = {
  db,
  pubsub,
};

export async function createContext({
  req,
  res,
}: {
  req: IncomingMessage;
  res: ServerResponse;
}): Promise<Context> {
  return {
    ...defaultContext,
    request: req,
    response: res,
    select: {},
    user: (await db.user.findFirst()) ?? undefined,
  };
}
