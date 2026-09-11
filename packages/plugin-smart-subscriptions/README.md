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
export function vote(pollId: string) {
  const poll = polls.get(pollId);
  if (!poll) {
    throw new Error('Poll not found');
  }
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

## Run a live subscription locally

The browser playground runs queries and mutations; it does not consume subscription iterators.
The [complete local example](https://github.com/hayes/pothos/tree/main/website/local-examples/smart-subscriptions)
uses GraphQL's `subscribe()` with the schema and event source above. No database or external event
service is required.

With Node.js 22 or newer, run from a checkout of the [Pothos repository](https://github.com/hayes/pothos):

```bash
pnpm install --frozen-lockfile
pnpm --dir website check:local
```

The local examples use the checkout's built Pothos packages. Their separate locked installation
uses GraphQL 16, as required by Grafast 1.0; it does not change the repository's GraphQL version.

`smart-subscriptions/check.ts` opens two subscriptions with separate contexts, checks their initial
results, calls `vote('1')`, and checks both updates. It closes the first iterator and verifies that
the second still receives events, then closes the second and verifies that no listeners remain.
To change the example, adjust the poll's starting votes in `schema.ts` and update the expected results.

When using this schema in a server, pass a new listener map for each operation and arrange for the
transport to close its iterator on disconnect. The local check makes that lifecycle explicit:

```typescript

const result = await subscribe({
  schema,
  document: parse('subscription { polls { id votes } }'),
  contextValue: { listeners: new Map() },
});

if (Symbol.asyncIterator in result) {
  const iterator = result[Symbol.asyncIterator]();
  try {
    console.log((await iterator.next()).value); // Initial polls
    const update = iterator.next();
    vote('1');
    console.log((await update).value); // Incremented votes
  } finally {
    await iterator.return?.(); // Unsubscribe this operation's listeners
  }
} else {
  console.error(result.errors);
}
```
