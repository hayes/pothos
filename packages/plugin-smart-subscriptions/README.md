# Smart subscriptions plugin

Turn a query field into a subscription that sends its initial result, then updates it when relevant
data changes. Fields and object types register event names as they resolve. When an event arrives,
the plugin re-executes the affected query and sends the new result.

Use field or object refetch options to update a smaller part of the result when the rest can be reused.

## Install

```package-install
npm install --save @pothos/plugin-smart-subscriptions
```

## Connect an event source

Provide callbacks that subscribe and unsubscribe by event name. This example uses an in-process
event emitter. The listener map belongs to one subscription operation's context, so cleaning up one
operation does not remove another operation's listeners.

```typescript
import { EventEmitter } from 'node:events';
import SchemaBuilder from '@pothos/core';
import SmartSubscriptionsPlugin from '@pothos/plugin-smart-subscriptions';

type Context = {
  listeners: Map<string, (value: unknown) => void>;
};

const events = new EventEmitter();

const builder = new SchemaBuilder<{ Context: Context }>({
  plugins: [SmartSubscriptionsPlugin],
  smartSubscriptions: {
    debounceDelay: 10,
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
```

Pass a fresh `{ listeners: new Map() }` context for each subscription operation. A distributed
application can connect the same callbacks to its shared event service instead. Call `callback`
with an error to report a source failure, or `callback(null, value)` for an event.

`debounceDelay: null` disables debouncing. Other values enable the plugin's default debounce
window; the current implementation does not use the supplied numeric value as a custom delay. Both `subscribe` and `unsubscribe` callbacks may return promises.

### Async iterator sources

If your event service already returns async iterators, use `subscribeOptionsFromIterator` as an
alternative to the manual callbacks. It manages each iterator's lifetime:

```typescript
import { subscribeOptionsFromIterator } from '@pothos/plugin-smart-subscriptions';

type IteratorContext = {
  eventsFor: (name: string) => AsyncIterableIterator<unknown>;
};

const iteratorBuilder = new SchemaBuilder<{ Context: IteratorContext }>({
  plugins: [SmartSubscriptionsPlugin],
  smartSubscriptions: {
    ...subscribeOptionsFromIterator((name, context) => context.eventsFor(name)),
  },
});
```

The examples below continue with the event-emitter builder.

## Define a smart subscription

The same `polls` field is available on `Query` and `Subscription`. Register collection events on the
field and per-poll events on the object type:

```typescript
type Poll = { id: string; question: string; votes: number };
const polls = new Map<string, Poll>([
  ['1', { id: '1', question: 'Tea or coffee?', votes: 0 }],
]);

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
const schema = builder.toSchema();
```

```graphql
subscription {
  polls {
    id
    question
    votes
  }
}
```

The subscription first sends the current polls. After updating stored data, emit the corresponding
event to send a new result:

```typescript
function vote(pollId: string) {
  const poll = polls.get(pollId);
  if (!poll) throw new Error('Poll not found');
  polls.set(pollId, { ...poll, votes: poll.votes + 1 });
  events.emit(`poll/${pollId}`, { kind: 'vote' });
}
```

Calling `vote('1')` updates `votes` in the next result. Adding or deleting a poll should emit
`poll-added` or `poll-deleted` after updating the map. Each execution registers the events for its
current results, and subscriptions that are no longer needed are removed.

## Refetch an object

Replace the `PollType` subscription callback with this version to load only the changed poll:

```typescript
subscribe: (subscriptions, poll) => {
  subscriptions.register(`poll/${poll.id}`, {
    refetch: () => {
      const current = polls.get(poll.id);
      if (!current) throw new Error('Poll not found');
      return current;
    },
  });
},
```

A type's registration also accepts `filter: (value) => boolean` to ignore events and
`invalidateCache: (value) => void` to clear a cached value before refetching. Event values are typed
as `unknown`; narrow them before reading properties.

## Refetch a field

A field can register its own event and set `canRefetch: true`. Replace the `votes` field above with:

```typescript
votes: t.int({
  canRefetch: true,
  subscribe: (subscriptions, poll) => {
    subscriptions.register(`poll/${poll.id}`);
  },
  resolve: (poll) => polls.get(poll.id)?.votes ?? 0,
}),
```

Remove the object-level registration when using this field-only alternative. The plugin can then
re-run `votes` without reloading the whole polls list. Field registrations support `filter` and
`invalidateCache`, just like type registrations; `canRefetch` reuses the field resolver instead of
taking a separate `refetch` callback.

## Limitations

Smart subscriptions do not support list fields implemented with async generators for `@stream`.
