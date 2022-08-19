import e, { Post, User } from '../../client';
import { db } from '../db';
import builder from '../builder';

const PostPreview = builder.objectRef<Post>('PostPreview');
PostPreview.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    preview: t.string({
      nullable: true,
      resolve: (post) => post.content?.slice(10),
    }),
  }),
});

const UserRef = builder.objectRef<User>('ExplicitEdgeDBUser');
UserRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
    name: t.exposeString('name', { nullable: true }),
  }),
});

builder.edgeDBObject('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    content: t.exposeString('content', { nullable: true }),
    published: t.exposeBoolean('published'),
    createdAt: t.expose('created_at', { type: 'DateTime' }),
    author: t.link('author'),
  }),
});

builder.edgeDBObject('User', {
  fields: (t) => ({
    email: t.exposeString('email'),
    name: t.exposeString('name', { nullable: true }),
    posts: t.link('posts'),
  }),
});

builder.queryType({
  fields: (t) => ({
    me: t.field({
      type: UserRef,
      nullable: true,
      // Temporarily since `User` doesnt have the links defined yet.
      // @ts-ignore
      resolve: async (root, args, ctx, info) => {
        const user = await e
          .select(e.User, (user) => ({
            id: true,
            email: true,
            name: true,
            filter: e.op(user.id, '=', e.uuid(ctx.user.id)),
          }))
          .run(db);

        return user;
      },
    }),
  }),
});

export default builder.toSchema({});
