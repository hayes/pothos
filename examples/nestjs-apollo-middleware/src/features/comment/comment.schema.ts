import { schemaBuilder } from 'src/graphql/schema.builder';
import { PostRepository } from '../post/post.repository';
import { PostSchema } from '../post/post.schema';
import { UserRepository } from '../user/user.repository';
import { UserSchema } from '../user/user.schema';
import type { Comment } from './comment.model';
import { CommentRepository } from './comment.repository';

export const CommentSchema = schemaBuilder.objectRef<Comment>('Comment');

CommentSchema.implement({
  fields: (t) => ({
    id: t.exposeID('id', { nullable: false }),
    comment: t.exposeString('comment', { nullable: false }),
    author: t.field({
      type: UserSchema,
      nullable: false,
      resolve: (comment, _args, ctx) => ctx.get(UserRepository).getUserById(comment.authorId)!,
    }),
    post: t.field({
      type: PostSchema,
      nullable: false,
      resolve: (comment, _args, ctx) => ctx.get(PostRepository).getPostById(comment.postId)!,
    }),
  }),
});

/**
 * Post#comments
 */
schemaBuilder.objectField(PostSchema, 'comments', (t) =>
  t.field({
    type: [CommentSchema],
    nullable: false,
    resolve: (post, _args, ctx) => ctx.get(CommentRepository).getCommentsByPostId(post.id),
  }),
);

/**
 * User#comments
 */
schemaBuilder.objectField(UserSchema, 'comments', (t) =>
  t.field({
    type: [CommentSchema],
    nullable: false,
    resolve: (user, _args, ctx) => ctx.get(CommentRepository).getCommentsByAuthorId(user.id),
  }),
);
