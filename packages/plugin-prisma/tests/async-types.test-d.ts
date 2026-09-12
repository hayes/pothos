import type { CheckAsyncSelection, MaybePromise } from '@pothos/core';
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import type { GraphQLResolveInfo } from 'graphql';
import { expectTypeOf, it } from 'vitest';
import PrismaPlugin, {
  type PathSegment,
  type PrismaTypesFromClient,
  prismaConnectionHelpers,
  queryFromInfo,
  type SelectionMap,
} from '../src';
import type { prisma } from './example/builder';
import { getDatamodel } from './generated.js';

type PrismaTypes = PrismaTypesFromClient<typeof prisma>;

// `AsyncSelections: true` widens INPUTS: a relation `query`, a count `where`, a field `select` and
// the connection helpers' callbacks may return promises. What a resolver is handed is synchronous
// unless it asks otherwise: `queryFromInfo` and `getQuery` return a query, and only return a
// promise for a caller that passed `awaitSelections`.
const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypes;
  Context: { tenantId: () => Promise<number> };
  AsyncSelections: true;
}>({
  plugins: [PrismaPlugin, RelayPlugin],
  prisma: {
    client: () => null as never,
    dmmf: getDatamodel(),
  },
});

const commentHelpers = prismaConnectionHelpers(builder, 'Comment', {
  cursor: 'id',
  select: async (nodeSelection) => ({ id: true, post: nodeSelection({}) }),
  query: async (_args, ctx) => ({ where: { authorId: await ctx.tenantId() } }),
  resolveNode: (comment) => comment.post,
});

builder.prismaObject('Comment', {
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

const Post = builder.prismaObject('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

const User = builder.prismaObject('User', {
  select: { id: true },
  fields: (t) => ({
    posts: t.relation('posts', {
      query: async (_args, ctx) => ({ where: { authorId: await ctx.tenantId() } }),
    }),
    postCount: t.relationCount('posts', {
      where: async (_args, ctx) => ({ authorId: await ctx.tenantId() }),
    }),
    postsConnection: t.relatedConnection('posts', {
      cursor: 'id',
      query: async (_args, ctx) => ({ where: { authorId: await ctx.tenantId() } }),
    }),
    // The parent shape follows the awaited selection.
    titles: t.stringList({
      select: async (_args, _ctx, nestedSelection) => ({
        posts: await nestedSelection({ select: { title: true } }),
      }),
      resolve: (user) => {
        expectTypeOf(user.posts[0].title).toEqualTypeOf<string>();

        return user.posts.map((post) => post.title);
      },
    }),
    // A promise and an async callback are both selections `nestedSelection` accepts.
    awaitedPosts: t.field({
      type: [Post],
      select: async (_args, _ctx, nestedSelection) => {
        const query = await nestedSelection(Promise.resolve({ take: 1 }));
        const fromAsyncCallback = await nestedSelection(async () => ({ skip: 1 }));

        expectTypeOf(query.take).toEqualTypeOf<number>();
        expectTypeOf(query.include).toEqualTypeOf<PrismaTypes['Post']['Include'] | undefined>();
        expectTypeOf(fromAsyncCallback.skip).toEqualTypeOf<number>();
        expectTypeOf(fromAsyncCallback.select).toEqualTypeOf<
          PrismaTypes['Post']['Select'] | undefined
        >();

        return { posts: query };
      },
      resolve: (user) => user.posts,
    }),
    comments: t.connection({
      type: Post,
      select: async (args, ctx, nestedSelection) => ({
        comments: await commentHelpers.getQuery(args, ctx, nestedSelection, {
          awaitSelections: true,
        }),
      }),
      resolve: (user, args, ctx) => commentHelpers.resolve(user.comments, args, ctx),
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    user: t.prismaField({
      type: User,
      resolve: (query) => {
        expectTypeOf(query).not.toMatchTypeOf<PromiseLike<unknown>>();

        return null as never;
      },
    }),
  }),
});

// Without the opt-in the same callbacks are synchronous, and an async one is a type error rather
// than a promise the declared type denies.
const syncBuilder = new SchemaBuilder<{
  PrismaTypes: PrismaTypes;
  Context: { tenantId: () => Promise<number> };
}>({
  plugins: [PrismaPlugin, RelayPlugin],
  prisma: {
    client: () => null as never,
    dmmf: getDatamodel(),
  },
});

const syncCommentHelpers = prismaConnectionHelpers(syncBuilder, 'Comment', {
  cursor: 'id',
  select: (nodeSelection) => ({ id: true, post: nodeSelection({}) }),
  query: (_args, _ctx) => ({ where: { authorId: 1 } }),
  resolveNode: (comment) => comment.post,
});

prismaConnectionHelpers(syncBuilder, 'Comment', {
  cursor: 'id',
  // @ts-expect-error an async `select` needs `AsyncSelections: true`
  select: async (nodeSelection) => ({ id: true, post: nodeSelection({}) }),
});

prismaConnectionHelpers(syncBuilder, 'Comment', {
  cursor: 'id',
  // @ts-expect-error an async `query` needs `AsyncSelections: true`
  query: async (_args, ctx) => ({ where: { authorId: await ctx.tenantId() } }),
});

const SyncPost = syncBuilder.prismaObject('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

// The shapes an async selection can arrive in, declared away from the option so the check reads
// each callback's own type rather than a literal the option contextually typed.
type UserSelect = { email: true };
type AsyncUserSelect = () => Promise<UserSelect>;

declare const declaredAsyncSelect: AsyncUserSelect;
declare const declaredMaybeAsyncSelect: () => Promise<UserSelect> | UserSelect;
declare const declaredSyncUnionSelect: () => { email: true } | { name: true };

declare function genericAsyncSelect<T extends UserSelect>(): Promise<T>;
declare function genericMaybeAsyncSelect<T extends UserSelect>(): Promise<T> | T;
declare function genericSyncSelect<T extends UserSelect>(): T;

// A selection carrying a `then` the runtime will call, written with a signature narrower than
// `PromiseLike`'s two-parameter one. `Promise.resolve` assimilates it all the same.
type ThenableUserSelect = UserSelect & { then(resolve: (value: UserSelect) => void): void };

declare const thenableSelect: () => ThenableUserSelect;
// A union of two callback types rather than one callback with a union return type: picking the
// async member at runtime is what makes synchronous query construction throw.
declare const unionOfCallbacksSelect: (() => UserSelect) | (() => Promise<UserSelect>);
// An async overload the plugins reach — they call a field `select` with three arguments — behind
// a synchronous one that `infer` reads instead.
declare const overloadedSelect: {
  (args: {}, ctx: unknown, nestedSelection: unknown): Promise<UserSelect>;
  (): UserSelect;
};

syncBuilder.prismaObject('User', {
  select: { id: true },
  fields: (t) => ({
    posts: t.relation('posts', {
      query: (_args, _ctx) => ({ where: { authorId: 1 } }),
    }),
    asyncPosts: t.relation('posts', {
      // @ts-expect-error an async relation `query` needs `AsyncSelections: true`
      query: async (_args, ctx) => ({ where: { authorId: await ctx.tenantId() } }),
    }),
    postCount: t.relationCount('posts', {
      where: (_args, _ctx) => ({ authorId: 1 }),
    }),
    asyncPostCount: t.relationCount('posts', {
      // @ts-expect-error an async count `where` needs `AsyncSelections: true`
      where: async (_args, ctx) => ({ authorId: await ctx.tenantId() }),
    }),
    postsConnection: t.relatedConnection('posts', {
      cursor: 'id',
      // @ts-expect-error an async connection `query` needs `AsyncSelections: true`
      query: async (_args, ctx) => ({ where: { authorId: await ctx.tenantId() } }),
    }),
    titles: t.stringList({
      select: (_args, _ctx, nestedSelection) => ({
        posts: nestedSelection({ select: { title: true } }),
      }),
      resolve: (user) => {
        expectTypeOf(user.posts[0].title).toEqualTypeOf<string>();

        return user.posts.map((post) => post.title);
      },
    }),
    asyncTitles: t.stringList({
      // @ts-expect-error an async field `select` needs `AsyncSelections: true`
      select: async (_args, _ctx, nestedSelection) => ({
        posts: await nestedSelection({ select: { title: true } }),
      }),
      resolve: () => [],
    }),
    // The check reads the callback's return type, so its parameter list is beside the point.
    asyncWithoutArgs: t.string({
      // @ts-expect-error an async field `select` needs `AsyncSelections: true`
      select: async () => ({ email: true }),
      resolve: () => '',
    }),
    // A promise returned without the `async` keyword is the same selection to the check.
    promisedWithoutAsync: t.string({
      // @ts-expect-error a promised field `select` needs `AsyncSelections: true`
      select: () => Promise.resolve({ email: true }),
      resolve: () => '',
    }),
    // A callback written elsewhere against a standalone alias, then passed in.
    declaredAsync: t.string({
      // @ts-expect-error an async field `select` needs `AsyncSelections: true`
      select: declaredAsyncSelect,
      resolve: () => '',
    }),
    // A generic whose return type keeps the promise through instantiation.
    genericAsync: t.string({
      // @ts-expect-error an async field `select` needs `AsyncSelections: true`
      select: genericAsyncSelect,
      resolve: () => '',
    }),
    // A literal widened to the alias by `satisfies` before it reaches the option.
    satisfiesAsync: t.string({
      // @ts-expect-error an async field `select` needs `AsyncSelections: true`
      select: (async () => ({ email: true })) satisfies AsyncUserSelect,
      resolve: () => '',
    }),
    // A callback whose return type is a union with a promise in it is async on one of its paths.
    // Asking whether the callback as a whole returns a promise would let this through.
    unionAsync: t.string({
      // @ts-expect-error a field `select` that may return a promise needs `AsyncSelections: true`
      select: declaredMaybeAsyncSelect,
      resolve: () => '',
    }),
    // ...including when a generic is what erases to that union.
    genericUnionAsync: t.string({
      // @ts-expect-error a field `select` that may return a promise needs `AsyncSelections: true`
      select: genericMaybeAsyncSelect,
      resolve: () => '',
    }),
    // A union of two synchronous selections has no promise in it, and must still compile.
    syncUnion: t.string({
      select: declaredSyncUnionSelect,
      resolve: () => '',
    }),
    // So must a generic return type that instantiates to something synchronous.
    genericSync: t.string({
      select: genericSyncSelect,
      resolve: () => '',
    }),
    // A union of callback types, one of them async. Reading a verdict per member and unioning
    // the verdicts lets the synchronous member's `unknown` absorb the async member's diagnostic,
    // so the check collects the members' thenables instead. Here the union is turned away before
    // the check is consulted — inference keeps only the member the option's own type accepts — so
    // what the check itself answers for this shape is pinned directly below.
    unionOfCallbacks: t.string({
      // @ts-expect-error a field `select` that may be an async callback needs `AsyncSelections: true`
      select: unionOfCallbacksSelect,
      resolve: () => '',
    }),
    // The runtime calls anything with a callable `then`, so a selection intersected with one is
    // planned asynchronously even though it is not `PromiseLike` — whose `then` takes two
    // parameters this one does not declare.
    thenableSelection: t.string({
      // @ts-expect-error a thenable field `select` needs `AsyncSelections: true`
      select: thenableSelect,
      resolve: () => '',
    }),
    // Known gap, pinned as it stands rather than as it should be: `infer` resolves an overloaded
    // type to its last signature, so the synchronous overload is the one the check reads while
    // the plugin calls the three-argument async one. See `CheckAsyncSelection` in core.
    overloaded: t.string({
      select: overloadedSelect,
      resolve: () => '',
    }),
    awaitedPosts: t.field({
      type: [SyncPost],
      select: (_args, _ctx, nestedSelection) => ({
        // @ts-expect-error a promised selection needs `AsyncSelections: true`
        posts: nestedSelection(Promise.resolve({ take: 1 })),
      }),
      resolve: (user) => user.posts,
    }),
  }),
});

// A node's `findUnique` is ungated by `AsyncSelections`, as `id.resolve` beside it already is.
syncBuilder.prismaNode('User', {
  variant: 'SyncFindUniqueUser',
  id: { resolve: (user) => String(user.id) },
  findUnique: (id) => ({ id: Number(id) }),
  fields: (t) => ({
    email: t.exposeString('email'),
  }),
});

syncBuilder.prismaNode('User', {
  variant: 'AsyncFindUniqueUser',
  id: { resolve: async (user) => String(user.id) },
  findUnique: async (id) => ({ id: Number(id) }),
  fields: (t) => ({
    email: t.exposeString('email'),
  }),
});

// The shapes above reach `CheckAsyncSelection` only if the option's own type lets them through,
// which hides what the check itself answers. Asked directly, it answers `unknown` for a callback
// it accepts and the diagnostic for one it rejects.
type SyncTypes = PothosSchemaTypes.ExtendDefaultTypes<{
  PrismaTypes: PrismaTypes;
  Context: { tenantId: () => Promise<number> };
}>;
type AsyncSelectionError =
  'An async selection requires `AsyncSelections: true` in the schema types';

it('rejects each async callback shape', () => {
  expectTypeOf<
    CheckAsyncSelection<SyncTypes, () => Promise<UserSelect>>
  >().toEqualTypeOf<AsyncSelectionError>();

  // A union of callback types: distributing the verdict over it lets the synchronous member's
  // `unknown` absorb the async member's diagnostic.
  expectTypeOf<
    CheckAsyncSelection<SyncTypes, (() => UserSelect) | (() => Promise<UserSelect>)>
  >().toEqualTypeOf<AsyncSelectionError>();

  expectTypeOf<
    CheckAsyncSelection<SyncTypes, (() => UserSelect) | (() => ThenableUserSelect)>
  >().toEqualTypeOf<AsyncSelectionError>();

  // A selection the runtime awaits but `PromiseLike` does not describe.
  expectTypeOf<
    CheckAsyncSelection<SyncTypes, () => ThenableUserSelect>
  >().toEqualTypeOf<AsyncSelectionError>();
});

// Known gap. `infer` resolves an overloaded type to its last signature, and no pattern recovers
// the rest of them for an arbitrary overload count, so the async overload is not seen.
it('accepts an overloaded callback whose async overload is not the last', () => {
  expectTypeOf<CheckAsyncSelection<SyncTypes, typeof overloadedSelect>>().toBeUnknown();
});

it('accepts the synchronous shapes', () => {
  expectTypeOf<CheckAsyncSelection<SyncTypes, () => UserSelect>>().toBeUnknown();
  expectTypeOf<CheckAsyncSelection<SyncTypes, () => never>>().toBeUnknown();
  expectTypeOf<CheckAsyncSelection<SyncTypes, typeof declaredSyncUnionSelect>>().toBeUnknown();
  expectTypeOf<CheckAsyncSelection<SyncTypes, typeof genericSyncSelect>>().toBeUnknown();
  expectTypeOf<
    CheckAsyncSelection<
      SyncTypes,
      (() => { email: true }) | (() => { name: true }) | (() => { id: true }) | (() => UserSelect)
    >
  >().toBeUnknown();
  // Unchanged by the widening: a return type whose async-ness is erased stays accepted.
  expectTypeOf<CheckAsyncSelection<SyncTypes, () => unknown>>().toBeUnknown();
  expectTypeOf<CheckAsyncSelection<SyncTypes, <T>() => T>>().toBeUnknown();
  // A selection is not a callback, and is never asked about.
  expectTypeOf<CheckAsyncSelection<SyncTypes, UserSelect>>().toBeUnknown();
});

declare const info: GraphQLResolveInfo;
declare const flag: boolean;

it('returns a synchronous query from queryFromInfo by default', () => {
  expectTypeOf(queryFromInfo({ context: {}, info })).not.toMatchTypeOf<PromiseLike<unknown>>();
});

it('returns a MaybePromise from queryFromInfo with awaitSelections', () => {
  const query = queryFromInfo({ context: {}, info });

  expectTypeOf(queryFromInfo({ context: {}, info, awaitSelections: true })).toEqualTypeOf<
    MaybePromise<typeof query>
  >();
});

// A `boolean` that is neither literal infers as `boolean`, which `[Await] extends [false]` sends
// to the promise. The naive `Await extends true` would hand back the synchronous type instead.
it('returns a MaybePromise when awaitSelections is not a literal', () => {
  const query = queryFromInfo({ context: {}, info });

  expectTypeOf(queryFromInfo({ context: {}, info, awaitSelections: flag })).toEqualTypeOf<
    MaybePromise<typeof query>
  >();
});

declare const connectionArgs: PothosSchemaTypes.DefaultConnectionArguments;
declare const nodeSelection: (selection?: SelectionMap | true, path?: PathSegment[]) => unknown;

it('returns a synchronous query from getQuery by default', () => {
  expectTypeOf(
    commentHelpers.getQuery(connectionArgs, { tenantId: async () => 1 }, nodeSelection),
  ).not.toMatchTypeOf<PromiseLike<unknown>>();

  expectTypeOf(
    syncCommentHelpers.getQuery(connectionArgs, { tenantId: async () => 1 }, nodeSelection),
  ).not.toMatchTypeOf<PromiseLike<unknown>>();
});

it('returns a MaybePromise from getQuery with awaitSelections', () => {
  const ctx = { tenantId: async () => 1 };
  const query = commentHelpers.getQuery(connectionArgs, ctx, nodeSelection);

  expectTypeOf(
    commentHelpers.getQuery(connectionArgs, ctx, nodeSelection, { awaitSelections: true }),
  ).toEqualTypeOf<MaybePromise<typeof query>>();

  expectTypeOf(
    commentHelpers.getQuery(connectionArgs, ctx, nodeSelection, { awaitSelections: flag }),
  ).toEqualTypeOf<MaybePromise<typeof query>>();
});

// `awaitSelections` is orthogonal to the opt-in: it still governs the query boundary of a schema
// whose selections are synchronous.
it('returns a MaybePromise from getQuery with awaitSelections without the opt-in', () => {
  const ctx = { tenantId: async () => 1 };
  const query = syncCommentHelpers.getQuery(connectionArgs, ctx, nodeSelection);

  expectTypeOf(
    syncCommentHelpers.getQuery(connectionArgs, ctx, nodeSelection, { awaitSelections: true }),
  ).toEqualTypeOf<MaybePromise<typeof query>>();

  expectTypeOf(
    syncCommentHelpers.getQuery(connectionArgs, ctx, nodeSelection, { awaitSelections: flag }),
  ).toEqualTypeOf<MaybePromise<typeof query>>();
});
