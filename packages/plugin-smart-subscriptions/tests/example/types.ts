import { GraphQLResolveInfo } from 'graphql';
import { PubSub } from 'graphql-subscriptions';
import { Poll } from './data';

export interface ContextType {
  Poll: typeof Poll;
  pubsub: PubSub;
  log: (info: GraphQLResolveInfo) => void;
  logSub: (action: string, name: string) => void;
}
