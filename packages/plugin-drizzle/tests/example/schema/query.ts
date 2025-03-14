import { builder } from '../builder';
import { db } from '../db';
import { User, Viewer } from './user';

builder.queryType({
  fields: (t) => ({
    me: t.withAuth({ loggedIn: true }).drizzleField({
      type: Viewer,
      resolve: (query, _root, _args, ctx) =>
        db.query.users.findFirst(
          query({
            where: {
              id: ctx.user.id,
            },
          }),
        ),
    }),
    user: t.drizzleField({
      type: 'users',
      args: {
        id: t.arg.globalID({ required: true, for: User }),
      },
      resolve: (query, _root, { id }) => {
        return db.query.users.findFirst(
          query({
            where: {
              id: id.id.id,
            },
          }),
        );
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
              id: id.id.id,
            },
          }),
        );
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
              id: id.id.id,
            },
          }),
        );
      },
    }),
  }),
});
