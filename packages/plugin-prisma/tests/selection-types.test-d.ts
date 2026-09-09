import SchemaBuilder from '@pothos/core';
import type * as SelectionMapper from '@pothos/selection-mapper';
import type { GraphQLResolveInfo } from 'graphql';
import { expectTypeOf, it } from 'vitest';
import PrismaPlugin, {
  type IndirectInclude,
  type IndirectPathSegment,
  type PathSegment,
  type PrismaQueriedShape,
  type PrismaRelationQuery,
  type PrismaTypesFromClient,
  prismaConnectionHelpers,
  type QueryFromRelation,
  queryFromInfo,
  type SelectionMap,
} from '../src';
import type { Prisma } from './client/client';
import { prisma } from './example/builder';
import { getDatamodel } from './generated.js';

declare const info: GraphQLResolveInfo;
declare const context: {};

type PrismaTypes = PrismaTypesFromClient<typeof prisma>;

const builder = new SchemaBuilder<{ PrismaTypes: PrismaTypes }>({
  plugins: [PrismaPlugin],
  prisma: {
    client: () => null as never,
    dmmf: getDatamodel(),
  },
});

const Post = builder.prismaObject('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

const Profile = builder.prismaObject('Profile', {
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

const commentHelpers = prismaConnectionHelpers(builder, 'Comment', {
  cursor: 'id',
  select: (nodeSelection) => ({ id: true, post: nodeSelection() }),
  resolveNode: (comment) => comment.post,
});

// `nestedSelection` is typed as the relation query for the field's model, keeping the keys it
// was given, so a `select` in it still narrows the parent shape.
builder.prismaObject('User', {
  fields: (t) => ({
    latestPosts: t.field({
      type: [Post],
      select: (_args, _ctx, nestedSelection) => {
        expectTypeOf(nestedSelection()).toEqualTypeOf<PrismaRelationQuery<PrismaTypes['Post']>>();
        expectTypeOf(nestedSelection(true)).toEqualTypeOf<
          PrismaRelationQuery<PrismaTypes['Post']>
        >();

        // A path segment is a name, or `{ name, type }`, as for `queryFromInfo`.
        expectTypeOf(
          nestedSelection({ take: 1 }, [{ name: 'post', type: 'PostEntry' }]),
        ).toEqualTypeOf(nestedSelection({ take: 1 }, ['post']));

        // Every argument prisma accepts on a list relation is accepted, `omit` and `distinct`
        // among them, and the query is one prisma accepts for the relation.
        expectTypeOf(nestedSelection({ omit: { content: true } }).omit).toEqualTypeOf<{
          content: true;
        }>();
        expectTypeOf(
          nestedSelection({ distinct: 'title' as const }).distinct,
        ).toEqualTypeOf<'title'>();
        expectTypeOf(nestedSelection({ distinct: ['title', 'content'] }).distinct).toEqualTypeOf<
          ('title' | 'content')[]
        >();
        expectTypeOf<
          PrismaRelationQuery<PrismaTypes['Post']>
        >().toMatchTypeOf<Prisma.User$postsArgs>();

        const query = nestedSelection({ take: 1, where: { published: true } });

        expectTypeOf(query.take).toEqualTypeOf<number>();
        // The given keys are typed by the model's query, so literals are kept.
        expectTypeOf(query.where).toEqualTypeOf<{ published: true }>();
        expectTypeOf(query.select).toEqualTypeOf<PrismaTypes['Post']['Select'] | undefined>();
        expectTypeOf(query.include).toEqualTypeOf<PrismaTypes['Post']['Include'] | undefined>();

        return { posts: query };
      },
      resolve: (user) => {
        // A relation query without a `select` of its own loads every column.
        expectTypeOf(user.posts[0].title).toEqualTypeOf<string>();

        return user.posts;
      },
    }),
    postTitles: t.stringList({
      // A field type without a model keeps the given selection.
      select: (_args, _ctx, nestedSelection) => ({
        posts: nestedSelection({ select: { title: true } }),
      }),
      resolve: (user) => {
        expectTypeOf(user.posts[0]).toEqualTypeOf<{ title: string }>();

        return user.posts.map((post) => post.title);
      },
    }),
    bio: t.string({
      nullable: true,
      select: (_args, _ctx, nestedSelection) => {
        // A field type without a model keeps the given selection.
        expectTypeOf(nestedSelection({ select: { bio: true } })).toEqualTypeOf<{
          select: { bio: boolean };
        }>();

        return { profile: nestedSelection({ select: { bio: true } }) };
      },
      resolve: (user) => {
        // A `select` given to `nestedSelection` narrows the parent shape as before.
        expectTypeOf(user.profile).toEqualTypeOf<{ bio: string | null } | null>();

        return user.profile?.bio;
      },
    }),
    profile: t.field({
      type: Profile,
      nullable: true,
      select: (_args, _ctx, nestedSelection) => {
        // The given selection's keys are kept as given, with the literal `true`.
        const query = nestedSelection({ select: { bio: true } });

        expectTypeOf(query.select).toEqualTypeOf<{ bio: true }>();
        expectTypeOf(query).toMatchTypeOf<
          Omit<PrismaRelationQuery<PrismaTypes['Profile']>, 'select'>
        >();

        return { profile: nestedSelection() };
      },
      resolve: (user) => {
        expectTypeOf(user.profile).toEqualTypeOf<PrismaTypes['Profile']['Shape'] | null>();

        return user.profile;
      },
    }),
    comments: t.connection({
      type: Post,
      // The field's nested selection is accepted by the helpers' `getQuery`.
      select: (args, ctx, nestedSelection) => ({
        comments: commentHelpers.getQuery(args, ctx, nestedSelection),
      }),
      resolve: (user, args, ctx) => commentHelpers.resolve(user.comments, args, ctx),
    }),
  }),
});

// A relation's fallback `resolve` is handed the relation's own query: prisma's arguments for
// the relation, with the planned `select`/`include`, so it spreads into a query without a cast.
builder.prismaObject('Comment', {
  fields: (t) => ({
    author: t.relation('author', {
      resolve: (query, comment) => {
        expectTypeOf(query).toEqualTypeOf<QueryFromRelation<PrismaTypes['Comment'], 'author'>>();
        expectTypeOf(query.select).toEqualTypeOf<PrismaTypes['User']['Select'] | undefined>();
        expectTypeOf(query.include).toEqualTypeOf<PrismaTypes['User']['Include'] | undefined>();
        // @ts-expect-error a to-one relation has no `take`
        expectTypeOf(query.take);

        return prisma.user.findUniqueOrThrow({ ...query, where: { id: comment.authorId } });
      },
    }),
  }),
});

// A `t.prismaField` on a prisma object takes a `select` planned into the parent row, and still
// receives the query for its own model (the docs' "Selections on t.prismaField" example).
builder.prismaObject('User', {
  variant: 'SelectUser',
  select: { email: true },
  fields: (t) => ({
    email: t.exposeString('email'),
    latestPost: t.prismaField({
      type: 'Post',
      nullable: true,
      select: { id: true },
      resolve: (query, user) => {
        expectTypeOf(user.id).toEqualTypeOf<number>();
        expectTypeOf(query).toEqualTypeOf<{
          include?: PrismaTypes['Post']['Include'];
          select?: PrismaTypes['Post']['Select'];
        }>();

        return prisma.post.findFirst({
          ...query,
          where: { authorId: user.id },
          orderBy: { createdAt: 'desc' },
        });
      },
    }),
  }),
});

// Only a list relation can be counted.
builder.prismaObjectFields('User', (t) => ({
  postCount: t.relationCount('posts'),
  // @ts-expect-error a to-one relation has no count
  profileCount: t.relationCount('profile'),
}));

builder.prismaObjectField('User', 'publishedPosts', (t) =>
  t.relation('posts', {
    query: { where: { published: true } },
    resolve: (query, user) => {
      expectTypeOf(query.where).toEqualTypeOf<PrismaTypes['Post']['Where'] | undefined>();
      expectTypeOf(query.take).toEqualTypeOf<number | undefined>();
      expectTypeOf(query.skip).toEqualTypeOf<number | undefined>();
      expectTypeOf(query.cursor).toEqualTypeOf<PrismaTypes['Post']['WhereUnique'] | undefined>();
      expectTypeOf(query.orderBy).toEqualTypeOf<
        PrismaTypes['Post']['OrderBy'] | PrismaTypes['Post']['OrderBy'][] | undefined
      >();

      return prisma.post.findMany({ ...query, where: { ...query.where, authorId: user.id } });
    },
  }),
);

// `PrismaQueriedShape` names the row shape a query loads, for rows a resolver loads itself.
it('names the shape of a row loaded with a query', () => {
  type Types = typeof builder.$inferSchemaTypes;

  expectTypeOf<
    PrismaQueriedShape<Types, 'User', { select: { id: true; posts: { select: { title: true } } } }>
  >().toEqualTypeOf<{ id: number; posts: { title: string }[] }>();

  expectTypeOf<PrismaQueriedShape<Types, 'User', { include: { profile: true } }>>().toEqualTypeOf<{
    id: number;
    email: string;
    name: string | null;
    profile: { id: number; bio: string | null; userId: number } | null;
  }>();

  expectTypeOf<PrismaQueriedShape<Types, 'User', {}>>().toEqualTypeOf<
    PrismaTypes['User']['Shape']
  >();

  // The model can be given as its types rather than its name.
  expectTypeOf<
    PrismaQueriedShape<Types, PrismaTypes['User'], { select: { email: true } }>
  >().toEqualTypeOf<{
    email: string;
  }>();
});

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

// `queryFromInfo` is typed by what it was given: the `select` or `include` passed in, or, when
// neither was, whichever of the two the walked type's mode produces (both optional, so the
// result spreads into a prisma call).
it('types queryFromInfo by what was passed', () => {
  expectTypeOf(queryFromInfo({ context, info })).toEqualTypeOf<{
    select?: SelectionMap['select'];
    include?: SelectionMap['include'];
  }>();

  expectTypeOf(queryFromInfo({ context, info, select: { id: true } })).toEqualTypeOf<{
    select: { id: true };
  }>();

  expectTypeOf(queryFromInfo({ context, info, include: { posts: true } })).toEqualTypeOf<{
    include: { posts: true };
  }>();

  // Both spread into a prisma call without a cast; a given select narrows the rows.
  expectTypeOf(
    prisma.user.findMany({ ...queryFromInfo({ context, info }), where: { id: 1 } }),
  ).resolves.items.toMatchTypeOf<{ id: number; email: string }>();
  expectTypeOf(
    prisma.user.findMany({
      ...queryFromInfo({ context, info, select: { email: true } }),
      where: { id: 1 },
    }),
  ).resolves.items.toEqualTypeOf<{ email: string }>();
});
