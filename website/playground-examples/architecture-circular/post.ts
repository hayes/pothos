// post.ts
import { builder } from './builder';
import { User, type UserShape } from './user';

export interface PostShape {
  title: string;
  author: UserShape;
}

export const Post = builder.objectRef<PostShape>('Post');

Post.implement({
  fields: (t) => ({
    title: t.exposeString('title'),
    author: t.expose('author', { type: User }),
  }),
});
