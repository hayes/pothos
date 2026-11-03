import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import type { PostgresClient } from '@prisma/orm-postgres/runtime';
import type { GraphQLResolveInfo } from 'graphql';
import { expectTypeOf } from 'vitest';
import prismaNextPlugin, {
  type CollectionFor,
  type ConnectionHelperRow,
  type ConnectionOrderBy,
  type ConnectionQueryLiteral,
  type PlannedRow,
  type NodeSelection,
  prismaConnectionHelpers,
} from '../../src';
import type { TotalCountFlag } from '../../src/types/aggregates';
import type { Contract } from '../fixtures/sample-contract';
import type { Contract as MysqlContract } from '../mysql/contract';
import type { Contract as PostgresContract } from '../postgres/contract';

type Types = PothosSchemaTypes.ExtendDefaultTypes<{ PrismaNextContract: Contract }>;
declare const orm: { User: CollectionFor<Types, 'User'>; Post: CollectionFor<Types, 'Post'> };

const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [RelayPlugin, prismaNextPlugin],
  relay: {},
  prismaNext: { client: null as never },
});

const SummaryRef = builder.prismaObject('Post', {
  name: 'PostSummary',
  fields: (t) => ({ title: t.exposeString('title') }),
});

builder.prismaObject('User', {
  select: ['email'],
  fields: (t) => ({
    posts: t.relatedConnection('posts', {
      type: SummaryRef,
      args: { newest: t.arg.boolean() },
      orderBy: (args, _ctx) => {
        expectTypeOf(args.newest).toEqualTypeOf<boolean | null | undefined>();
        return { title: args.newest ? 'desc' : 'asc' };
      },
      query: (args) => ({ where: (post) => post.authorId.eq(args.newest ? 'me' : 'you') }),
      totalCount: (user) => user.email.length,
    }),
    published: t.relatedConnection('posts', { query: { where: { published: 1 } } }),
    defaultOrder: t.relatedConnection('posts', {}),
    pair: t.relatedConnection('posts', { orderBy: { title: 'desc', id: 'desc' } }),
    notACondition: t.relatedConnection('posts', {
      // @ts-expect-error a where callback returns a condition
      query: { where: () => 42 },
    }),
    unknownQueryKey: t.relatedConnection('posts', {
      // @ts-expect-error the connection args own the page size
      query: { where: { published: 1 }, limit: 5 },
    }),
    orderInQuery: t.relatedConnection('posts', {
      // @ts-expect-error the order is the connection's `orderBy`
      query: { orderBy: (post) => post.title.desc() },
    }),
    unknownCallbackKey: t.relatedConnection('posts', {
      // @ts-expect-error unknown query options are rejected in a callback's result too
      query: () => ({ where: { published: 1 }, take: 1 }),
    }),
    limitBesideWhereInCallback: t.relatedConnection('posts', {
      // @ts-expect-error the connection args own the page size
      query: () => ({ where: { published: 1 }, limit: 1 }),
    }),
    limitInCallback: t.relatedConnection('posts', {
      // @ts-expect-error the connection args own the page size
      query: () => ({ limit: 1 }),
    }),
    noQueryFromCallback: t.relatedConnection('posts', {
      args: { published: t.arg.int() },
      query: (args) =>
        args.published == null ? undefined : { where: { published: args.published } },
    }),
    alwaysUndefinedQuery: t.relatedConnection('posts', { query: () => undefined }),
    asyncQuery: t.relatedConnection('posts', {
      // @ts-expect-error a connection's query is planned synchronously
      query: async () => ({ where: { published: 1 } }),
    }),
    topLevelWhere: t.relatedConnection('posts', {
      // @ts-expect-error filters go in `query`
      where: { published: 1 },
    }),
    cursor: t.relatedConnection('posts', {
      // @ts-expect-error `orderBy` replaced `cursor`
      cursor: 'id',
    }),
    limit: t.relatedConnection('posts', {
      // @ts-expect-error the connection args own the page size
      limit: 5,
    }),
    resolver: t.relatedConnection('posts', {
      // @ts-expect-error the plugin owns the resolver
      resolve: () => [],
    }),
    excess: t.relatedConnection('posts', {
      // @ts-expect-error unknown option
      orderByy: { id: 'asc' },
    }),
    // A user-defined `totalCount` reads the count from the connection without a cast.
    counted: t.relatedConnection(
      'posts',
      { totalCount: true },
      {
        fields: (c) => ({
          totalCount: c.int({
            nullable: true,
            resolve: (page) => {
              expectTypeOf(page.totalCount).toEqualTypeOf<number | undefined>();
              expectTypeOf(page.parent.email).toEqualTypeOf<string>();
              return page.totalCount;
            },
          }),
        }),
      },
    ),
  }),
});

builder.prismaObject('Post', {
  fields: (t) => ({
    comments: t.relatedConnection('comments', {
      // @ts-expect-error a totalCount callback only sees declared columns
      totalCount: (post) => post.title.length,
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    ordered: t.prismaConnection({
      type: 'Post',
      args: { newest: t.arg.boolean() },
      orderBy: (args, context) => {
        expectTypeOf(context).not.toBeAny();
        return args.newest ? { title: 'desc', id: 'asc' } : { title: 'asc' };
      },
      resolve: () => orm.Post,
    }),
    nullsFirst: t.prismaConnection({
      type: 'Post',
      orderBy: { score: { nulls: 'first' } },
      resolve: () => orm.Post,
    }),
    nullable: t.prismaConnection({
      type: 'Post',
      nullable: true,
      resolve: () => null,
    }),
    required: t.prismaConnection({
      type: 'Post',
      nullable: false,
      // @ts-expect-error the field isn't nullable
      resolve: () => null,
    }),
    defaultOrder: t.prismaConnection({ type: 'Post', resolve: () => orm.Post }),
    // @ts-expect-error a connection's type is one model's type, not a list
    list: t.prismaConnection({ type: ['Post'], resolve: () => orm.Post }),
    query: t.prismaConnection({
      type: 'User',
      // @ts-expect-error `query` (plugin-prisma's shape) isn't supported
      query: () => ({ where: {} }),
      resolve: () => orm.User,
    }),
    edgesNullable: t.prismaConnection({
      type: 'User',
      // @ts-expect-error edges are always non-null
      edgesNullable: true,
      resolve: () => orm.User,
    }),
    unknownType: t.prismaConnection({
      // @ts-expect-error not a model in the contract
      type: 'Tag',
      resolve: () => orm.Post,
    }),
    counted: t.prismaConnection(
      { type: 'Post', totalCount: true, resolve: () => orm.Post },
      {
        fields: (c) => ({
          totalCount: c.int({ nullable: true, resolve: (page) => page.totalCount }),
          first: c.int({ nullable: true, resolve: (page) => page.args.first }),
        }),
      },
    ),
  }),
});

// Temporal columns order with the client's codecs; bytes columns can't order a connection.
declare const client: PostgresClient<PostgresContract>;
const postgres = new SchemaBuilder<{ PrismaNextContract: PostgresContract }>({
  plugins: [RelayPlugin, prismaNextPlugin],
  relay: {},
  prismaNext: { client },
});
postgres.queryType({
  fields: (t) => ({
    temporal: t.prismaConnection({
      type: 'Entry',
      orderBy: { createdAt: 'desc', id: 'asc' },
      resolve: () => client.orm.public.Entry,
    }),
    bytes: t.prismaConnection({
      type: 'Entry',
      // @ts-expect-error a bytes column can't order a connection
      orderBy: { payload: 'asc' },
      resolve: () => client.orm.public.Entry,
    }),
  }),
});

// `orderBy` is a declaration: a direction per column, or `{ direction, nulls }`.
builder.queryFields((t) => ({
  unknownColumn: t.prismaConnection({
    type: 'Post',
    // @ts-expect-error `nope` isn't a column of Post
    orderBy: { nope: 'asc' },
    resolve: () => orm.Post,
  }),
  unknownBesideKnown: t.prismaConnection({
    type: 'Post',
    // @ts-expect-error `titel` isn't a column of Post
    orderBy: { title: 'asc', titel: 'asc' },
    resolve: () => orm.Post,
  }),
  unknownFromCallback: t.prismaConnection({
    type: 'Post',
    // @ts-expect-error a callback's result is checked as well
    orderBy: () => ({ title: 'asc', titel: 'asc' }),
    resolve: () => orm.Post,
  }),
  unknownInBranch: t.prismaConnection({
    type: 'Post',
    args: { newest: t.arg.boolean() },
    // @ts-expect-error every branch is checked
    orderBy: (args) => (args.newest ? { titel: 'desc' } : { title: 'asc' }),
    resolve: () => orm.Post,
  }),
  unknownBesideKeyInBranch: t.prismaConnection({
    type: 'Post',
    args: { newest: t.arg.boolean() },
    // @ts-expect-error every branch is checked, even one that also names a real column
    orderBy: (args) => (args.newest ? { titel: 'desc', id: 'asc' } : { title: 'asc' }),
    resolve: () => orm.Post,
  }),
  badDirection: t.prismaConnection({
    type: 'Post',
    // @ts-expect-error a direction is `asc` or `desc`
    orderBy: { title: 'sideways' },
    resolve: () => orm.Post,
  }),
  badEntryKey: t.prismaConnection({
    type: 'Post',
    // @ts-expect-error an entry takes `direction` and `nulls`
    orderBy: { title: { dir: 'asc' } },
    resolve: () => orm.Post,
  }),
  nullsOnRequired: t.prismaConnection({
    type: 'Post',
    // @ts-expect-error a non-null column has no nulls to place
    orderBy: { title: { direction: 'desc', nulls: 'first' } },
    resolve: () => orm.Post,
  }),
  nullsOnRequiredFromCallback: t.prismaConnection({
    type: 'Post',
    // @ts-expect-error a callback's result is checked as well
    orderBy: () => ({ id: { nulls: 'last' } }),
    resolve: () => orm.Post,
  }),
  // A computed key widens to `string`, which is checked when the request runs.
  computed: t.prismaConnection({
    type: 'Post',
    args: { sort: t.arg.string({ required: true }) },
    orderBy: (args) => ({ [args.sort]: 'desc' }),
    resolve: () => orm.Post,
  }),
  accessor: t.prismaConnection({
    type: 'Post',
    // @ts-expect-error `orderBy` takes a declaration, not the ORM's accessor callback
    orderBy: () => (post: { id: { asc(): unknown } }) => post.id.asc(),
    resolve: () => orm.Post,
  }),
}));

expectTypeOf<ConnectionQueryLiteral<Types, 'Post'>>().toHaveProperty('where');
expectTypeOf<ConnectionOrderBy<Types, 'Post'>>().toHaveProperty('title');
// `nulls` on a non-null column names the problem instead of failing against `undefined`.
expectTypeOf<
  Extract<NonNullable<ConnectionOrderBy<Types, 'Post'>['title']>, object>['nulls']
>().toEqualTypeOf<
  (('first' | 'last') & { readonly 'A non-null column has no nulls to place': 'title' }) | undefined
>();
expectTypeOf<
  Extract<NonNullable<ConnectionOrderBy<Types, 'Post'>['score']>, object>['nulls']
>().toEqualTypeOf<'first' | 'last' | undefined>();
// `totalCount: true` on a target without aggregates, such as MySQL, names the problem.
type MysqlTypes = PothosSchemaTypes.ExtendDefaultTypes<{ PrismaNextContract: MysqlContract }>;
// `toEqualTypeOf` on `TotalCountFlag` crashes TypeScript 7.0's checker, so its parts are checked.
expectTypeOf<true>().not.toExtend<TotalCountFlag<MysqlTypes>>();
expectTypeOf<false>().toExtend<TotalCountFlag<MysqlTypes>>();
expectTypeOf<Extract<TotalCountFlag<MysqlTypes>, true>>().toHaveProperty(
  'totalCount: true runs a count aggregate, which this target (MySQL) lacks. Pass a callback',
);
// Bytes columns aren't orderable, so they aren't keys of the declaration.
type EntryTypes = PothosSchemaTypes.ExtendDefaultTypes<{ PrismaNextContract: PostgresContract }>;
expectTypeOf<
  'payload' extends keyof ConnectionOrderBy<EntryTypes, 'Entry'> ? 1 : 0
>().toEqualTypeOf<0>();

// prismaConnectionHelpers options: refs, `query`, and callbacks that see the field's args.
const UserNode = builder.prismaInterface('User', {
  name: 'UserNode',
  fields: (t) => ({ id: t.exposeID('id') }),
});
const byInterface = prismaConnectionHelpers(builder, UserNode, {});
expectTypeOf(byInterface.ref).toEqualTypeOf(UserNode);
const byObject = prismaConnectionHelpers(builder, SummaryRef, {});
expectTypeOf(byObject.ref).toEqualTypeOf(SummaryRef);
prismaConnectionHelpers(builder, 'User', {
  args: (t) => ({ q: t.string(), size: t.int() }),
  orderBy: (args) => (args.q ? { firstName: 'desc', id: 'asc' } : undefined),
  defaultSize: (args) => args.size ?? 10,
  maxSize: (args, _ctx) => (args.q ? 5 : 50),
  totalCount: true,
  query: (args) => ({
    where: (user, tools) => {
      expectTypeOf(tools).not.toBeAny();
      return args.q ? user.firstName.eq(args.q) : user.id.neq('');
    },
  }),
});
prismaConnectionHelpers(builder, 'User', {
  // @ts-expect-error a where callback returns a condition
  query: { where: () => 'oops' },
});
prismaConnectionHelpers(builder, 'User', {
  // @ts-expect-error unknown query options are rejected in a callback's result too
  query: () => ({ where: { id: 'x' }, take: 1 }),
});
prismaConnectionHelpers(builder, 'User', {
  // @ts-expect-error unknown query options are rejected in an object too
  query: { where: { id: 'x' }, take: 1 },
});
prismaConnectionHelpers(builder, 'User', { query: () => undefined });
prismaConnectionHelpers(builder, 'User', {
  // @ts-expect-error a connection's query is planned synchronously
  query: async () => ({ where: { id: 'x' } }),
});
prismaConnectionHelpers(builder, 'User', {
  args: (t) => ({ q: t.string() }),
  query: (args) => (args.q ? { where: { firstName: args.q } } : undefined),
});
prismaConnectionHelpers(builder, 'User', {
  // @ts-expect-error not a column of User
  orderBy: { slug: 'asc' },
});
prismaConnectionHelpers(builder, 'User', {
  // @ts-expect-error filters go in `query`
  where: { id: 'u' },
});
prismaConnectionHelpers(builder, 'User', {
  // @ts-expect-error a custom count is passed to `wrap` or `resolve`
  totalCount: () => 1,
});

// prismaConnectionHelpers: `resolveNode` decides the node shape; cursors still read the rows.
// Without `info` the rows are whole. With it, and from `page`, they hold their key and what the
// selection needs, typed as `PlannedRow`, unless `resolveNode` gets them without a relation
// given `nodeSelection()`: nothing is planned into them then, and they are whole.
declare const info: GraphQLResolveInfo;
export async function helperShapes() {
  const wrapper = prismaConnectionHelpers(builder, 'User', {
    resolveNode: (user) => ({ user }),
  });
  const page = await wrapper.applyPagination(orm.User, { first: 1 }, {});
  // @ts-expect-error a collection with its own select would leave out the ordered columns
  wrapper.applyPagination(orm.User.select('id'), { first: 1 }, {});
  const result = page.wrap(await page.collection.all());
  expectTypeOf(result.edges[0]!.node.user.id).toEqualTypeOf<string>();
  expectTypeOf(result.edges[0]!.node.user.email).toEqualTypeOf<string>();
  expectTypeOf(result.edges[0]!.cursor).toEqualTypeOf<string>();
  // @ts-expect-error `node` is the wrapper, not the row
  result.edges[0]!.node.id;

  const union = prismaConnectionHelpers(builder, 'User', {
    resolveNode: (user): { kind: 'user'; user: typeof user } | { kind: 'empty' } =>
      user.firstName ? { kind: 'user', user } : { kind: 'empty' },
  });
  const unionPage = await union.applyPagination(orm.User, { first: 1 }, {});
  expectTypeOf(unionPage.wrap(await unionPage.collection.all()).edges[0]!.node.kind).toEqualTypeOf<
    'user' | 'empty'
  >();

  const plain = prismaConnectionHelpers(builder, 'User', {
    query: { where: (user) => user.firstName.eq('Alice') },
  });
  const loaded = await plain.applyPagination(orm.User, { first: 1 }, {});
  expectTypeOf(
    loaded.wrap(await loaded.collection.all()).edges[0]!.node.email,
  ).toEqualTypeOf<string>();
  // @ts-expect-error without `info` the collection loads whole rows, so `wrap` takes them
  loaded.wrap([{ id: 'a', firstName: 'Alice' }]);
  const planned = await plain.applyPagination(orm.User, { first: 1 }, {}, info);
  const plannedRows = await planned.collection.all();
  expectTypeOf(plannedRows[0]!.id).toEqualTypeOf<string>();
  expectTypeOf(plannedRows[0]!.email).toEqualTypeOf<string | undefined>();
  expectTypeOf(planned.wrap(plannedRows).edges[0]!.node).toEqualTypeOf<PlannedRow<Types, 'User'>>();
  // @ts-expect-error a hand-built row isn't one the loader planned
  planned.wrap([{ id: 'a', firstName: 'Alice' }]);

  const spreading = prismaConnectionHelpers(builder, 'User', {
    resolveNode: (user) => ({ ...user, extra: 1 }),
  });
  const spreadPage = await spreading.applyPagination(orm.User, { first: 1 }, {}, info);
  const full = spreadPage.wrap(await spreadPage.collection.all());
  expectTypeOf(full.edges[0]!.node.extra).toEqualTypeOf<number>();
  expectTypeOf(full.edges[0]!.node.email).toEqualTypeOf<string>();

  const enabled = Math.random() > 0.5;
  const conditional = prismaConnectionHelpers(builder, 'User', {
    resolveNode: enabled ? (user) => ({ user }) : undefined,
  });
  const conditionalPage = await conditional.applyPagination(orm.User, {}, {});
  const node = conditionalPage.wrap(await conditionalPage.collection.all()).edges[0]!.node;
  // @ts-expect-error the transform may not have run
  node.user;
  if ('user' in node) {
    expectTypeOf(node.user.id).toEqualTypeOf<string>();
  } else {
    expectTypeOf(node.id).toEqualTypeOf<string>();
  }

  const primitive = prismaConnectionHelpers(builder, 'User', {
    resolveNode: (user) => user.id,
  });
  const primitivePage = await primitive.applyPagination(orm.User, {}, {});
  expectTypeOf(
    primitivePage.wrap(await primitivePage.collection.all()).edges[0]!.node,
  ).toEqualTypeOf<string>();

  const promised = prismaConnectionHelpers(builder, 'User', {
    resolveNode: (user) => Promise.resolve({ user }),
  });
  const promisedPage = await promised.applyPagination(orm.User, {}, {});
  const promisedNode = promisedPage.wrap(await promisedPage.collection.all()).edges[0]!.node;
  expectTypeOf((await promisedNode).user.id).toEqualTypeOf<string>();
}

// prismaConnectionHelpers through a join model: `select` names the relation holding the nodes,
// and `page` loads the connection in a field's `select`.
const Commenter = builder.prismaObject('User', {
  variant: 'Commenter',
  fields: (t) => ({ id: t.exposeID('id') }),
});
const commenters = prismaConnectionHelpers(builder, 'Comment', {
  select: (nodeSelection) => ({ body: true, author: nodeSelection() }),
  resolveNode: (comment) => {
    expectTypeOf(comment.body).toEqualTypeOf<string>();
    expectTypeOf(comment.author).toEqualTypeOf<PlannedRow<Types, 'User'>>();
    return comment.author;
  },
});
builder.prismaObjectField('Post', 'commenters', (t) =>
  t.connection({
    type: Commenter,
    select: { comments: commenters.page },
    resolve: (post, args, ctx) => {
      expectTypeOf(post.comments).toEqualTypeOf<
        readonly ConnectionHelperRow<Types, 'Comment', { body: true; author: NodeSelection }>[]
      >();
      return commenters.resolve(post.comments, args, ctx, post);
    },
  }),
);
builder.prismaObjectField('Post', 'commentersById', (t) =>
  t.connection({
    type: Commenter,
    // @ts-expect-error the page is of Comment rows, not of a relation to another model
    select: { views: commenters.page },
    resolve: () => null as never,
  }),
);
builder.prismaObject('Post', {
  variant: 'PostWithPagedComments',
  // @ts-expect-error a page loads for a field's connection, not with every row of a type
  select: { comments: commenters.page },
  fields: () => ({}),
});
prismaConnectionHelpers(builder, 'Post', {
  // @ts-expect-error a to-many relation can't hold the nodes
  select: (nodeSelection) => ({ author: true, comments: nodeSelection() }),
});
prismaConnectionHelpers(builder, 'Comment', {
  // @ts-expect-error not a column or relation of Comment
  select: () => ({ bodyy: true }),
});

// Without `nullable`, root fields and connections follow the builder's default field nullability.
const nonNullBuilder = new SchemaBuilder<{
  PrismaNextContract: Contract;
  DefaultFieldNullability: false;
}>({
  plugins: [RelayPlugin, prismaNextPlugin],
  relay: {},
  defaultFieldNullability: false,
  prismaNext: { client: null as never },
});
nonNullBuilder.queryType({
  fields: (t) => {
    const user = t.prismaField({ type: 'User', resolve: () => orm.User });
    expectTypeOf<null extends typeof user.$inferType ? true : false>().toEqualTypeOf<false>();
    const posts = t.prismaConnection({ type: 'Post', resolve: () => orm.Post });
    expectTypeOf(posts.$inferType.edges).not.toBeUnknown();
    expectTypeOf<null extends typeof posts.$inferType ? true : false>().toEqualTypeOf<false>();
    return {
      user,
      posts,
      // @ts-expect-error the field is non-null by default
      nullUser: t.prismaField({ type: 'User', resolve: () => null }),
      nullableUser: t.prismaField({ type: 'User', nullable: true, resolve: () => null }),
      // @ts-expect-error the connection is non-null by default
      nullPosts: t.prismaConnection({ type: 'Post', resolve: () => null }),
      nullablePosts: t.prismaConnection({
        type: 'Post',
        nullable: true,
        resolve: () => null,
      }),
    };
  },
});
builder.queryFields((t) => {
  // Fields are nullable by default.
  const user = t.prismaField({ type: 'User', resolve: () => null });
  expectTypeOf<null extends typeof user.$inferType ? true : false>().toEqualTypeOf<true>();
  return { nullableByDefault: user };
});

// `totalCount` reads the same parent as `resolve`: a type's select narrows it, a subscription's
// is what `subscribe` yields, and on Query it is the root.
builder.prismaObject('User', {
  name: 'TotalCountUser',
  select: ['firstName'],
  fields: (t) => ({
    narrowed: t.prismaConnection({
      type: 'Post',
      totalCount: (user) => user.firstName.length,
      resolve: () => orm.Post,
    }),
    unselected: t.prismaConnection({
      type: 'Post',
      // @ts-expect-error `email` is not in the type's select
      totalCount: (user) => user.email.length,
      resolve: () => orm.Post,
    }),
  }),
});

builder.prismaObject('User', {
  name: 'TotalCountAllColumnsUser',
  fields: (t) => ({
    noSelect: t.prismaConnection({
      type: 'Post',
      totalCount: (user) => user.id.length,
      resolve: () => orm.Post,
    }),
  }),
});

builder.queryField('totalCountOnQuery', (t) =>
  t.prismaConnection({
    type: 'Post',
    totalCount: (root) => {
      expectTypeOf(root).toEqualTypeOf<{}>();

      return 0;
    },
    resolve: () => orm.Post,
  }),
);

declare const counts: AsyncIterable<number>;
builder.subscriptionField('totalCountOnSubscription', (t) =>
  t.prismaConnection({
    type: 'Post',
    subscribe: () => counts,
    totalCount: (count) => {
      expectTypeOf(count).toEqualTypeOf<number>();

      return count;
    },
    resolve: () => orm.Post,
  }),
);

// The helpers' `connectionOptions` types a `fields` callback, so it needs no annotation.
const counted = prismaConnectionHelpers(builder, 'User', { totalCount: true });
builder.queryField('countedUsers', (t) =>
  t.connection(
    {
      type: counted.ref,
      resolve: async (_root, args, ctx) => {
        const { collection, totalCountPromise, wrap } = await counted.applyPagination(
          orm.User,
          args,
          ctx,
        );
        return wrap(await collection.all(), await totalCountPromise);
      },
    },
    counted.connectionOptions({
      fields: (c) => ({
        doubled: c.int({
          nullable: true,
          resolve: (page) => {
            expectTypeOf(page.totalCount).toEqualTypeOf<number | undefined>();
            return page.totalCount === undefined ? null : page.totalCount * 2;
          },
        }),
      }),
    }),
  ),
);
