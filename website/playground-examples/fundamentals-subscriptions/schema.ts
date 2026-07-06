import SchemaBuilder from '@pothos/core';

// A subscription needs a way to broadcast updates. The pattern here is
// a minimal async iterable — graphql-yoga, Apollo Server, and Mercurius
// all accept any AsyncIterableIterator from `subscribe`. In a real app
// you'd swap this for graphql-yoga's createPubSub, Redis pub/sub, etc.
const RECENT_ENTRIES = [
  'Frodo Baggins',
  'Samwise Gamgee',
  'Aragorn',
  'Gandalf',
  'Legolas',
  'Gimli',
  'Boromir',
];

async function* publishEntries(): AsyncIterableIterator<string> {
  for (const name of RECENT_ENTRIES) {
    yield name;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

const builder = new SchemaBuilder({});

builder.queryType({
  fields: (t) => ({
    characterCount: t.int({ resolve: () => RECENT_ENTRIES.length }),
  }),
});

// #region character-added-subscription
builder.subscriptionType({
  fields: (t) => ({
    characterAdded: t.string({
      description: 'Emits each character entry as it is published.',
      subscribe: () => publishEntries(),
      resolve: (name) => name,
    }),
  }),
});
// #endregion character-added-subscription

export const schema = builder.toSchema();
