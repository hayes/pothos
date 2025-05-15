import { schemaBuilder } from 'src/graphql/schema.builder';
import { UserRepository } from '../user/user.repository';
import { UserSchema } from '../user/user.schema';
import type { Post } from './post.model';
import { PostRepository } from './post.repository';

export const PostSchema = schemaBuilder.objectRef<Post>('Post');

PostSchema.implement({
  fields: (t) => ({
    id: t.exposeID('id', { nullable: false }),
    title: t.exposeString('title', { nullable: false }),
    content: t.exposeString('content', { nullable: false }),
    author: t.field({
      type: UserSchema,
      nullable: false,
      resolve: (post, _args, ctx) => ctx.get(UserRepository).getUserById(post.authorId)!,
    }),
  }),
});

/**
 * Query#post
 * Query#posts
 */
schemaBuilder.queryType({
  fields: (t) => ({
    post: t.field({
      type: PostSchema,
      args: {
        id: t.arg.id({ required: true }),
      },
      resolve: (_root, args, ctx) => ctx.get(PostRepository).getPostById(args.id),
    }),
    posts: t.field({
      type: [PostSchema],
      nullable: false,
      args: {
        take: t.arg.int({ defaultValue: 10, required: true }),
        skip: t.arg.int({ defaultValue: 0, required: true }),
      },
      resolve: (_root, args, ctx) => ctx.get(PostRepository).getPosts(args.skip, args.take),
    }),
  }),
});

/**
 * User#posts
 */
schemaBuilder.objectField(UserSchema, 'posts', (t) =>
  t.field({
    type: [PostSchema],
    nullable: false,
    resolve: (user, _args, ctx) => ctx.get(PostRepository).getPostsByAuthorId(user.id),
  }),
);
