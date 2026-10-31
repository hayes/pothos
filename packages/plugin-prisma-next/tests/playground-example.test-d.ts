// Guards the types the website's Prisma ORM 8 playground example relies on for completions and
// diagnostics (website/playground-examples/plugin-prisma-next). The fields below mirror that example;
// the sample contract has the same User and Post columns and relations. (The example's own contract
// resolves the website's peer variant of the ORM, so it can't be imported here.)
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { expectTypeOf } from 'vitest';
import prismaNextPlugin, {
  type CollectionFor,
  type CursorSpec,
  type ModelName,
  type RelationKeys,
  type Row,
  type ToManyRelationKeys,
} from '../src';
import type { Contract } from './fixtures/sample-contract';

type Types = PothosSchemaTypes.ExtendDefaultTypes<{ PrismaNextContract: Contract }>;

const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [RelayPlugin, prismaNextPlugin],
  prismaNext: { contract: null as never },
});

declare const db: {
  orm: {
    User: CollectionFor<Types, 'User'>;
    Post: CollectionFor<Types, 'Post'>;
  };
};

// The unions editors offer for model, relation and cursor arguments.
expectTypeOf<ModelName<Types>>().toEqualTypeOf<'User' | 'Post' | 'Comment'>();
expectTypeOf<RelationKeys<Types, 'User'>>().toEqualTypeOf<'posts' | 'comments'>();
expectTypeOf<RelationKeys<Types, 'Post'>>().toEqualTypeOf<'author' | 'comments'>();
expectTypeOf<ToManyRelationKeys<Types, 'User'>>().toEqualTypeOf<'posts' | 'comments'>();
expectTypeOf<ToManyRelationKeys<Types, 'Post'>>().toEqualTypeOf<'comments'>();
expectTypeOf<Row<Types, 'User'>>().toEqualTypeOf<{
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}>();
expectTypeOf<'id'>().toExtend<CursorSpec<Types, 'Post'>>();
expectTypeOf<'nope'>().not.toExtend<CursorSpec<Types, 'Post'>>();

// @ts-expect-error not a model in the contract
builder.prismaObject('Tag', { fields: () => ({}) });

builder.prismaObject('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    author: t.relation('author'),
    // @ts-expect-error not a column of Post
    body: t.exposeString('body'),
    // @ts-expect-error not a relation of Post
    tags: t.relation('tags'),
  }),
});

builder.prismaObject('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
    fullName: t.string({
      select: ['firstName', 'lastName'],
      resolve: (user) => {
        expectTypeOf(user.firstName).toEqualTypeOf<string>();
        // @ts-expect-error email isn't selected by this field, so it may not be loaded
        return user.email;
      },
    }),
    badSelect: t.string({
      // @ts-expect-error not a column of User
      select: ['nickname'],
      resolve: () => '',
    }),
    posts: t.relation('posts', {
      query: { where: { published: 1 }, orderBy: (post) => post.id.asc() },
    }),
    badQuery: t.relation('posts', {
      // @ts-expect-error not a column of Post
      query: { where: { draft: 1 } },
    }),
    postConnection: t.relatedConnection('posts', {
      cursor: 'id',
      where: { published: 1 },
      totalCount: true,
    }),
    missingCursor:
      // @ts-expect-error a connection requires a cursor
      t.relatedConnection('posts', { totalCount: true }),
    badCursor: t.relatedConnection('posts', {
      // @ts-expect-error not a column of Post
      cursor: 'slug',
    }),
    paginatedWhere: t.relatedConnection('posts', {
      cursor: 'id',
      // @ts-expect-error cursor pagination owns limit
      limit: 2,
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    users: t.prismaField({
      type: ['User'],
      resolve: () => db.orm.User.orderBy((user) => user.id.asc()),
    }),
    posts: t.prismaConnection({
      type: 'Post',
      cursor: 'id',
      totalCount: true,
      args: { newestFirst: t.arg.boolean() },
      orderBy: (post, args) => {
        expectTypeOf(args.newestFirst).toEqualTypeOf<boolean | null | undefined>();
        return args.newestFirst ? post.id.desc() : post.id.asc();
      },
      resolve: () => db.orm.Post.where({ published: 1 }),
    }),
    wrongModel: t.prismaField({
      type: ['User'],
      // @ts-expect-error a Post collection can't resolve User rows
      resolve: () => db.orm.Post,
    }),
    materialized: t.prismaField({
      type: ['User'],
      // @ts-expect-error rows must be returned as an unexecuted Collection
      resolve: () => db.orm.User.all(),
    }),
    unknownType: t.prismaConnection({
      // @ts-expect-error not a model in the contract
      type: 'Tag',
      cursor: 'id',
      resolve: () => db.orm.Post,
    }),
  }),
});
