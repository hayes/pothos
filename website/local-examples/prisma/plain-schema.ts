import SchemaBuilder from '@pothos/core';
import type { Post, PrismaClient, User } from './generated/client/client';

export function createPlainSchema(prisma: PrismaClient) {
  // #region plain-schema
  const builder = new SchemaBuilder({});
  const Author = builder.objectRef<User>('Author');
  const Article = builder.objectRef<Post>('Article');
  Author.implement({
    fields: (t) => ({
      name: t.exposeString('name'),
      posts: t.field({
        type: [Article],
        resolve: (author) =>
          prisma.post.findMany({
            where: { authorId: author.id, published: true },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          }),
      }),
    }),
  });
  Article.implement({
    fields: (t) => ({
      title: t.exposeString('title'),
      author: t.field({
        type: Author,
        resolve: (post) => prisma.user.findUniqueOrThrow({ where: { id: post.authorId } }),
      }),
    }),
  });
  builder.queryType({
    fields: (t) => ({
      author: t.field({
        type: Author,
        nullable: true,
        args: { id: t.arg.int({ required: true }) },
        resolve: (_root, args) => prisma.user.findUnique({ where: { id: args.id } }),
      }),
    }),
  });
  // #endregion plain-schema
  return builder.toSchema();
}
