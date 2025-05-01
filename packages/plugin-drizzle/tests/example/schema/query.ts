import { builder } from '../builder';
import { db } from '../db';
import { User, Viewer } from './user';

builder.queryType({
  fields: (t) => ({
    me: t.withAuth({ loggedIn: true }).drizzleField({
      type: Viewer,
      resolve: async (query, _root, _args, ctx) => {
        const q = query({
          where: {
            id: ctx.user.id,
          },
        });
        console.dir(q, { depth: null });
        const user = await db.query.users.findFirst(q);

        return user;
      },
    }),
    user: t.drizzleField({
      type: 'users',
      args: {
        id: t.arg.globalID({ required: true, for: User }),
      },
      resolve: (query, _root, { id }) => {
        const q = query({
          where: {
            id: id.id,
          },
        });
        // console.dir(q, { depth: null });
        return db.query.users.findFirst(q);
      },
    }),
    users: t.drizzleField({
      type: ['users'],
      args: {
        id: t.arg.globalID({ required: true, for: User }),
      },
      resolve: (query, _root, { id }) => {
        return db.query.users.findMany(
          query({
            where: {
              id: id.id,
            },
          }),
        );
      },
    }),
    usersConnection: t.drizzleConnection({
      type: 'users',
      resolve: (query) => {
        const q = query();
        // console.dir(q, { depth: null });
        return db.query.users.findMany(q);
      },
    }),
    userWithInput: t.drizzleFieldWithInput({
      type: 'users',
      input: {
        id: t.input.globalID({ required: true, for: User }),
      },
      resolve: (query, _root, { input: { id } }) => {
        return db.query.users.findFirst(
          query({
            where: {
              id: id.id,
            },
          }),
        );
      },
    }),
  }),
});
