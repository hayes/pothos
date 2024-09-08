import { and, count, eq, sql } from 'drizzle-orm';
import { builder } from '../builder';
import { db } from '../db';
import { categories, comments, postLikes, posts } from '../db/schema';
import { Comment } from './comment';

const Post = builder.drizzleObject('posts', {
  name: 'Post',
  select: {
    columns: {
      id: true,
    },
  },
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    content: t.exposeString('content'),
    author: t.relation('author'),
    category: t.string({
      select: {
        with: {
          category: true,
        },
      },
      resolve: (post) => post.category?.name,
    }),
    createdAt: t.field({
      select: {
        columns: {
          createdAt: true,
        },
      },
      type: 'DateTime',
      resolve: (post) => new Date(post.createdAt),
    }),
    updatedAt: t.field({
      type: 'DateTime',
      select: {
        columns: {
          updatedAt: true,
        },
      },
      resolve: (post) => new Date(post.updatedAt),
    }),
    published: t.boolean({
      select: {
        columns: {
          published: true,
        },
      },
      resolve: (post) => !!post.published,
    }),
    comments: t.relation('comments'),
    likes: t.int({
      resolve: async (post) => {
        const result = await db
          .select({ count: count() })
          .from(postLikes)
          .where(eq(postLikes.postId, post.id!));

        return result[0].count ?? 0;
      },
    }),
    likesConnection: t.relatedConnection('likes', {}),
  }),
});

builder.drizzleObject('postLikes', {
  select: {
    columns: {},
  },
  fields: (t) => ({
    post: t.relation('post'),
    user: t.relation('user'),
  }),
});

builder.queryFields((t) => ({
  post: t.drizzleField({
    type: 'posts',
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: (query, _root, args) =>
      db.query.posts.findFirst(
        query({
          orderBy: (post, ops) => ops.desc(post.id),
          where: eq(posts.id, Number.parseInt(args.id, 10)),
        }),
      ),
  }),
  posts: t.drizzleConnection({
    type: 'posts',
    args: {
      category: t.arg.string(),
    },
    resolve: (query, _root, args) =>
      db.query.posts.findMany(
        query({
          where: (post, { inArray }) =>
            and(
              eq(post.published, 1),
              args.category
                ? inArray(
                    post.categoryId,
                    db
                      .select({ id: categories.id })
                      .from(categories)
                      .where(args.category ? eq(categories.name, args.category) : undefined),
                  )
                : undefined,
            ),
          orderBy: (post) => ({ desc: post.id }),
        }),
      ),
  }),
}));

builder.mutationFields((t) => ({
  likePost: t.withAuth({ loggedIn: true }).drizzleField({
    type: 'posts',
    args: {
      postId: t.arg.id({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const postId = Number.parseInt(args.postId, 10);
      await db
        .insert(postLikes)
        .values({
          postId,
          userId: ctx.user.id,
        })
        .onConflictDoNothing();
      return db.query.posts.findFirst(
        query({
          where: eq(posts.id, postId),
        }),
      );
    },
  }),
  commentOnPost: t.withAuth({ loggedIn: true }).fieldWithInput({
    type: Comment,
    input: {
      postId: t.input.id({ required: true }),
      text: t.input.string({ required: true }),
    },
    resolve: async (_root, { input }, ctx) => {
      const result = await db
        .insert(comments)
        .values([
          {
            postId: Number.parseInt(input.postId, 10),
            authorId: ctx.user.id,
            text: input.text,
          },
        ])
        .returning();
      return result[0];
    },
  }),
  createPost: t.withAuth({ role: 'author' }).fieldWithInput({
    type: Post,
    input: {
      title: t.input.string({ required: true }),
      content: t.input.string({ required: true }),
      category: t.input.string({ required: true }),
      published: t.input.boolean(),
    },
    resolve: async (_root, { input }, ctx) => {
      const result = await db
        .insert(posts)
        .values([
          {
            title: input.title,
            content: input.content,
            authorId: ctx.user.id,
            categoryId: sql<number>`(select id from categories where name = ${input.category})`,
            published: input.published ? 1 : 0,
          },
        ])
        .returning();
      return result[0];
    },
  }),
  publishPost: t.withAuth({ role: 'author' }).drizzleField({
    type: 'posts',
    args: {
      postId: t.arg.id({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const postId = Number.parseInt(args.postId, 10);
      await db
        .update(posts)
        .set({
          published: 1,
        })
        .where(and(eq(posts.id, postId), eq(posts.authorId, ctx.user.id)));
      return db.query.posts.findFirst(
        query({
          where: eq(posts.id, postId),
        }),
      );
    },
  }),
}));
