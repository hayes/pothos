import SchemaBuilder, { type MaybePromise } from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import type * as SelectionMapper from '@pothos/selection-mapper';
import type { DBQueryConfig } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import type { GraphQLResolveInfo } from 'graphql';
import { expectTypeOf, it } from 'vitest';
import DrizzlePlugin, {
  drizzleConnectionHelpers,
  getSchemaConfig,
  type IndirectInclude,
  type IndirectPathSegment,
  type PathSegment,
  queryFromInfo,
} from '../src';
import { type DrizzleRelations, db, relations } from './example/db';
import { posts } from './example/db/schema';

// One path segment type, shared with the planner, for `queryFromInfo` paths, `nestedSelection`
// paths, and the `IndirectInclude` a type's extensions carry.
it('re-exports the shared path segment types', () => {
  expectTypeOf<PathSegment>().toEqualTypeOf<SelectionMapper.PathSegment>();
  expectTypeOf<IndirectPathSegment>().toEqualTypeOf<SelectionMapper.IndirectPathSegment>();
  expectTypeOf<IndirectInclude>().toEqualTypeOf<SelectionMapper.IndirectInclude>();
  expectTypeOf<PathSegment>().toEqualTypeOf<string | { name: string; type?: string }>();

  expectTypeOf(queryFromInfo)
    .parameter(0)
    .toHaveProperty('path')
    .toEqualTypeOf<PathSegment[] | undefined>();
});

const builder = new SchemaBuilder<{
  DrizzleRelations: DrizzleRelations;
}>({
  plugins: [ScopeAuthPlugin, RelayPlugin, DrizzlePlugin],
  drizzle: {
    client: () => db,
    getTableConfig,
    relations,
  },
  scopeAuth: {
    authScopes: () => ({}),
  },
});

type PostsQuery = DBQueryConfig<'many', DrizzleRelations, DrizzleRelations['posts']>;
type ProfileQuery = DBQueryConfig<'one', DrizzleRelations, DrizzleRelations['userProfile']>;

const Post = builder.drizzleObject('posts', {
  name: 'Post',
  fields: (t) => ({
    id: t.exposeID('postId'),
  }),
});

const Profile = builder.drizzleObject('userProfile', {
  name: 'Profile',
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

const Comment = builder.drizzleObject('comments', {
  name: 'Comment',
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

const commentHelpers = drizzleConnectionHelpers(builder, 'comments');

// `nestedSelection` is typed as the query config for the field's table (a `many` config for a
// list field), keeping the keys it was given, so `columns` in it still narrow the parent shape.
builder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({
    latestPosts: t.field({
      type: [Post],
      select: (_args, _ctx, nestedSelection) => {
        expectTypeOf(nestedSelection()).toEqualTypeOf<PostsQuery>();
        expectTypeOf(nestedSelection(true)).toEqualTypeOf<PostsQuery>();
        expectTypeOf(nestedSelection.path).toEqualTypeOf<string[]>();

        // A path segment is a name, or `{ name, type }`, as for `queryFromInfo`.
        expectTypeOf(
          nestedSelection({ limit: 1 }, [{ name: 'post', type: 'PostEntry' }]),
        ).toEqualTypeOf(nestedSelection({ limit: 1 }, ['post']));

        const query = nestedSelection({ limit: 1 });

        expectTypeOf(query.limit).toEqualTypeOf<number>();
        expectTypeOf(query.columns).toEqualTypeOf<PostsQuery['columns']>();
        expectTypeOf(query.with).toEqualTypeOf<PostsQuery['with']>();

        return { with: { posts: query } };
      },
      resolve: (user) => {
        // A query config without `columns` of its own loads every column.
        expectTypeOf(user.posts[0].title).toEqualTypeOf<string>();

        return user.posts;
      },
    }),
    // The selection may also be a callback of the field's arguments, context, and path info, or a
    // promise; the result is typed by the query config either way.
    recentPosts: t.field({
      type: [Post],
      args: { limit: t.arg.int() },
      select: (_args, _ctx, nestedSelection) => {
        const query = nestedSelection((args, ctx, pathInfo) => {
          expectTypeOf(args).toEqualTypeOf<{ limit?: number | null }>();
          expectTypeOf(ctx).toEqualTypeOf<{}>();
          expectTypeOf(pathInfo.path).toEqualTypeOf<string[]>();

          return { limit: args.limit ?? 1 };
        });

        expectTypeOf(query.limit).toEqualTypeOf<number>();
        expectTypeOf(query.columns).toEqualTypeOf<PostsQuery['columns']>();

        return { with: { posts: query } };
      },
      resolve: (user) => user.posts,
    }),
    postTitles: t.field({
      type: [Post],
      select: (_args, _ctx, nestedSelection) => {
        // The given selection's keys are kept as given, with the literal `true`.
        const query = nestedSelection({ columns: { title: true } });

        expectTypeOf(query.columns).toEqualTypeOf<{ title: true }>();

        return { with: { posts: query } };
      },
      resolve: (user) => {
        expectTypeOf(user.posts[0]).toEqualTypeOf<{ title: string }>();

        return null as never;
      },
    }),
    profileBio: t.string({
      nullable: true,
      select: (_args, _ctx, nestedSelection) => {
        // A field type without a table keeps the given selection.
        expectTypeOf(nestedSelection({ limit: 1 })).toEqualTypeOf<{ limit: number }>();

        return { with: { profile: nestedSelection() } };
      },
      resolve: (user) => user.profile?.bio,
    }),
    profile: t.field({
      type: Profile,
      nullable: true,
      select: (_args, _ctx, nestedSelection) => {
        expectTypeOf(nestedSelection()).toEqualTypeOf<ProfileQuery>();

        return { with: { profile: nestedSelection() } };
      },
      resolve: (user) => user.profile,
    }),
    comments: t.connection({
      type: Comment,
      // The field's nested selection is accepted by the helpers' `getQuery`.
      select: (args, ctx, nestedSelection) => ({
        with: { comments: commentHelpers.getQuery(args, ctx, nestedSelection) },
      }),
      resolve: (user, args, ctx) => commentHelpers.resolve(user.comments, args, ctx),
    }),
  }),
});

// A `t.variant` field can carry a `select` of its own (the docs' Variants example).
const Viewer = builder.drizzleObject('users', {
  variant: 'Viewer',
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

builder.drizzleObjectFields('users', (t) => ({
  viewer: t.variant(Viewer, {
    select: { columns: { firstName: true } },
    isNull: (user) => {
      expectTypeOf(user.firstName).toEqualTypeOf<string | null>();

      return false;
    },
  }),
}));

// Only a list relation can be counted.
builder.drizzleObjectFields('users', (t) => ({
  postCount: t.relatedCount('posts'),
  // @ts-expect-error a to-one relation has no count
  profileCount: t.relatedCount('profile'),
}));

// `t.relatedField` takes the ordinary field options, an async `resolve`, and the resolve info.
builder.drizzleObjectFields('users', (t) => ({
  postsTotal: t.relatedField('posts', {
    type: 'Int',
    description: 'how many posts',
    deprecationReason: 'use postCount',
    extensions: { complexity: 1 },
    authScopes: {},
    select: (buildFilter) => ({
      extras: { postsTotal: (parent) => db.$count(posts, buildFilter(parent)) },
    }),
    resolve: (user, _args, _ctx, info) => {
      expectTypeOf(info).toEqualTypeOf<GraphQLResolveInfo>();
      expectTypeOf(user.postsTotal).toEqualTypeOf<number>();

      return Promise.resolve(user.postsTotal);
    },
  }),
}));

it('types the nested selection as the query it returns', () => {
  expectTypeOf(builder).not.toBeAny();
});

it('preserves flat field builder query options when passed to Drizzle', async () => {
  const t = {} as Parameters<Parameters<typeof builder.queryFields>[0]>[0];
  const info = {} as GraphQLResolveInfo;
  const options = { context: {}, info };
  const query = t.drizzleQueryFromInfo('users', {
    ...options,
    columns: { id: true },
    with: { posts: { columns: { title: true } } },
    where: { id: 1 },
    limit: 5,
    path: ['user'],
  });
  const rows = await db.query.users.findMany(query);
  expectTypeOf(rows[0].id).toEqualTypeOf<number>();
  expectTypeOf(rows[0].posts[0].title).toEqualTypeOf<string>();
  // @ts-expect-error Unselected root column.
  rows[0].username;
  // @ts-expect-error Unselected relation column.
  rows[0].posts[0].content;
  // @ts-expect-error GraphQL metadata is not part of the query result.
  query.context;
  // @ts-expect-error GraphQL metadata is not part of the query result.
  query.info;
  // @ts-expect-error Paths are consumed by the planner.
  query.path;
  const user = await db.query.users.findFirst(
    t.drizzleQueryFromInfo('users', {
      ...options,
      columns: { id: true },
      where: { id: 1 },
    }),
  );
  expectTypeOf(user!.id).toEqualTypeOf<number>();
  const related = await db.query.users.findMany(
    t.drizzleQueryFromInfo('users', {
      ...options,
      with: { posts: true },
    }),
  );
  // @ts-expect-error Omitted columns do not guarantee all root columns.
  related[0].username;
  expectTypeOf(related[0].posts[0].title).toEqualTypeOf<string>();
  expectTypeOf(t.drizzleQueryFromInfo('users', options)).toMatchTypeOf<{ columns: {} }>();
  const postRows = await db.query.posts.findMany(
    t.drizzleQueryFromInfo(Post, {
      ...options,
      columns: { postId: true },
    }),
  );
  expectTypeOf(postRows[0].postId).toEqualTypeOf<number>();
  // @ts-expect-error The ref binds the query to the posts table.
  t.drizzleQueryFromInfo(Post, { ...options, columns: { username: true } });
  // @ts-expect-error Query options are flat, without a select wrapper.
  t.drizzleQueryFromInfo('users', { ...options, select: { columns: { id: true } } });
  // @ts-expect-error Unknown table.
  t.drizzleQueryFromInfo('missing', options);
  // @ts-expect-error Unknown column.
  t.drizzleQueryFromInfo('users', { ...options, columns: { missing: true } });
  // @ts-expect-error Unknown relation.
  t.drizzleQueryFromInfo('users', { ...options, with: { missing: true } });
  // @ts-expect-error Invalid filter value for a numeric column.
  t.drizzleQueryFromInfo('users', { ...options, where: { id: 'wrong' } });
});

it('widens flat queries for schemas with async selections', async () => {
  const asyncBuilder = new SchemaBuilder<{
    DrizzleRelations: DrizzleRelations;
    AsyncSelections: true;
    Context: { tenantId: number };
  }>({
    plugins: [ScopeAuthPlugin, DrizzlePlugin],
    drizzle: { client: () => db, getTableConfig, relations },
    scopeAuth: { authScopes: () => ({}) },
  });
  const t = {} as Parameters<Parameters<typeof asyncBuilder.queryFields>[0]>[0];
  const info = {} as GraphQLResolveInfo;
  t.drizzleQueryFromInfo('users', {
    info,
    // @ts-expect-error The builder's context type is required.
    context: {},
  });
  const pendingQuery = t.drizzleQueryFromInfo('users', {
    context: { tenantId: 1 },
    info,
    columns: { id: true },
    where: { id: 1 },
  });
  expectTypeOf(pendingQuery).extract<Promise<unknown>>().not.toBeNever();
  // @ts-expect-error Async-enabled queries must be awaited before passing them to Drizzle.
  db.query.users.findMany(pendingQuery);
  const rows = await db.query.users.findMany(await pendingQuery);
  expectTypeOf(rows[0].id).toEqualTypeOf<number>();
  // @ts-expect-error Awaiting the query retains the column selection.
  rows[0].username;
});

it('types standalone flat queries and their explicit async option', async () => {
  const options = { config: getSchemaConfig(builder), context: {}, info: {} as GraphQLResolveInfo };
  const query = queryFromInfo({ ...options, columns: { id: true }, where: { id: 1 }, limit: 1 });
  const rows = await db.query.users.findMany(query);
  expectTypeOf(rows[0].id).toEqualTypeOf<number>();
  // @ts-expect-error Unselected column.
  rows[0].username;
  // @ts-expect-error Configuration metadata is removed from the query.
  query.config;
  // @ts-expect-error GraphQL metadata is removed from the query.
  query.info;
  const empty = queryFromInfo(options);
  expectTypeOf(empty).toMatchTypeOf<{ columns: {} }>();
  const pendingQuery = queryFromInfo({ ...options, awaitSelections: true });
  expectTypeOf(pendingQuery).toEqualTypeOf<MaybePromise<typeof empty>>();
  // @ts-expect-error Async opt-in requires awaiting the query.
  db.query.users.findMany(pendingQuery);
  const selected = await queryFromInfo({
    ...options,
    awaitSelections: true,
    columns: { id: true },
    with: { posts: true },
  });
  // @ts-expect-error Async planning metadata is removed from the query.
  selected.awaitSelections;
  const related = await db.query.users.findMany(selected);
  expectTypeOf(related[0].posts[0].title).toEqualTypeOf<string>();
  const flag = true as boolean;
  expectTypeOf(queryFromInfo({ ...options, awaitSelections: flag })).toEqualTypeOf<
    MaybePromise<typeof empty>
  >();
});
