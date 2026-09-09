import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import type * as SelectionMapper from '@pothos/selection-mapper';
import type { DBQueryConfig } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { expectTypeOf, it } from 'vitest';
import DrizzlePlugin, {
  drizzleConnectionHelpers,
  type IndirectInclude,
  type IndirectPathSegment,
  type PathSegment,
} from '../src';
import { queryFromInfo } from '../src/utils/map-query';
import { type DrizzleRelations, db, relations } from './example/db';

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

// Only a list relation can be counted.
builder.drizzleObjectFields('users', (t) => ({
  postCount: t.relatedCount('posts'),
  // @ts-expect-error a to-one relation has no count
  profileCount: t.relatedCount('profile'),
}));

it('types the nested selection as the query it returns', () => {
  expectTypeOf(builder).not.toBeAny();
});
