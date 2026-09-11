// schema.ts
import { builder } from './builder';
import { User, type UserShape } from './user';
import './post';

const user: UserShape = { name: 'Alex', posts: [] };
user.posts.push({ title: 'First post', author: user });

builder.queryType({
  fields: (t) => ({
    user: t.field({ type: User, resolve: () => user }),
  }),
});

export const schema = builder.toSchema();
