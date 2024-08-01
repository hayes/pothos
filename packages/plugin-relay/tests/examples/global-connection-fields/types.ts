import type { PubSub } from 'graphql-subscriptions';
import type { Poll } from './data';

export interface ContextType {
  Poll: typeof Poll;
  pubsub: PubSub;
}
