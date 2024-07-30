import { builder } from '../builder';
import { db } from '../db';
import { Viewer } from './user';

builder.queryType({
  fields: (t) => ({
    me: t.withAuth({ loggedIn: true }).drizzleField({
      type: Viewer,
      resolve: (query, root, args, ctx) =>
        db.query.users.findFirst({
          ...query,
          where: (user, { eq }) => eq(user.id, ctx.user.id),
        }),
    }),
  }),
});
