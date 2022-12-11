import builder, { prisma } from '../builder';
import { PrismaCrudGenerator } from '../generator';

const generator = new PrismaCrudGenerator(builder);

builder.scalarType('DateTime', {
  serialize: (value) => value.toISOString(),
  parseValue: (value) => (typeof value === 'number' ? new Date(value) : new Date(String(value))),
});

builder.queryType({
  fields: (t) => ({
    posts: t.prismaField({
      type: ['Post'],
      args: generator.findManyArgs('Post'),
      resolve: (query, _, args) =>
        prisma.post.findMany({
          ...query,
          where: args.filter ?? undefined,
          orderBy: args.orderBy ?? undefined,
          take: 3,
        }),
    }),
  }),
});

builder.mutationType({
  fields: (t) => ({
    createUser: t.prismaField({
      type: 'User',
      args: { input: t.arg({ type: generator.getCreateInput('User'), required: true }) },
      resolve: (query, _, args) =>
        prisma.user.create({
          ...query,
          data: {
            ...args.input,
          },
        }),
    }),
    updateUser: t.prismaField({
      type: 'User',
      args: {
        where: t.arg({ type: generator.getWhereUnique('User'), required: true }),
        data: t.arg({ type: generator.getUpdateInput('User'), required: true }),
      },
      resolve: (query, _, args) =>
        prisma.user.update({
          ...query,
          where: {
            ...args.where,
          },
          data: {
            ...args.data,
          },
        }),
    }),
  }),
});

builder.prismaObject('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
    author: t.relation('author'),
    comments: t.relation('comments', {
      args: generator.findManyArgs('Comment'),
      query: (args) => ({
        where: args.filter ?? undefined,
        orderBy: args.orderBy ?? undefined,
        take: 2,
      }),
    }),
  }),
});

builder.prismaObject('Comment', {
  fields: (t) => ({
    id: t.exposeID('id'),
    content: t.exposeString('content'),
    author: t.relation('author'),
    post: t.relation('post'),
  }),
});

builder.prismaObject('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name', { nullable: true }),
    email: t.exposeString('email'),
    comments: t.relation('comments'),
    posts: t.relation('posts', {
      args: generator.findManyArgs('Post'),
      query: (args) => ({
        where: args.filter ?? undefined,
        orderBy: args.orderBy ?? undefined,
        take: 2,
      }),
    }),
  }),
});

export default builder.toSchema();
