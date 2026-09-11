import { builder } from './builder';
import { User, type UserShape } from './user';

export interface PostShape {
  title: string;
  author: UserShape;
}

export const Post = builder.objectRef<PostShape>('Post');

// #region fields
builder.objectType(Post, {
  fields: (t) => ({ title: t.exposeString('title') }),
});

builder.objectField(Post, 'author', (t) => t.expose('author', { type: User }));
// #endregion fields
