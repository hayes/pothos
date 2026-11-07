// `t.prismaField` loads from `collection`, which defaults to the type's, shaped by `query`, or takes
// `resolve`, which gets the type's collection with the selection planned and returns the rows it
// reads or writes.
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import WithInputPlugin from '@pothos/plugin-with-input';
import type { SqliteClient } from '@prisma/orm-sqlite/runtime';
import type { GraphQLResolveInfo } from 'graphql';
import { expectTypeOf } from 'vitest';
import PrismaNextPlugin, {
  type CollectionFor,
  type PlannedCollection,
  type PlannedRowBrand,
} from '../../src';
import type { Contract } from '../fixtures/sample-contract';
import type { Contract as InheritanceContract } from '../inheritance/contract';

interface Context {
  db: SqliteClient<Contract>;
  userId: string;
}
type Types = PothosSchemaTypes.ExtendDefaultTypes<{
  PrismaNextContract: Contract;
  Context: Context;
}>;

const builder = new SchemaBuilder<{ PrismaNextContract: Contract; Context: Context }>({
  plugins: [WithInputPlugin, RelayPlugin, PrismaNextPlugin],
  relay: {},
  prismaNext: { client: null as never },
});
builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
const Post = builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });

builder.queryType({
  fields: (t) => ({
    // `collection` returns the collection to load from.
    me: t.prismaField({
      type: 'User',
      args: { id: t.arg.id({ required: true }) },
      collection: (root, args, ctx, info) => {
        expectTypeOf(root).toEqualTypeOf<{}>();
        expectTypeOf(args.id).toEqualTypeOf<string>();
        expectTypeOf(ctx).toEqualTypeOf<Context>();
        expectTypeOf(info).toEqualTypeOf<GraphQLResolveInfo>();
        return ctx.db.orm.User.where({ id: ctx.userId });
      },
    }),
    // `resolve` gets the model's collection with the selection planned.
    user: t.prismaField({
      type: 'User',
      nullable: true,
      args: { id: t.arg.id({ required: true }) },
      resolve: (users, root, args, ctx, info) => {
        expectTypeOf(users).toEqualTypeOf<PlannedCollection<CollectionFor<Types, 'User'>>>();
        expectTypeOf(root).toEqualTypeOf<{}>();
        expectTypeOf(args.id).toEqualTypeOf<string>();
        expectTypeOf(ctx).toEqualTypeOf<Context>();
        expectTypeOf(info).toEqualTypeOf<GraphQLResolveInfo>();
        return users.where({ id: String(args.id) }).first();
      },
    }),
    users: t.prismaField({ type: ['User'], resolve: (users) => users.all() }),
    posts: t.prismaField({ type: [Post], resolve: (posts) => posts.all() }),
    // `first()` can find no row, so the field must be nullable.
    firstUser: t.prismaField({
      type: 'User',
      nullable: false,
      // @ts-expect-error the field isn't nullable
      resolve: (users) => users.first(),
    }),
    // @ts-expect-error a list field returns a list
    oneUser: t.prismaField({ type: ['User'], resolve: (users) => users.firstOrThrow() }),
    wrongModel: t.prismaField({
      type: ['User'],
      // @ts-expect-error rows of another model
      resolve: (_users, _r, _a, ctx) => ctx.db.orm.Post.all(),
    }),
    // A list loads every row of the type's collection without options.
    allUsers: t.prismaField({ type: ['User'] }),
    // `query` shapes the type's collection, as a to-many relation's does.
    byId: t.prismaField({
      type: 'User',
      nullable: true,
      args: { id: t.arg.id({ required: true }) },
      query: (args, ctx) => {
        expectTypeOf(args.id).toEqualTypeOf<string>();
        expectTypeOf(ctx).toEqualTypeOf<Context>();
        return { where: { id: String(args.id) } };
      },
    }),
    latestPosts: t.prismaField({
      type: [Post],
      query: { where: { published: 1 }, orderBy: { createdAt: 'desc' }, limit: 10, offset: 5 },
    }),
    predicate: t.prismaField({
      type: ['Post'],
      query: () => ({ where: (post) => post.published.eq(1) }),
    }),
    // `query` shapes the rows of `collection` too.
    myPosts: t.prismaField({
      type: ['Post'],
      collection: (_root, _args, ctx) => ctx.db.orm.Post.where({ authorId: ctx.userId }),
      query: { orderBy: { createdAt: 'desc' }, limit: 5 },
    }),
    badWhere: t.prismaField({
      type: ['User'],
      // @ts-expect-error not a column of User
      query: { where: { nope: 1 } },
    }),
    badWhereCallback: t.prismaField({
      type: ['User'],
      // @ts-expect-error not a column of User
      query: () => ({ where: { nope: 1 } }),
    }),
    badOrderBy: t.prismaField({
      type: ['User'],
      // @ts-expect-error not a column of User
      query: () => ({ orderBy: { email: 'asc', nope: 'asc' } }),
    }),
    unknownOption: t.prismaField({
      type: ['User'],
      // @ts-expect-error `take` isn't a query option
      query: () => ({ limit: 1, take: 1 }),
    }),
  }),
});

builder.mutationType({
  fields: (t) => ({
    createUser: t.prismaField({
      type: 'User',
      args: { email: t.arg.string({ required: true }) },
      resolve: (users, _root, args) =>
        users.create({ id: 'u', firstName: 'A', lastName: 'B', email: args.email }),
    }),
    createUsers: t.prismaField({
      type: ['User'],
      resolve: (users) => users.createAll([{ id: 'u', firstName: 'A', lastName: 'B', email: 'e' }]),
    }),
    renameUser: t.prismaField({
      type: 'User',
      nullable: true,
      resolve: (users) => users.where({ id: 'u' }).update({ firstName: 'C' }),
    }),
    upsertUser: t.prismaField({
      type: 'User',
      resolve: (users) =>
        users.upsert({
          create: { id: 'u', firstName: 'A', lastName: 'B', email: 'e' },
          update: { firstName: 'A' },
        }),
    }),
    deleteUser: t.prismaField({
      type: 'User',
      nullable: true,
      resolve: (users) => users.where({ id: 'u' }).delete(),
    }),
    // A row the ORM writes without the planned collection lacks the planned-row brand.
    unplanned: t.prismaField({
      type: 'User',
      // @ts-expect-error the rows must come from the planned collection
      resolve: (_users, _root, _args, ctx) =>
        ctx.db.orm.User.create({ id: 'u', firstName: 'A', lastName: 'B', email: 'e' }),
    }),
    // @ts-expect-error `collection` and `resolve` can't both be set
    both: t.prismaField({
      type: 'User',
      collection: (_root, _args, ctx) => ctx.db.orm.User,
      resolve: (users) => users.firstOrThrow(),
    }),
    // @ts-expect-error a single-row field needs `collection`, `query` or `resolve`
    neither: t.prismaField({ type: 'User' }),
    // @ts-expect-error an undefined option sets nothing
    undefinedQuery: t.prismaField({ type: 'User', query: undefined }),
    // @ts-expect-error `query` and `resolve` can't both be set
    queryAndResolve: t.prismaField({
      type: 'User',
      query: { where: { id: 'u' } },
      resolve: (users) => users.firstOrThrow(),
    }),
    withInputQuery: t.prismaFieldWithInput({
      type: 'User',
      nullable: true,
      input: { id: t.input.id({ required: true }) },
      collection: (_root, args, ctx) => {
        expectTypeOf(args.input.id).toEqualTypeOf<string>();
        return ctx.db.orm.User.where({ id: String(args.input.id) });
      },
    }),
    withInputResolve: t.prismaFieldWithInput({
      type: 'User',
      nullable: true,
      input: { firstName: t.input.string({ required: true }) },
      resolve: (users, _root, args, ctx) => {
        expectTypeOf(args.input.firstName).toEqualTypeOf<string>();
        return users.where({ id: ctx.userId }).update({ firstName: args.input.firstName });
      },
    }),
    // @ts-expect-error `collection` and `resolve` can't both be set
    withInputBoth: t.prismaFieldWithInput({
      type: 'User',
      input: { id: t.input.id({ required: true }) },
      collection: (_root, _args, ctx) => ctx.db.orm.User,
      resolve: (users) => users.firstOrThrow(),
    }),
  }),
});

// A variant type's `resolve` gets the base's collection narrowed to the variant.
const inheritance = new SchemaBuilder<{ PrismaNextContract: InheritanceContract }>({
  plugins: [RelayPlugin, PrismaNextPlugin],
  relay: {},
  prismaNext: { client: null as never },
});
const task = inheritance.prismaInterface('Task', { fields: (t) => ({ id: t.exposeID('id') }) });
inheritance.prismaObject('Bug', { interfaces: [task], fields: (t) => ({ id: t.exposeID('id') }) });
inheritance.prismaObject('Feature', {
  interfaces: [task],
  fields: (t) => ({ id: t.exposeID('id') }),
});
inheritance.queryType({
  fields: (t) => ({
    bugs: t.prismaField({
      type: ['Bug'],
      resolve: async (bugs) => {
        const bug = await bugs.firstOrThrow();
        expectTypeOf(bug.type).toEqualTypeOf<'bug'>();
        expectTypeOf(bug.severity).toEqualTypeOf<string>();
        expectTypeOf(bug).toExtend<PlannedRowBrand<'Bug'>>();
        return bugs.all();
      },
    }),
    tasks: t.prismaField({ type: ['Task'], resolve: (tasks) => tasks.all() }),
    allBugs: t.prismaField({ type: ['Bug'] }),
    // @ts-expect-error rows of another variant
    features: t.prismaField({ type: ['Feature'], resolve: (_bugs) => bugRows }),
  }),
});
declare const bugRows: Promise<{ id: string; type: 'bug' }[] & PlannedRowBrand<'Bug'>[]>;
