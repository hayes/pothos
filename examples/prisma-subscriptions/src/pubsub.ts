import { createPubSub } from 'graphql-yoga';
import type { Post, User } from '../prisma/client';

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
  extends Record<string, [number | string, PubSubEvent] | [PubSubEvent]> {
  user: [number | string, PubSubUserEvent];
  post: [number | string, PubSubPostEvent];
  users: [PubSubUserEvent];
  posts: [PubSubPostEvent];
}

export const pubsub = createPubSub<PuSubEvents>({});
