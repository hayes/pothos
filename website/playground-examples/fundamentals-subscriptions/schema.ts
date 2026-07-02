import SchemaBuilder from '@pothos/core';

// A subscription needs a way to broadcast updates. The pattern here is
// a minimal async iterable — graphql-yoga, Apollo Server, and Mercurius
// all accept any AsyncIterableIterator from `subscribe`. In a real app
// you'd swap this for graphql-yoga's createPubSub, Redis pub/sub, etc.
const BEACONS = [
  'Amon Dîn',
  'Eilenach',
  'Nardol',
  'Erelas',
  'Min-Rimmon',
  'Calenhad',
  'Halifirien',
];

async function* lightBeacons(): AsyncIterableIterator<string> {
  for (const beacon of BEACONS) {
    yield beacon;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

const builder = new SchemaBuilder({});

builder.queryType({
  fields: (t) => ({
    watchtower: t.string({ resolve: () => 'Amon Dîn stands ready' }),
  }),
});

builder.subscriptionType({
  fields: (t) => ({
    beaconLit: t.string({
      description: 'Emits each beacon of Gondor as it is lit.',
      subscribe: () => lightBeacons(),
      resolve: (name) => name,
    }),
  }),
});

export const schema = builder.toSchema();
