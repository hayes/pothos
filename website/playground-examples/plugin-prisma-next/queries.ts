import { builder } from './builder';
import { db } from './database';

builder.queryType({
  fields: (t) => ({
    users: t.prismaField({
      type: ['User'],
      resolve: () => db.orm.User.orderBy((user) => user.id.asc()),
    }),
    posts: t.prismaConnection({
      type: 'Post',
      cursor: 'id',
      totalCount: true,
      resolve: () => db.orm.Post.where({ published: 1 }),
    }),
  }),
});
