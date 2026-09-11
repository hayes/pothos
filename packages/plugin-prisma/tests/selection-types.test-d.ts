import SchemaBuilder from '@pothos/core';
import type * as SelectionMapper from '@pothos/selection-mapper';
import type { GraphQLResolveInfo } from 'graphql';
import { expectTypeOf, it } from 'vitest';
import PrismaPlugin, {
  type IndirectInclude,
  type IndirectPathSegment,
  type PathSegment,
  type PrismaRelationQuery,
  type PrismaTypesFromClient,
  prismaConnectionHelpers,
  type QueryFromRelation,
  queryFromInfo,
  type SelectionMap,
  type ShapeFromSelection,
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
    // The selection may also be a callback of the field's arguments and context, or a promise;
    // the result is typed by the query either way.
    recentPosts: t.field({
      type: [Post],
      args: { limit: t.arg.int() },
      select: (_args, _ctx, nestedSelection) => {
        const query = nestedSelection((args, ctx) => {
          expectTypeOf(args).toEqualTypeOf<{ limit?: number | null }>();
          expectTypeOf(ctx).toEqualTypeOf<{}>();

          return { take: args.limit ?? 1 };
        });

        expectTypeOf(query.take).toEqualTypeOf<number>();
        expectTypeOf(query.select).toEqualTypeOf<PrismaTypes['Post']['Select'] | undefined>();

        return { posts: query };
      },
      resolve: (user) => user.posts,
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

// A field whose type is the name of a prisma object type (registered under its model's name) gets
// the same model inference as one typed with the ref.
const stringBuilder = new SchemaBuilder<{
  PrismaTypes: PrismaTypes;
  Objects: { Post: PrismaTypes['Post']['Shape']; Profile: PrismaTypes['Profile']['Shape'] };
}>({
  plugins: [PrismaPlugin],
  prisma: {
    client: () => null as never,
    dmmf: getDatamodel(),
  },
});

stringBuilder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
stringBuilder.prismaObject('Profile', { fields: (t) => ({ id: t.exposeID('id') }) });

stringBuilder.prismaObject('User', {
  fields: (t) => ({
    latestPosts: t.field({
      type: ['Post'],
      select: (_args, _ctx, nestedSelection) => {
        expectTypeOf(nestedSelection()).toEqualTypeOf<PrismaRelationQuery<PrismaTypes['Post']>>();

        const query = nestedSelection({ take: 1 });

        expectTypeOf(query.take).toEqualTypeOf<number>();
        expectTypeOf(query.select).toEqualTypeOf<PrismaTypes['Post']['Select'] | undefined>();

        return { posts: query };
      },
      resolve: (user) => user.posts,
    }),
    profile: t.field({
      type: 'Profile',
      nullable: true,
      select: (_args, _ctx, nestedSelection) => {
        expectTypeOf(nestedSelection({ select: { bio: true } }).select).toEqualTypeOf<{
          bio: true;
        }>();

        return { profile: nestedSelection() };
      },
      resolve: (user) => user.profile,
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

// `ShapeFromSelection` names the row shape a query loads.
it('names the shape of a row loaded with a query', () => {
  type Types = typeof builder.$inferSchemaTypes;

  expectTypeOf<
    ShapeFromSelection<
      Types,
      PrismaTypes['User'],
      { select: { id: true; posts: { select: { title: true } } } }
    >
  >().toEqualTypeOf<{ id: number; posts: { title: string }[] }>();

  expectTypeOf<
    ShapeFromSelection<Types, PrismaTypes['User'], { include: { profile: true } }>
  >().toEqualTypeOf<{
    id: number;
    email: string;
    name: string | null;
    profile: { id: number; bio: string | null; userId: number } | null;
  }>();

  expectTypeOf<ShapeFromSelection<Types, PrismaTypes['User'], {}>>().toEqualTypeOf<
    PrismaTypes['User']['Shape']
  >();

  // `_count` is typed as prisma returns it, in a `select` or an `include`: `true` counts every
  // list relation, `{ select }` the selected ones.
  expectTypeOf<
    ShapeFromSelection<Types, PrismaTypes['User'], { select: { id: true; _count: true } }>
  >().toEqualTypeOf<{
    id: number;
    _count: {
      posts: number;
      comments: number;
      followers: number;
      following: number;
      Media: number;
    };
  }>();
  expectTypeOf<
    ShapeFromSelection<
      Types,
      PrismaTypes['User'],
      { select: { _count: { select: { posts: true } } } }
    >
  >().toEqualTypeOf<{ _count: { posts: number } }>();
  expectTypeOf<
    ShapeFromSelection<
      Types,
      PrismaTypes['User'],
      { include: { _count: { select: { posts: true } } } }
    >
  >().toEqualTypeOf<{
    id: number;
    email: string;
    name: string | null;
    _count: { posts: number };
  }>();
  expectTypeOf<ShapeFromSelection<Types, PrismaTypes['User'], { include: { _count: true } }>>()
    .toHaveProperty('_count')
    .toEqualTypeOf<{
      posts: number;
      comments: number;
      followers: number;
      following: number;
      Media: number;
    }>();
  // A count with a filter is still a number.
  expectTypeOf<
    ShapeFromSelection<
      Types,
      PrismaTypes['User'],
      { select: { _count: { select: { posts: { where: { published: true } } } } } }
    >
  >().toEqualTypeOf<{ _count: { posts: number } }>();
});

// Whether a `select` narrows the row turns on whether it names a column, not on whether the
// `select` key itself is optional. A map naming a column narrows even when the key is optional:
// those columns are on the row either way, since a row loaded without a `select` carries every
// column. An explicit empty or wholly optional map guarantees no selected columns.
type SchemaTypesOfBuilder = typeof builder.$inferSchemaTypes;
type UserModel = PrismaTypes['User'];

declare const optionalSelect: ShapeFromSelection<
  SchemaTypesOfBuilder,
  UserModel,
  { select?: { email: true } }
>;
declare const undefinedInSelect: ShapeFromSelection<
  SchemaTypesOfBuilder,
  UserModel,
  { select: { email: true } | undefined }
>;

it('narrows on a select that names a column, optional key or not', () => {
  // 1. No `select` at all: every column is on the row.
  expectTypeOf<ShapeFromSelection<SchemaTypesOfBuilder, UserModel, {}>>().toEqualTypeOf<
    UserModel['Shape']
  >();

  expectTypeOf<
    ShapeFromSelection<SchemaTypesOfBuilder, UserModel, { select: {} }>
  >().toEqualTypeOf<{}>();
  expectTypeOf<
    ShapeFromSelection<SchemaTypesOfBuilder, UserModel, { select: { email?: true } }>
  >().toEqualTypeOf<{}>();
  expectTypeOf<
    ShapeFromSelection<SchemaTypesOfBuilder, UserModel, { select: { email: false } }>
  >().toEqualTypeOf<{}>();

  // 2. A required `select`: exactly the selected columns.
  expectTypeOf<
    ShapeFromSelection<SchemaTypesOfBuilder, UserModel, { select: { email: true } }>
  >().toEqualTypeOf<{ email: string }>();

  // 3. An optional `select` key: still exactly the selected columns, never the whole model.
  expectTypeOf(optionalSelect).toEqualTypeOf<{ email: string }>();
  expectTypeOf(optionalSelect.email).toEqualTypeOf<string>();
  // @ts-expect-error `name` was never selected, and is not on the row.
  optionalSelect.name;

  // 4. A `select` whose type explicitly includes `undefined`: the same. `undefined` is not a
  // column, and does not widen the row back to the whole model.
  expectTypeOf(undefinedInSelect).toEqualTypeOf<{ email: string }>();
  // @ts-expect-error `name` was never selected, and is not on the row.
  undefinedInSelect.name;

  // Unconstrained generated query types retain Prisma's default model-shape convention.
  expectTypeOf<
    ShapeFromSelection<SchemaTypesOfBuilder, UserModel, { select?: UserModel['Select'] }>
  >().toEqualTypeOf<UserModel['Shape']>();
  expectTypeOf<
    ShapeFromSelection<SchemaTypesOfBuilder, UserModel, PrismaRelationQuery<UserModel>>
  >().toMatchTypeOf<UserModel['Shape']>();

  // A selected relation narrows through an optional `select` too.
  expectTypeOf<
    ShapeFromSelection<
      SchemaTypesOfBuilder,
      UserModel,
      { select?: { posts: { select: { title: true } } } }
    >
  >().toEqualTypeOf<{ posts: { title: string }[] }>();
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

// `queryFromInfo` is typed by what it was given: a given `include` comes back as `include`, a
// given `select` keeps its literal type, and with neither the result is whichever of the two the
// walked type's mode produced, both optional. Every form spreads into a prisma call.
it('types queryFromInfo by what was passed', () => {
  expectTypeOf(queryFromInfo({ context, info })).toEqualTypeOf<{
    select?: SelectionMap['select'];
    include?: SelectionMap['include'];
  }>();

  // The given `select` keeps its literal type. A type in include mode returns `include` instead,
  // so the key is on the type too, but the given columns are on the rows either way.
  expectTypeOf(queryFromInfo({ context, info, select: { id: true } })).toEqualTypeOf<{
    select: { id: true };
    include?: SelectionMap['include'];
  }>();

  expectTypeOf(queryFromInfo({ context, info, include: { posts: true } })).toEqualTypeOf<{
    include: { posts: true };
  }>();

  // All three spread into a prisma call without a cast. The columns of a given select are on the
  // rows either way (an include-mode query loads every column).
  expectTypeOf(
    prisma.user.findMany({ ...queryFromInfo({ context, info }), where: { id: 1 } }),
  ).resolves.items.toMatchTypeOf<{ id: number; email: string }>();
  expectTypeOf(
    prisma.user.findMany({
      ...queryFromInfo({ context, info, include: { posts: true } }),
      where: { id: 1 },
    }),
  ).resolves.items.toMatchTypeOf<{ email: string; posts: { title: string }[] }>();
});

// The round trip: the selection a caller passes to `queryFromInfo` comes back on the rows of the
// prisma call it was spread into, with its own types. The row is exactly the given columns — never
// the whole model — so every read off it is a read of something that was selected.
it('narrows a prisma row to the select given to queryFromInfo', async () => {
  const user = await prisma.user.findUniqueOrThrow({
    ...queryFromInfo({ context, info, select: { email: true } }),
    where: { id: 1 },
  });

  expectTypeOf(user).toEqualTypeOf<{ email: string }>();
  expectTypeOf(user.email).toEqualTypeOf<string>();

  // Not the whole model: `name` was not selected, and reading it is an error rather than a
  // `string | null` that is `undefined` at runtime.
  // @ts-expect-error `name` was not selected.
  user.name;

  const list = await prisma.user.findMany({
    ...queryFromInfo({ context, info, select: { id: true, name: true } }),
    where: { id: 1 },
  });

  expectTypeOf(list).items.toEqualTypeOf<{ id: number; name: string | null }>();
  // @ts-expect-error `email` was not selected.
  list[0].email;
});

// A relation in the given `select` round trips the same way: a type in select mode keeps it under
// `select`, a type in include mode moves it under `include`, and the rows carry it in both.
it('narrows a relation selected through queryFromInfo', async () => {
  const user = await prisma.user.findUniqueOrThrow({
    ...queryFromInfo({ context, info, select: { posts: { select: { title: true } } } }),
    where: { id: 1 },
  });

  expectTypeOf(user).toEqualTypeOf<{ posts: { title: string }[] }>();
  // @ts-expect-error only `title` was selected on the posts.
  user.posts[0].id;
});

// Include mode: a given `include` is the query, and prisma loads every column beside it, so the
// row is the whole model plus the included relations. Nothing is narrowed away, and nothing is
// claimed that is not loaded.
it('types an include given to queryFromInfo as an include-mode row', async () => {
  const user = await prisma.user.findUniqueOrThrow({
    ...queryFromInfo({ context, info, include: { posts: true } }),
    where: { id: 1 },
  });

  expectTypeOf(user.id).toEqualTypeOf<number>();
  expectTypeOf(user.email).toEqualTypeOf<string>();
  expectTypeOf(user.name).toEqualTypeOf<string | null>();
  expectTypeOf(user.posts).items.toMatchTypeOf<{ title: string }>();

  // @ts-expect-error `profile` was not included.
  user.profile;
});

// An explicit empty selection cannot justify reading an arbitrary model column.
builder.prismaObject('User', {
  variant: 'EmptySelection',
  select: {},
  fields: (t) => ({
    email: t.string({
      nullable: true,
      // @ts-expect-error The empty select did not load email.
      resolve: (user) => user.email,
    }),
  }),
});
