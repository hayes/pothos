import { Prisma, PrismaClient, User } from '@prisma/client';
import { IncomingMessage, ServerResponse } from 'http';
import { db } from './db';
import { PubSub } from 'graphql-subscriptions';

type SelectType = {
  select?: Record<string, string>;
};

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
    user: undefined, //await getUserByToken(req),
  };
}
