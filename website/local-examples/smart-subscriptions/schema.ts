// #region setup
import { EventEmitter } from 'node:events';
import SchemaBuilder from '@pothos/core';
import SmartSubscriptionsPlugin from '@pothos/plugin-smart-subscriptions';

export type Context = {
  listeners: Map<string, (value: unknown) => void>;
};

export const events = new EventEmitter();

const builder = new SchemaBuilder<{ Context: Context }>({
  plugins: [SmartSubscriptionsPlugin],
  smartSubscriptions: {
    debounceDelay: null,
    subscribe: (name, context, callback) => {
      const listener = (value: unknown) => callback(null, value);
      context.listeners.set(name, listener);
      events.on(name, listener);
    },
    unsubscribe: (name, context) => {
      const listener = context.listeners.get(name);
      if (listener) {
        events.off(name, listener);
        context.listeners.delete(name);
      }
    },
  },
});
// #endregion setup

// #region schema
type Poll = { id: string; question: string; votes: number };
const polls = new Map<string, Poll>([['1', { id: '1', question: 'Tea or coffee?', votes: 0 }]]);

const PollType = builder.objectRef<Poll>('Poll').implement({
  subscribe: (subscriptions, poll) => {
    subscriptions.register(`poll/${poll.id}`);
  },
  fields: (t) => ({
    id: t.exposeID('id'),
    question: t.exposeString('question'),
    votes: t.exposeInt('votes'),
  }),
});

builder.queryType({
  fields: (t) => ({
    polls: t.field({
      type: [PollType],
      smartSubscription: true,
      subscribe: (subscriptions) => {
        subscriptions.register('poll-added');
        subscriptions.register('poll-deleted');
      },
      resolve: () => [...polls.values()],
    }),
  }),
});

builder.subscriptionType();
export const schema = builder.toSchema();
// #endregion schema

// #region vote
export function vote(pollId: string) {
  const poll = polls.get(pollId);
  if (!poll) {
    throw new Error('Poll not found');
  }
  polls.set(pollId, { ...poll, votes: poll.votes + 1 });
  events.emit(`poll/${pollId}`, { kind: 'vote' });
}
// #endregion vote
