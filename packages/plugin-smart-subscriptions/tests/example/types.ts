import type { GraphQLResolveInfo } from 'graphql';
import type { PubSub } from 'graphql-subscriptions';
import type { Poll } from './data';

export interface ContextType {
  Poll: typeof Poll;
  pubsub: PubSub;
  log: (info: GraphQLResolveInfo) => void;
  logSub: (action: string, name: string) => void;
}
