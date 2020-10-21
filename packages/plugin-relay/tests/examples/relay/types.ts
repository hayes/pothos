import { PubSub } from 'graphql-subscriptions';
import { Poll } from './data';

export interface ContextType {
  Poll: typeof Poll;
  pubsub: PubSub;
}
