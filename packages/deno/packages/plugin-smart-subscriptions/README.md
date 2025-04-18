# Smart Subscriptions Plugin for Pothos

This plugin provides a way of turning queries into GraphQL subscriptions. Each field, Object, and
Interface in a schema can define subscriptions to be registered when that field or type is used in a
smart subscription.

The basic flow of a smart subscription is:

1. Run the query the smart subscription is based on and push the initial result of that query to the
   subscription

2. As the query is resolved, register any subscriptions defined on fields or types that where used
   in the query

3. When any of the subscriptions are triggered, re-execute the query and push the updated data to
   the subscription.

There are additional options which will allow only the sub-tree of a field/type that triggered a
fetch to re-resolved.

This pattern makes it easy to define subscriptions without having to worry about what parts of your
schema are accessible via the subscribe query, since any type or field can register a subscription.

## Usage

### Install

```package-install
npm install --save @pothos/plugin-smart-subscriptions
```

### Setup

```typescript
import SchemaBuilder from '@pothos/core';
import SmartSubscriptionsPlugin from '@pothos/plugin-smart-subscriptions';

const builder = new SchemaBuilder({
  plugins: [SmartSubscriptionsPlugin],
  smartSubscriptions: {
    debounceDelay: number | null;
    subscribe: (
      name: string,
      context: Context,
      cb: (err: unknown, data?: unknown) => void,
    ) => Promise<void> | void;
    unsubscribe: (name: string, context: Context) => Promise<void> | void;
  },
});
```

#### Helper for usage with async iterators

```typescript
const builder = new SchemaBuilder({
  smartSubscriptions: {
    ...subscribeOptionsFromIterator((name, { pubsub }) => {
      return pubsub.asyncIterableIterator(name);
    }),
  },
});
```

### Creating a smart subscription

```typescript
builder.queryFields((t) => ({
  polls: t.field({
    type: ['Poll'],
    smartSubscription: true,
    subscribe: (subscriptions, root, args, ctx, info) => {
      subscriptions.register('poll-added')
      subscriptions.register('poll-deleted')
    },
    resolve: (root, args, ctx, info) => {
      return ctx.getThings();
    },
  }),
})
```

Adding `smartSubscription: true` to a query field creates a field of the same name on the
`Subscriptions` type. The `subscribe` option is optional, and shows how a field can register a
subscription.

This would be queried as:

```graphql
subscription {
  polls {
    question
    answers {
      id
      value
    }
  }
}
```

### registering subscriptions for objects

```typescript
builder.objectType('Poll', {
  subscribe: (subscriptions, poll, context) => {
    subscriptions.register(`poll/${poll.id}`)
  },
  fields: (t) => ({
    question: t.exposeString('question', {}),
    answers: t.field({...}),
  }),
});
```

This will create a new subscription for every `Poll` that is returned in the subscription. When the
query is updated to fetch a new set of results because a subscription event fired, the subscribe
call will be called again for each poll in the new result set.

#### more options

```typescript
builder.objectType('Poll', {
  subscribe: (subscriptions, poll, context) => {
    subscriptions.register(`poll/${poll.id}`, {
      filter: (value) => true | false,
      invalidateCache: (value) => context.PollCache.remove(poll.id),
      refetch: ():  => context.Polls.fetchByID(poll.id)!),
    });
  },
  fields: (t) => ({
    ...
  }),
});
```

Passing a `filter` function will filter the events, any only cause a re-fetch if it returns true.

`invalidateCache` is called before refetching data, to allow any cache invalidation to happen so
that when the new data is loaded, results are not stale.

`refetch` enables directly refetching the current object. When refetch is provided and a
subscription event fires for the current object, or any of its children, other parts of the query
that are not dependents of this object will no be refetched.

### registering subscriptions for fields

```typescript
builder.objectType('Poll', {
  fields: (t) => ({
    question: t.exposeString('question', {}),
    answers: t.field({
      type: ['Answer'],
      subscribe: (subscriptions, poll) => subscriptions.register(`poll-answers/${poll.id}`),
      resolve: (parent, args, context, info) => {
        return parent.answers;
      },
    }),
  }),
});
```

#### more options for fields

```typescript
builder.objectType('Poll', {
  fields: (t) => ({
    question: t.exposeString('question', {}),
    answers: t.field({
      type: ['Answer'],
      canRefetch: true,
      subscribe: (subscriptions, poll) =>
        subscriptions.register(`poll-answers/${poll.id}`, {
          filter: (value) => true | false,
          invalidateCache: (value) => context.PollCache.remove(poll.id),
        }),
      resolve: (parent, args, context, info) => {
        return parent.answers;
      },
    }),
  }),
});
```

Similar to subscriptions on objects, fields can pass `filter` and `invalidateCache` functions when
registering a subscription. Rather than passing a `refetch` function, you can set `canRefetch` to
`true` in the field options. This will re-run the current resolve function to update it \(and it's
children\) without having to re-run the rest of the query.

### Known limitations

- Currently value passed to `filter` and `invalidateCache` is typed as `unknown`. This should be
  improved in the future.
- Does not work with list fields implemented with async-generators (used for `@stream` queries)
