import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import type { PostgresClient } from '@prisma/orm-postgres/runtime';
import { expectTypeOf } from 'vitest';
import prismaNextPlugin, {
  type CollectionFor,
  type CursorSpec,
  type ModelName,
  prismaConnectionHelpers,
} from '../../src';
import type { Contract } from '../fixtures/sample-contract';
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
      cursor: ['title', 'id'],
      type: SummaryRef,
      args: { newest: t.arg.boolean() },
      query: (args, _ctx) => {
        expectTypeOf(args.newest).toEqualTypeOf<boolean | null | undefined>();
        return {
          where: (post) => post.authorId.eq('me'),
          orderBy: (post) => (args.newest ? post.title.desc() : post.title.asc()),
        };
      },
      totalCount: (user) => user.email.length,
    }),
    published: t.relatedConnection('posts', { cursor: 'id', query: { where: { published: 1 } } }),
    pair: t.relatedConnection('posts', {
      cursor: ['title', 'id'],
      query: { orderBy: [(post) => post.title.desc(), (post) => post.id.desc()] },
    }),
    notACondition: t.relatedConnection('posts', {
      cursor: 'id',
      // @ts-expect-error a where callback returns a condition
      query: { where: () => 42 },
    }),
    unknownQueryKey: t.relatedConnection('posts', {
      cursor: 'id',
      // @ts-expect-error the connection args own the page size
      query: { where: { published: 1 }, limit: 5 },
    }),
    topLevelWhere: t.relatedConnection('posts', {
      cursor: 'id',
      // @ts-expect-error filters go in `query`
      where: { published: 1 },
    }),
    // @ts-expect-error a connection requires a cursor
    missingCursor: t.relatedConnection('posts', {}),
    badCursor: t.relatedConnection('posts', {
      // @ts-expect-error not a column of Post
      cursor: 'slug',
    }),
    limit: t.relatedConnection('posts', {
      cursor: 'id',
      // @ts-expect-error the connection args own the page size
      limit: 5,
    }),
    badWhere: t.relatedConnection('posts', {
      cursor: 'id',
      // @ts-expect-error a `where` callback returns a condition
      where: () => 42,
    }),
    notAnItem: t.relatedConnection('posts', {
      cursor: 'id',
      // @ts-expect-error orderBy returns order items, not a column
      query: { orderBy: (post) => post.id },
    }),
    resolver: t.relatedConnection('posts', {
      cursor: 'id',
      // @ts-expect-error the plugin owns the resolver
      resolve: () => [],
    }),
    excess: t.relatedConnection('posts', {
      cursor: 'id',
      // @ts-expect-error unknown option
      orderByy: () => [],
    }),
  }),
});

builder.prismaObject('Post', {
  fields: (t) => ({
    comments: t.relatedConnection('comments', {
      cursor: 'id',
      // @ts-expect-error a totalCount callback only sees declared columns
      totalCount: (post) => post.title.length,
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    ordered: t.prismaConnection({
      type: 'Post',
      cursor: ['title', 'id'],
      args: { newest: t.arg.boolean() },
      orderBy: (post, args, context) => {
        expectTypeOf(context).not.toBeAny();
        return args.newest ? [post.title.desc(), post.id.asc()] : post.title.asc();
      },
      resolve: () => orm.Post.orderBy((post) => post.title.asc()),
    }),
    nullableCursor: t.prismaConnection({
      type: 'Post',
      cursor: [{ field: 'score', nulls: 'first' }, 'id'],
      resolve: () => orm.Post,
    }),
    nullable: t.prismaConnection({
      type: 'Post',
      cursor: 'id',
      nullable: true,
      resolve: () => null,
    }),
    required: t.prismaConnection({
      type: 'Post',
      cursor: 'id',
      nullable: false,
      // @ts-expect-error the field isn't nullable
      resolve: () => null,
    }),
    unknownColumn: t.prismaConnection({
      type: 'Post',
      cursor: 'id',
      // @ts-expect-error `nope` isn't a Post column
      orderBy: (post) => post.nope.asc(),
      resolve: () => orm.Post,
    }),
    // @ts-expect-error `cursor` is required
    missing: t.prismaConnection({ type: 'Post', resolve: () => orm.Post }),
    // @ts-expect-error a connection's type is one model's type, not a list
    list: t.prismaConnection({ type: ['Post'], cursor: 'id', resolve: () => orm.Post }),
    query: t.prismaConnection({
      type: 'User',
      cursor: 'id',
      // @ts-expect-error `query` (plugin-prisma's shape) isn't supported
      query: () => ({ where: {} }),
      resolve: () => orm.User,
    }),
    edgesNullable: t.prismaConnection({
      type: 'User',
      cursor: 'id',
      // @ts-expect-error edges are always non-null
      edgesNullable: true,
      resolve: () => orm.User,
    }),
    unknownType: t.prismaConnection({
      // @ts-expect-error not a model in the contract
      type: 'Tag',
      resolve: () => orm.Post,
    }),
  }),
});

// Cursor values use the client's column codecs, so Temporal columns need nothing extra; bytes
// columns can't order a cursor.
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
      cursor: [{ field: 'createdAt', direction: 'desc' }, 'id'],
      resolve: () => client.orm.public.Entry,
    }),
    bare: t.prismaConnection({
      type: 'Entry',
      cursor: ['createdAt', 'id'],
      resolve: () => client.orm.public.Entry,
    }),
    codec: t.prismaConnection({
      type: 'Entry',
      // @ts-expect-error cursor columns take no codec
      cursor: [{ field: 'createdAt', codec: 'column' }, 'id'],
      resolve: () => client.orm.public.Entry,
    }),
    bytes: t.prismaConnection({
      type: 'Entry',
      // @ts-expect-error a bytes column can't order a cursor
      cursor: ['payload', 'id'],
      resolve: () => client.orm.public.Entry,
    }),
  }),
});

// The connection signatures infer the model and the cursor together. The cursor must still infer
// as written, not widen to `CursorSpec`, so `ExactCursor` sees each entry's keys.
declare function inferCursor<M extends ModelName<Types>, C extends CursorSpec<Types, M>>(
  model: M,
  cursor: C,
): C;
expectTypeOf(inferCursor('Post', 'title')).toEqualTypeOf<'title'>();
expectTypeOf(inferCursor('Post', ['title', 'id'])).toEqualTypeOf<['title', 'id']>();
builder.prismaObject('User', {
  variant: 'CursorEntryKeys',
  fields: (t) => ({
    posts: t.relatedConnection('posts', {
      // @ts-expect-error cursor entries take only `field`, `direction` and `nulls`
      cursor: [{ field: 'title', dir: 'asc' }, 'id'],
    }),
  }),
});
prismaConnectionHelpers(builder, 'Post', {
  // @ts-expect-error cursor entries take only `field`, `direction` and `nulls`
  cursor: [{ field: 'title', dir: 'asc' }, 'id'],
});

// prismaConnectionHelpers options: refs, `query`, and callbacks that see the field's args.
const UserNode = builder.prismaInterface('User', {
  name: 'UserNode',
  fields: (t) => ({ id: t.exposeID('id') }),
});
const byInterface = prismaConnectionHelpers(builder, UserNode, { cursor: 'id' });
expectTypeOf(byInterface.ref).toEqualTypeOf(UserNode);
const byObject = prismaConnectionHelpers(builder, SummaryRef, { cursor: 'id' });
expectTypeOf(byObject.ref).toEqualTypeOf(SummaryRef);
prismaConnectionHelpers(builder, 'User', {
  cursor: [{ field: 'firstName', direction: 'desc' }, 'id'],
  args: (t) => ({ q: t.string(), size: t.int() }),
  defaultSize: (args) => args.size ?? 10,
  maxSize: (args, _ctx) => (args.q ? 5 : 50),
  totalCount: (args) => (args.q ? 1 : 2),
  query: (args) => ({
    where: (user, tools) => {
      expectTypeOf(tools).not.toBeAny();
      return args.q ? user.firstName.eq(args.q) : user.id.neq('');
    },
    orderBy: (user) => user.firstName.asc(),
  }),
});
prismaConnectionHelpers(builder, 'User', {
  cursor: 'id',
  // @ts-expect-error a where callback returns a condition
  query: { where: () => 'oops' },
});
prismaConnectionHelpers(builder, 'User', {
  // @ts-expect-error not a column of User
  cursor: 'slug',
});
prismaConnectionHelpers(builder, 'User', {
  cursor: 'id',
  // @ts-expect-error filters go in `query`
  where: { id: 'u' },
});

// prismaConnectionHelpers: `resolveNode` decides the node shape; cursors still read the rows.
export async function helperShapes() {
  const wrapper = prismaConnectionHelpers(builder, 'User', {
    cursor: 'id',
    resolveNode: (user) => ({ user }),
  });
  const page = await wrapper.applyPagination(orm.User, { first: 1 }, {});
  const result = page.wrap(await page.collection.all());
  expectTypeOf(result.edges[0]!.node.user.id).toEqualTypeOf<string>();
  expectTypeOf(result.edges[0]!.cursor).toEqualTypeOf<string>();
  // @ts-expect-error `node` is the wrapper, not the row
  result.edges[0]!.node.id;

  const union = prismaConnectionHelpers(builder, 'User', {
    cursor: 'id',
    resolveNode: (user): { kind: 'user'; user: typeof user } | { kind: 'empty' } =>
      user.firstName ? { kind: 'user', user } : { kind: 'empty' },
  });
  const unionPage = await union.applyPagination(orm.User, { first: 1 }, {});
  expectTypeOf(unionPage.wrap(await unionPage.collection.all()).edges[0]!.node.kind).toEqualTypeOf<
    'user' | 'empty'
  >();

  const plain = prismaConnectionHelpers(builder, 'User', {
    cursor: 'id',
    query: { where: (user) => user.firstName.eq('Alice') },
  });
  const plainPage = await plain.applyPagination(orm.User, { first: 1 }, {});
  expectTypeOf(plainPage.wrap([{ id: 'a', firstName: 'Alice' }]).edges[0]!.node).toEqualTypeOf<{
    id: string;
    firstName: string;
  }>();
  expectTypeOf(
    plainPage.wrap(await plainPage.collection.all()).edges[0]!.node.id,
  ).toEqualTypeOf<string>();

  const narrowRows = [{ id: 'a', firstName: 'Alice' }];
  const spreading = prismaConnectionHelpers(builder, 'User', {
    cursor: 'id',
    resolveNode: (user) => ({ ...user, extra: 1 }),
  });
  const spreadPage = await spreading.applyPagination(orm.User, { first: 1 }, {});
  // @ts-expect-error a spreading callback would claim columns these rows lack
  spreadPage.wrap(narrowRows);
  // @ts-expect-error the wrapper form would put the full row under `.user`
  page.wrap(narrowRows);
  const full = spreadPage.wrap(await spreadPage.collection.all());
  expectTypeOf(full.edges[0]!.node.extra).toEqualTypeOf<number>();
  expectTypeOf(full.edges[0]!.node.email).toEqualTypeOf<string>();

  const enabled = Math.random() > 0.5;
  const conditional = prismaConnectionHelpers(builder, 'User', {
    cursor: 'id',
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
    cursor: 'id',
    resolveNode: (user) => user.firstName,
  });
  const primitivePage = await primitive.applyPagination(orm.User, {}, {});
  expectTypeOf(
    primitivePage.wrap(await primitivePage.collection.all()).edges[0]!.node,
  ).toEqualTypeOf<string>();

  const promised = prismaConnectionHelpers(builder, 'User', {
    cursor: 'id',
    resolveNode: (user) => Promise.resolve({ user }),
  });
  const promisedPage = await promised.applyPagination(orm.User, {}, {});
  const promisedNode = promisedPage.wrap(await promisedPage.collection.all()).edges[0]!.node;
  expectTypeOf((await promisedNode).user.id).toEqualTypeOf<string>();
}

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
    const posts = t.prismaConnection({ type: 'Post', cursor: 'id', resolve: () => orm.Post });
    expectTypeOf(posts.$inferType.edges).not.toBeUnknown();
    expectTypeOf<null extends typeof posts.$inferType ? true : false>().toEqualTypeOf<false>();
    return {
      user,
      posts,
      // @ts-expect-error the field is non-null by default
      nullUser: t.prismaField({ type: 'User', resolve: () => null }),
      nullableUser: t.prismaField({ type: 'User', nullable: true, resolve: () => null }),
      // @ts-expect-error the connection is non-null by default
      nullPosts: t.prismaConnection({ type: 'Post', cursor: 'id', resolve: () => null }),
      nullablePosts: t.prismaConnection({
        type: 'Post',
        cursor: 'id',
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
