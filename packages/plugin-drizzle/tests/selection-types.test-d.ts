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

it('preserves callable field builder query selections when passed to Drizzle', async () => {
  const t = {} as Parameters<Parameters<typeof builder.queryFields>[0]>[0];
  const info = {} as GraphQLResolveInfo;
  const query = t.drizzleQueryFromInfo('users', { context: {}, info });
  const rows = await db.query.users.findMany(
    query({
      columns: { id: true },
      with: { posts: { columns: { title: true } } },
      where: { id: 1 },
      limit: 5,
    }),
  );
  expectTypeOf(rows[0].id).toEqualTypeOf<number>();
  expectTypeOf(rows[0].posts[0].title).toEqualTypeOf<string>();
  // @ts-expect-error Unselected root column.
  rows[0].username;
  // @ts-expect-error Unselected relation column.
  rows[0].posts[0].content;
  const related = await db.query.users.findMany(query({ with: { posts: true } }));
  // @ts-expect-error Omitted columns do not guarantee all root columns.
  related[0].username;
  expectTypeOf(related[0].posts[0].title).toEqualTypeOf<string>();
  expectTypeOf(query()).toMatchTypeOf<{ columns: {} }>();
  const postQuery = t.drizzleQueryFromInfo(Post, { context: {}, info });
  const postRows = await db.query.posts.findMany(postQuery({ columns: { postId: true } }));
  expectTypeOf(postRows[0].postId).toEqualTypeOf<number>();
  // @ts-expect-error The ref binds the query to the posts table.
  postQuery({ columns: { username: true } });
  // @ts-expect-error Unknown table.
  t.drizzleQueryFromInfo('missing', { context: {}, info });
  // @ts-expect-error Unknown column.
  query({ columns: { missing: true } });
  // @ts-expect-error Unknown relation.
  query({ with: { missing: true } });
  // @ts-expect-error Invalid filter value for a numeric column.
  query({ where: { id: 'wrong' } });
  // @ts-expect-error Selections are passed to the returned callable.
  t.drizzleQueryFromInfo('users', { context: {}, info, select: { columns: { id: true } } });
});

it('widens callable queries for schemas with async selections', async () => {
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
  });
  expectTypeOf(pendingQuery).toEqualTypeOf<MaybePromise<Awaited<typeof pendingQuery>>>();
  // @ts-expect-error Async-enabled query builders must be awaited before calling them.
  pendingQuery({ columns: { id: true } });
  const query = await pendingQuery;
  const rows = await db.query.users.findMany(query({ columns: { id: true }, where: { id: 1 } }));
  expectTypeOf(rows[0].id).toEqualTypeOf<number>();
  // @ts-expect-error Awaiting the builder retains the column selection.
  rows[0].username;
});

it('types standalone callable queries and their explicit async option', async () => {
  const options = { config: getSchemaConfig(builder), context: {}, info: {} as GraphQLResolveInfo };
  const query = queryFromInfo(options);
  const rows = await db.query.users.findMany(query({ columns: { id: true } }));
  expectTypeOf(rows[0].id).toEqualTypeOf<number>();
  // @ts-expect-error Unselected column.
  rows[0].username;
  expectTypeOf(query()).toMatchTypeOf<{ columns: {} }>();
  const pendingQuery = queryFromInfo({ ...options, awaitSelections: true });
  expectTypeOf(pendingQuery).toEqualTypeOf<MaybePromise<typeof query>>();
  // @ts-expect-error Async opt-in requires awaiting the builder before calling it.
  pendingQuery();
  const settledQuery = await pendingQuery;
  const selected = settledQuery({ columns: { id: true }, with: { posts: true } });
  const related = await db.query.users.findMany(selected);
  expectTypeOf(related[0].posts[0].title).toEqualTypeOf<string>();
  const flag = true as boolean;
  expectTypeOf(queryFromInfo({ ...options, awaitSelections: flag })).toEqualTypeOf<
    MaybePromise<typeof query>
  >();
  // @ts-expect-error Selections belong on the returned function.
  queryFromInfo({ ...options, select: { columns: { id: true } } });
});
