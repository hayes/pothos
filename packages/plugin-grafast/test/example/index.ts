/* eslint-disable @typescript-eslint/restrict-plus-operands */
import '../../src';
import { createServer } from 'node:http';
import { constant, each, lambda, loadMany, loadOne } from 'grafast';
import { grafserv } from 'grafserv/dist/servers/node';
import { resolvePresets } from 'graphile-config';
import { defaultFieldResolver } from 'graphql';
import SchemaBuilder from '@pothos/core';
import { UserRow } from './business-logic';
import { friendshipsByUserIdCallback, userByIdCallback } from './plans';

const builder = new SchemaBuilder<{
  Scalars: {};
  Context: {
    currentUserId: string;
  };
}>({
  plugins: ['grafast'],
});

builder.queryType({
  fields: (t) => ({
    addTwoNumbers: t.int({
      args: {
        a: t.arg.int({ required: true }),
        b: t.arg.int({ required: true }),
      },
      plan: (_, args) => {
        const $a = args.get('a');
        const $b = args.get('b');

        return lambda([$a, $b], ([a, b]) => a + b, true);
      },
      // Pothos currently requires a resolver when not using t.expose*
      // defaultFieldResolver is stripped out by Pothos if it is not wrapped by a plugin
      resolve: defaultFieldResolver as never,
    }),
    currentUser: t.field({
      type: User,
      extensions: {
        graphile: {
          plan: () => loadOne(constant(1), userByIdCallback),
        },
      },
      resolve: defaultFieldResolver as never,
    }),
  }),
});

const User = builder.objectRef<UserRow>('User');

User.implement({
  description: 'A user',
  fields: (t) => ({
    id: t.exposeID('id'),
    bio: t.exposeString('bio'),
    name: t.exposeString('full_name'),
    friends: t.field({
      type: [User],
      plan: ($user) => {
        const $friendships = loadMany($user.get('id'), friendshipsByUserIdCallback);

        const $friends = each($friendships, ($friendship) => {
          const $friendId = $friendship.get('friend_id');

          return loadOne($friendId, userByIdCallback);
        });
        return $friends;
      },
      resolve: defaultFieldResolver as never,
    }),
  }),
});

const schema = builder.toSchema({});

const resolvedPreset = resolvePresets([
  {
    grafast: {
      explain: true,
    },
  },
]);
const serv = grafserv(resolvedPreset /* this is redundant and will be removed */, {
  schema,
  resolvedPreset,
});

const server = createServer(serv.handler);

server.once('listening', () => {
  server.on('error', (e) => {
    console.error('Server raised an error:', e);
  });
  const address = server.address();
  if (typeof address === 'string') {
    console.log(`Server listening at ${address}`);
  } else if (address) {
    const host = address.family === 'IPv6' ? `[${address.address}]` : address.address;
    console.log(
      `Server listening on port ${address.port} at http://${host}:${address.port}/graphql`,
    );
  } else {
    console.error(`Could not determine server address`);
  }
});

server.listen(5678, '127.0.0.1');
