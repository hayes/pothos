import { PubSub } from 'graphql-subscriptions';
import { Poll } from './data';

export type ContextType = {
  Poll: typeof Poll;
  pubsub: PubSub;
};
