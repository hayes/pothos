import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import type { PostgresClient } from '@prisma/orm-postgres/runtime';
import { expectTypeOf } from 'vitest';
import PrismaNextPlugin, {
  type CollectionFor,
  type ConnectionHelperRow,
  type ConnectionQueryLiteral,
  type NodeSelection,
  type PlannedRow,
  prismaConnectionHelpers,
  type RelationOrderBy,
} from '../../src';
import type { TotalCountFlag } from '../../src/types/aggregates';
import type { Contract } from '../fixtures/sample-contract';
import type { Contract as MysqlContract } from '../mysql/contract';
import type { Contract as PostgresContract } from '../postgres/contract';

type Types = PothosSchemaTypes.ExtendDefaultTypes<{ PrismaNextContract: Contract }>;
declare const orm: {
  User: CollectionFor<Types, 'User'>;
  Post: CollectionFor<Types, 'Post'>;
  Comment: CollectionFor<Types, 'Comment'>;
};

const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [RelayPlugin, PrismaNextPlugin],
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
      query: (args, _ctx) => {
        expectTypeOf(args.newest).toEqualTypeOf<boolean | null | undefined>();
        return {
          where: (post) => post.authorId.eq(args.newest ? 'me' : 'you'),
          orderBy: { title: args.newest ? 'desc' : 'asc' },
        };
      },
      totalCount: (user) => user.email.length,
    }),
    published: t.relatedConnection('posts', { query: { where: { published: 1 } } }),
    defaultOrder: t.relatedConnection('posts', {}),
    noOptions: t.relatedConnection('posts'),
    pair: t.relatedConnection('posts', { query: { orderBy: { title: 'desc', id: 'desc' } } }),
    notACondition: t.relatedConnection('posts', {
      // @ts-expect-error a where callback returns a condition
      query: { where: () => 42 },
    }),
    unknownQueryKey: t.relatedConnection('posts', {
      // @ts-expect-error the connection args own the page size
      query: { where: { published: 1 }, limit: 5 },
    }),
    topLevelOrderBy: t.relatedConnection('posts', {
      // @ts-expect-error the order goes in `query`
      orderBy: { title: 'desc' },
    }),
    unknownOrderColumn: t.relatedConnection('posts', {
      // @ts-expect-error `titel` isn't a column of Post
      query: { where: { published: 1 }, orderBy: { title: 'asc', titel: 'asc' } },
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
      query: (args, context) => {
        expectTypeOf(context).not.toBeAny();
        return { orderBy: args.newest ? { title: 'desc', id: 'asc' } : { title: 'asc' } };
      },
      collection: () => orm.Post,
    }),
    nullsFirst: t.prismaConnection({
      type: 'Post',
      query: { orderBy: { score: { nulls: 'first' } } },
      collection: () => orm.Post,
    }),
    nullable: t.prismaConnection({
      type: 'Post',
      nullable: true,
      collection: () => null,
    }),
    required: t.prismaConnection({
      type: 'Post',
      nullable: false,
      // @ts-expect-error the field isn't nullable
      collection: () => null,
    }),
    defaultOrder: t.prismaConnection({ type: 'Post', collection: () => orm.Post }),
    // @ts-expect-error a connection's type is one model's type, not a list
    list: t.prismaConnection({ type: ['Post'], collection: () => orm.Post }),
    query: t.prismaConnection({
      type: 'User',
      query: () => ({ where: { email: 'a@example.com' } }),
      collection: () => orm.User,
    }),
    unknownQueryKey: t.prismaConnection({
      type: 'User',
      // @ts-expect-error the connection args own the page size
      query: { limit: 5 },
      collection: () => orm.User,
    }),
    edgesNullable: t.prismaConnection({
      type: 'User',
      // @ts-expect-error edges are always non-null
      edgesNullable: true,
      collection: () => orm.User,
    }),
    unknownType: t.prismaConnection({
      // @ts-expect-error not a model in the contract
      type: 'Tag',
      collection: () => orm.Post,
    }),
    counted: t.prismaConnection(
      { type: 'Post', totalCount: true, collection: () => orm.Post },
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
  plugins: [RelayPlugin, PrismaNextPlugin],
  relay: {},
  prismaNext: { client },
});
postgres.queryType({
  fields: (t) => ({
    temporal: t.prismaConnection({
      type: 'Entry',
      query: { orderBy: { createdAt: 'desc', id: 'asc' } },
      collection: () => client.orm.public.Entry,
    }),
    bytes: t.prismaConnection({
      type: 'Entry',
      // @ts-expect-error a bytes column can't order a connection
      query: { orderBy: { payload: 'asc' } },
      collection: () => client.orm.public.Entry,
    }),
  }),
});

// A query's `orderBy` is a declaration: a direction per column, or `{ direction, nulls }`.
builder.queryFields((t) => ({
  unknownColumn: t.prismaConnection({
    type: 'Post',
    // @ts-expect-error `nope` isn't a column of Post
    query: { orderBy: { nope: 'asc' } },
    collection: () => orm.Post,
  }),
  unknownBesideKnown: t.prismaConnection({
    type: 'Post',
    // @ts-expect-error `titel` isn't a column of Post
    query: { orderBy: { title: 'asc', titel: 'asc' } },
    collection: () => orm.Post,
  }),
  unknownFromCallback: t.prismaConnection({
    type: 'Post',
    // @ts-expect-error a callback's result is checked as well
    query: () => ({ orderBy: { title: 'asc', titel: 'asc' } }),
    collection: () => orm.Post,
  }),
  unknownInBranch: t.prismaConnection({
    type: 'Post',
    args: { newest: t.arg.boolean() },
    // @ts-expect-error every branch is checked
    query: (args) => ({ orderBy: args.newest ? { titel: 'desc' } : { title: 'asc' } }),
    collection: () => orm.Post,
  }),
  unknownBesideKeyInBranch: t.prismaConnection({
    type: 'Post',
    args: { newest: t.arg.boolean() },
    // @ts-expect-error every branch is checked, even one that also names a real column
    query: (args) => ({
      orderBy: args.newest ? { titel: 'desc', id: 'asc' } : { title: 'asc' },
    }),
    collection: () => orm.Post,
  }),
  badDirection: t.prismaConnection({
    type: 'Post',
    // @ts-expect-error a direction is `asc` or `desc`
    query: { orderBy: { title: 'sideways' } },
    collection: () => orm.Post,
  }),
  badEntryKey: t.prismaConnection({
    type: 'Post',
    // @ts-expect-error an entry takes `direction` and `nulls`
    query: { orderBy: { title: { dir: 'asc' } } },
    collection: () => orm.Post,
  }),
  nullsOnRequired: t.prismaConnection({
    type: 'Post',
    // @ts-expect-error a non-null column has no nulls to place
    query: { orderBy: { title: { direction: 'desc', nulls: 'first' } } },
    collection: () => orm.Post,
  }),
  nullsOnRequiredFromCallback: t.prismaConnection({
    type: 'Post',
    // @ts-expect-error a callback's result is checked as well
    query: () => ({ orderBy: { id: { nulls: 'last' } } }),
    collection: () => orm.Post,
  }),
  // A computed key widens to `string`, which is checked when the request runs.
  computed: t.prismaConnection({
    type: 'Post',
    args: { sort: t.arg.string({ required: true }) },
    query: (args) => ({ orderBy: { [args.sort]: 'desc' } }),
    collection: () => orm.Post,
  }),
  accessor: t.prismaConnection({
    type: 'Post',
    // @ts-expect-error `orderBy` takes a declaration, not the ORM's accessor callback
    query: { orderBy: (post: { id: { asc(): unknown } }) => post.id.asc() },
    collection: () => orm.Post,
  }),
}));

expectTypeOf<ConnectionQueryLiteral<Types, 'Post'>>().toHaveProperty('where');
expectTypeOf<RelationOrderBy<Types, 'Post'>>().toHaveProperty('title');
// `nulls` on a non-null column names the problem instead of failing against `undefined`.
expectTypeOf<
  Extract<NonNullable<RelationOrderBy<Types, 'Post'>['title']>, object>['nulls']
>().toEqualTypeOf<
  (('first' | 'last') & { readonly 'A non-null column has no nulls to place': 'title' }) | undefined
>();
expectTypeOf<
  Extract<NonNullable<RelationOrderBy<Types, 'Post'>['score']>, object>['nulls']
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
  'payload' extends keyof RelationOrderBy<EntryTypes, 'Entry'> ? 1 : 0
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
  defaultSize: (args) => args.size ?? 10,
  maxSize: (args, _ctx) => (args.q ? 5 : 50),
  totalCount: true,
  query: (args) => ({
    where: (user, tools) => {
      expectTypeOf(tools).not.toBeAny();
      return args.q ? user.firstName.eq(args.q) : user.id.neq('');
    },
    orderBy: args.q ? { firstName: 'desc', id: 'asc' } : undefined,
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
  // @ts-expect-error a custom count is a field of the connection
  totalCount: () => 1,
});

// prismaConnectionHelpers: `resolveNode` decides the node shape; cursors still read the rows.
// The rows hold their key and what the selection needs, typed as `PlannedRow`, unless
// `resolveNode` gets them without a relation given `nodeSelection()`: nothing is planned into them
// then, and they are whole.
type RowsOf<H> = H extends { resolve(rows: infer R, ...args: never[]): unknown } ? R : never;
export function helperShapes() {
  const wrapper = prismaConnectionHelpers(builder, 'User', {
    resolveNode: (user) => ({ user }),
  });
  const result = wrapper.resolve([] as RowsOf<typeof wrapper>, { first: 1 }, {});
  expectTypeOf(result.edges[0]!.node.user.id).toEqualTypeOf<string>();
  expectTypeOf(result.edges[0]!.node.user.email).toEqualTypeOf<string>();
  expectTypeOf(result.edges[0]!.cursor).toEqualTypeOf<string>();
  // @ts-expect-error `node` is the wrapper, not the row
  result.edges[0]!.node.id;

  const union = prismaConnectionHelpers(builder, 'User', {
    resolveNode: (user): { kind: 'user'; user: typeof user } | { kind: 'empty' } =>
      user.firstName ? { kind: 'user', user } : { kind: 'empty' },
  });
  expectTypeOf(union.resolve([] as RowsOf<typeof union>, {}, {}).edges[0]!.node.kind).toEqualTypeOf<
    'user' | 'empty'
  >();

  const plain = prismaConnectionHelpers(builder, 'User', {
    query: { where: (user) => user.firstName.eq('Alice') },
  });
  const plannedRows = [] as RowsOf<typeof plain>;
  expectTypeOf(plannedRows[0]!.id).toEqualTypeOf<string>();
  expectTypeOf(plannedRows[0]!.email).toEqualTypeOf<string | undefined>();
  const planned = plain.resolve(plannedRows, { first: 1 }, {});
  expectTypeOf(planned.edges[0]!.node).toEqualTypeOf<PlannedRow<Types, 'User'>>();
  // Without the `totalCount` option, the page has no count.
  expectTypeOf(planned.totalCount).toEqualTypeOf<number | undefined>();
  // @ts-expect-error a hand-built row isn't one the loader planned
  plain.resolve([{ id: 'a', firstName: 'Alice' }], {}, {});

  const spreading = prismaConnectionHelpers(builder, 'User', {
    resolveNode: (user) => ({ ...user, extra: 1 }),
  });
  const full = spreading.resolve([] as RowsOf<typeof spreading>, { first: 1 }, {});
  expectTypeOf(full.edges[0]!.node.extra).toEqualTypeOf<number>();
  expectTypeOf(full.edges[0]!.node.email).toEqualTypeOf<string>();

  const enabled = Math.random() > 0.5;
  const conditional = prismaConnectionHelpers(builder, 'User', {
    resolveNode: enabled ? (user) => ({ user }) : undefined,
  });
  const node = conditional.resolve([] as RowsOf<typeof conditional>, {}, {}).edges[0]!.node;
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
  expectTypeOf(
    primitive.resolve([] as RowsOf<typeof primitive>, {}, {}).edges[0]!.node,
  ).toEqualTypeOf<string>();

  // Only rows `getQuery` loaded hold a count.
  const counted = prismaConnectionHelpers(builder, 'User', { totalCount: true });
  expectTypeOf(counted.resolve([] as RowsOf<typeof counted>, {}, {}).totalCount).toEqualTypeOf<
    number | undefined
  >();
}

// prismaConnectionHelpers through a join model: `select` names the relation holding the nodes,
// and `getQuery` loads the connection in a field's select function.
const Commenter = builder.prismaObject('User', {
  variant: 'Commenter',
  fields: (t) => ({ id: t.exposeID('id') }),
});
const commenters = prismaConnectionHelpers(builder, 'Comment', {
  args: (t) => ({ withBody: t.boolean() }),
  select: (nodeSelection, args) => {
    expectTypeOf(args.withBody).toEqualTypeOf<boolean | null | undefined>();
    return { body: true, author: nodeSelection() };
  },
  resolveNode: (comment) => {
    expectTypeOf(comment.body).toEqualTypeOf<string>();
    expectTypeOf(comment.author).toEqualTypeOf<PlannedRow<Types, 'User'>>();
    return comment.author;
  },
});
builder.prismaObjectField('Post', 'commenters', (t) =>
  t.connection({
    type: Commenter,
    select: (args, ctx, nestedSelection) => ({
      comments: commenters.getQuery(args, ctx, nestedSelection),
    }),
    resolve: (post, args, ctx) => {
      expectTypeOf(post.comments).toEqualTypeOf<
        readonly ConnectionHelperRow<Types, 'Comment', { body: true; author: NodeSelection }>[]
      >();
      return commenters.resolve(post.comments, args, ctx);
    },
  }),
);
builder.prismaObjectField('Post', 'commentersById', (t) =>
  t.connection({
    type: Commenter,
    // @ts-expect-error the page is of Comment rows, not of a relation to another model
    select: (args, ctx, nestedSelection) => ({
      views: commenters.getQuery(args, ctx, nestedSelection),
    }),
    resolve: () => null as never,
  }),
);
builder.prismaObject('Post', {
  variant: 'PostWithPagedComments',
  // @ts-expect-error a page loads for a field's connection, not with every row of a type
  select: { comments: commenters.getQuery({}, {}, () => null) },
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

// At the root, `load` pages a collection of the helper's model, and each edge holds its row.
builder.queryField('commenters', (t) =>
  t.connection(
    {
      type: Commenter,
      resolve: async (_root, args, ctx, info) => {
        const rows = await commenters.load(orm.Comment.where({ postId: 'p' }), args, ctx, info);
        expectTypeOf(rows).toEqualTypeOf<
          ConnectionHelperRow<Types, 'Comment', { body: true; author: NodeSelection }>[]
        >();
        // @ts-expect-error the plugin includes what the query selects
        await commenters.load(orm.Comment.include('author'), args, ctx, info);
        const ordered = orm.Comment.orderBy((c) => c.id.asc());
        // @ts-expect-error the connection orders the collection by its query
        await commenters.load(ordered, args, ctx, info);
        // @ts-expect-error a collection of another model
        await commenters.load(orm.Post, args, ctx, info);
        return commenters.resolve(rows, args, ctx);
      },
    },
    {},
    {
      fields: (edge) => ({
        body: edge.string({
          resolve: (row) => {
            expectTypeOf(row.node).toEqualTypeOf<PlannedRow<Types, 'User'>>();
            return row.body;
          },
        }),
      }),
    },
  ),
);

// Without `nullable`, root fields and connections follow the builder's default field nullability.
const nonNullBuilder = new SchemaBuilder<{
  PrismaNextContract: Contract;
  DefaultFieldNullability: false;
}>({
  plugins: [RelayPlugin, PrismaNextPlugin],
  relay: {},
  defaultFieldNullability: false,
  prismaNext: { client: null as never },
});
nonNullBuilder.queryType({
  fields: (t) => {
    const user = t.prismaField({ type: 'User', collection: () => orm.User });
    expectTypeOf<null extends typeof user.$inferType ? true : false>().toEqualTypeOf<false>();
    const posts = t.prismaConnection({ type: 'Post', collection: () => orm.Post });
    expectTypeOf(posts.$inferType.edges).not.toBeUnknown();
    expectTypeOf<null extends typeof posts.$inferType ? true : false>().toEqualTypeOf<false>();
    return {
      user,
      posts,
      // @ts-expect-error the field is non-null by default
      nullUser: t.prismaField({ type: 'User', collection: () => null }),
      nullableUser: t.prismaField({ type: 'User', nullable: true, collection: () => null }),
      // @ts-expect-error the connection is non-null by default
      nullPosts: t.prismaConnection({ type: 'Post', collection: () => null }),
      nullablePosts: t.prismaConnection({
        type: 'Post',
        nullable: true,
        collection: () => null,
      }),
    };
  },
});
builder.queryFields((t) => {
  // Fields are nullable by default.
  const user = t.prismaField({ type: 'User', collection: () => null });
  expectTypeOf<null extends typeof user.$inferType ? true : false>().toEqualTypeOf<true>();
  return { nullableByDefault: user };
});

// `totalCount` reads the same parent as `collection`: a type's select narrows it, a subscription's
// is what `subscribe` yields, and on Query it is the root.
builder.prismaObject('User', {
  name: 'TotalCountUser',
  select: ['firstName'],
  fields: (t) => ({
    narrowed: t.prismaConnection({
      type: 'Post',
      totalCount: (user) => user.firstName.length,
      collection: () => orm.Post,
    }),
    unselected: t.prismaConnection({
      type: 'Post',
      // @ts-expect-error `email` is not in the type's select
      totalCount: (user) => user.email.length,
      collection: () => orm.Post,
    }),
  }),
});

builder.prismaObject('User', {
  name: 'TotalCountAllColumnsUser',
  fields: (t) => ({
    noSelect: t.prismaConnection({
      type: 'Post',
      totalCount: (user) => user.id.length,
      collection: () => orm.Post,
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
    collection: () => orm.Post,
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
    collection: () => orm.Post,
  }),
);

// The count a helper's `resolve` adds can be returned from a `totalCount` field on the connection.
const counted = prismaConnectionHelpers(builder, 'Post', { totalCount: true });
builder.prismaObjectField('User', 'countedPosts', (t) =>
  t.connection(
    {
      type: counted.ref,
      select: (args, ctx, nestedSelection) => ({
        posts: counted.getQuery(args, ctx, nestedSelection),
      }),
      resolve: (user, args, ctx) => counted.resolve(user.posts, args, ctx),
    },
    {
      fields: (c) => ({
        totalCount: c.int({
          resolve: (page) => {
            expectTypeOf(page.totalCount).toEqualTypeOf<number | undefined>();
            return page.totalCount;
          },
        }),
      }),
    },
  ),
);

// A connection orders and pages its collection itself, so `collection` can't return one that
// includes a relation or is ordered. A filtered one is fine, and without it the connection pages
// every row.
builder.queryFields((t) => ({
  everyPost: t.prismaConnection({ type: 'Post' }),
  // @ts-expect-error a connection's rows come from `collection`, not `resolve`
  resolvedPage: t.prismaConnection({ type: 'Post', resolve: () => orm.Post }),
  filteredPage: t.prismaConnection({
    type: 'Post',
    collection: () => orm.Post.where({ published: 1 }),
  }),
  asyncFilteredPage: t.prismaConnection({
    type: 'Post',
    collection: async () => orm.Post.where({ published: 1 }),
  }),
  includedPage: t.prismaConnection({
    type: 'Post',
    // @ts-expect-error `author` is already included
    collection: () => orm.Post.include('author'),
  }),
  orderedPage: t.prismaConnection({
    type: 'Post',
    // @ts-expect-error the connection orders the collection
    collection: () => orm.Post.orderBy((post) => post.title.asc()),
  }),
  asyncOrderedPage: t.prismaConnection({
    type: 'Post',
    nullable: true,
    // @ts-expect-error the connection orders the collection
    collection: async () => orm.Post.where({ published: 1 }).orderBy((post) => post.title.asc()),
  }),
}));
// A collection of another model is checked against the Post collection, so the error lists the
// Post columns its rows lack rather than an unassignable `never`.
builder.queryField('wrongModelPage', (t) =>
  t.prismaConnection({
    type: 'Post',
    // @ts-expect-error a User row is missing Post's columns
    collection: () => orm.User.where({}),
  }),
);
