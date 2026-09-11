// user.ts
import { builder } from './builder';
import { Post, type PostShape } from './post';

export interface UserShape {
  name: string;
  posts: PostShape[];
}

export const User = builder.objectRef<UserShape>('User');

User.implement({
  fields: (t) => ({
    name: t.exposeString('name'),
    posts: t.expose('posts', { type: [Post] }),
  }),
});
