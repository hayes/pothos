import { createPubSub } from 'graphql-yoga';
// eslint-disable-next-line import/no-relative-packages
import { Post, User } from '../prisma/client';

export enum MutationType {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  DELETED = 'DELETED',
}

export interface PubSubEvent {
  mutationType: MutationType;
}

export interface PubSubUserEvent extends PubSubEvent {
  user: User;
}

export interface PubSubPostEvent extends PubSubEvent {
  post: Post;
}

export interface PuSubEvents
  extends Record<string, [PubSubEvent] | [string | number, PubSubEvent]> {
  user: [string | number, PubSubUserEvent];
  post: [string | number, PubSubPostEvent];
  users: [PubSubUserEvent];
  posts: [PubSubPostEvent];
}

export const pubsub = createPubSub<PuSubEvents>({});
