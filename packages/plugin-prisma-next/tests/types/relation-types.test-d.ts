import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import type {
  AggregateBuilder,
  Collection,
  DefaultModelRow,
} from '@prisma/orm-family-sql/orm-client';
import type { SqliteClient } from '@prisma/orm-sqlite/runtime';
import { expectTypeOf } from 'vitest';
import PrismaNextPlugin, {
  type OnNullRequired,
  type PlannedRowBrand,
  type RelatedModel,
  type RelationKeys,
  type RelationQuery,
  type RelationWhere,
  type SelectObjectSpec,
} from '../../src';
import type { QueryAsyncCheck, RelationWithoutOptionsCheck } from '../../src/types/relations';
import type { SelectCheck } from '../../src/types/selections';
import type { Contract } from '../fixtures/sample-contract';
import type { Contract as InheritanceContract } from '../inheritance/contract';
import type { Contract as MysqlContract } from '../mysql/contract';

const builder = new SchemaBuilder<{
  PrismaNextContract: Contract;
  Scalars: { BigInt: { Input: bigint; Output: bigint } };
}>({
  plugins: [RelayPlugin, PrismaNextPlugin],
  relay: {},
  prismaNext: { client: null as never },
});

// The helper types are exported for writing reusable options.
type Types = PothosSchemaTypes.ExtendDefaultTypes<{ PrismaNextContract: Contract }>;
expectTypeOf<RelationKeys<Types, 'User'>>().toEqualTypeOf<'posts' | 'comments'>();
expectTypeOf<RelatedModel<Types, 'User', 'posts'>>().toEqualTypeOf<'Post'>();
const publishedOnly: RelationWhere<Types, 'Post'> = { published: 1 };
const firstTwo: RelationQuery<Types, 'User', 'posts', {}> = { where: publishedOnly, limit: 2 };
expectTypeOf({ email: true, posts: firstTwo } as const).toExtend<SelectObjectSpec<Types, 'User'>>();
// @ts-expect-error `nope` isn't a column or relation of User
expectTypeOf<SelectObjectSpec<Types, 'User'>>().toHaveProperty('nope');

builder.prismaObject('User', {
  fields: (t) => ({
    posts: t.relation('posts', {
      query: { where: (post) => post.published.eq(1), orderBy: { id: 'asc' }, limit: 2 },
    }),
    filtered: t.relation('posts', {
      args: { published: t.arg.int({ required: true }) },
      query: (args) => ({ where: { published: args.published } }),
    }),
    // @ts-expect-error `pets` isn't a relation on User
    pets: t.relation('pets'),
    badWhere: t.relation('posts', {
      // @ts-expect-error `nonexistent` isn't a column on Post
      query: { where: (post) => post.nonexistent.eq(1) },
    }),
    badShorthand: t.relation('posts', {
      // @ts-expect-error `draft` isn't a column on Post
      query: { where: { draft: 1 } },
    }),
    noQueryFromCallback: t.relation('posts', {
      args: { first: t.arg.boolean() },
      query: (args) => (args.first ? { limit: 1 } : undefined),
    }),
    alwaysUndefinedQuery: t.relation('posts', { query: () => undefined }),
    takeInCallback: t.relation('posts', {
      // @ts-expect-error unknown query options are rejected in a callback's result too
      query: () => ({ where: { published: 1 }, take: 1 }),
    }),
    takeInOneBranch: t.relation('posts', {
      args: { first: t.arg.boolean() },
      // @ts-expect-error every branch of a callback is checked
      query: (args) => (args.first ? { take: 1 } : { where: { published: 1 } }),
    }),
    conditionalCallback: t.relation('posts', {
      args: { first: t.arg.boolean() },
      query: (args, _ctx) => {
        expectTypeOf(args.first).toEqualTypeOf<boolean | null | undefined>();
        return args.first
          ? { limit: 1 }
          : { where: (post) => post.published.eq(1), orderBy: { id: 'asc' } };
      },
    }),
    take: t.relation('posts', {
      // @ts-expect-error unknown query options are rejected
      query: { take: 1 },
    }),
    resolver: t.relation('posts', {
      // @ts-expect-error t.relation installs its own resolver
      resolve: () => [],
    }),
    count: t.relationCount('posts'),
    // @ts-expect-error a count is never null
    nullableCount: t.relationCount('posts', { nullable: true }),
    publishedCount: t.relationCount('posts', { query: { where: { published: 1 } } }),
    countByFlag: t.relationCount('posts', {
      args: { flag: t.arg.int({ required: true }) },
      query: (args) => ({
        where: (post, tools) => {
          expectTypeOf(tools.fns).not.toBeAny();
          return post.published.eq(args.flag);
        },
      }),
    }),
    // @ts-expect-error `nope` isn't a relation on User
    badCount: t.relationCount('nope'),
    countMissingColumn: t.relationCount('posts', {
      // @ts-expect-error accessors only expose model fields
      query: { where: (post) => post.missing.neq('x') },
    }),
    countUnknownOption: t.relationCount('posts', {
      // @ts-expect-error unknown options are rejected
      unknownOption: true,
    }),
  }),
});

builder.prismaObject('Post', {
  fields: (t) => ({
    author: t.relation('author'),
    // @ts-expect-error relatedConnection takes a to-many relation
    authorPage: t.relatedConnection('author', {}),
    // A to-one relation has no function form: it needs combine(), which only to-many relations
    // have.
    authorName: t.string({
      // @ts-expect-error function form on a to-one relation
      select: { author: (author: never) => author },
      resolve: () => '',
    }),
    authorNameCallback: t.string({
      // @ts-expect-error a computed value reads a to-many relation
      select: () => ({ rows: { author: (author: never) => author } }),
      resolve: () => '',
    }),
  }),
});

builder.prismaObject('Post', {
  variant: 'AuthorRefinement',
  // @ts-expect-error function form on a to-one relation
  select: { author: (author: never) => author },
  fields: () => ({}),
});

// A to-one relation takes only `type` and `select`.
builder.prismaObject('Post', {
  variant: 'FilteredAuthorInTypeSelect',
  // @ts-expect-error a select can't filter a to-one relation
  select: { author: { where: { id: 'x' } } },
  fields: () => ({}),
});
expectTypeOf<
  keyof SelectCheck<Types, 'Post', { author: { where: { id: 'x' } } }, 'type'>
>().toEqualTypeOf<'Unknown key in select: author.where'>();
expectTypeOf<
  keyof SelectCheck<Types, 'Post', { author: { limit: 1 } }, 'field'>
>().toEqualTypeOf<'Unknown key in select: author.limit'>();
expectTypeOf<
  keyof SelectCheck<Types, 'Post', { author: { nope: 1 } }, 'type'>
>().toEqualTypeOf<'Unknown key in select: author.nope'>();
expectTypeOf<
  SelectCheck<Types, 'Post', { author: { select: { email: true } } }, 'type'>
>().toEqualTypeOf<unknown>();
// Functions are aggregates of a to-many relation, in a field's select only.
expectTypeOf<SelectCheck<Types, 'Post', { author: () => {} }, 'field'>>().toEqualTypeOf<{
  'Invalid value in select: author': never;
}>();
expectTypeOf<
  SelectCheck<Types, 'User', { posts: (sub: never) => never }, 'field'>
>().toEqualTypeOf<{
  'Invalid value in select: posts': never;
}>();
expectTypeOf<
  SelectCheck<Types, 'User', { posts: (posts: { count(): never }) => {} }, 'type'>
>().toEqualTypeOf<{ 'Invalid value in select: posts': never }>();
expectTypeOf<
  SelectCheck<Types, 'Post', { title: { comments: (sub: never) => never } }, 'field'>
>().toEqualTypeOf<{ 'Invalid value in select: title': never }>();
expectTypeOf<
  keyof SelectCheck<Types, 'User', { emial: true }, 'field'>
>().toEqualTypeOf<'Unknown key in select: emial'>();

builder.prismaObject('User', {
  variant: 'PostsRefinement',
  fields: (t) => ({
    postTitles: t.int({
      select: {
        posts: (posts) => {
          // @ts-expect-error mutation terminals can't run inside an include refinement
          posts.createAndCount({});
          // @ts-expect-error firstOrThrow is a terminal
          posts.firstOrThrow();
          // @ts-expect-error whereUnique is unavailable inside an include refinement
          posts.whereUnique({ id: 'x' });
          // The refinement surface is upstream's include callback parameter, read rather than
          // restated, so drift in either direction fails here. Upstream's cardinality is an
          // unresolved generic, which reads as the to-one surface; to-many adds the aggregate
          // methods and combine().
          type IncludeOverload<F> = F extends {
            (...args: never[]): unknown;
            (this: never, name: never, refine: (collection: infer Refine) => never): unknown;
          }
            ? Refine
            : never;
          type Upstream = keyof IncludeOverload<Collection<Contract, 'User'>['include']> & string;
          type ToManyOnly = keyof AggregateBuilder<Contract, 'Post'> | 'combine';
          type Plugin = keyof typeof posts & string;
          expectTypeOf<Exclude<Plugin, Upstream | ToManyOnly>>().toEqualTypeOf<never>();
          expectTypeOf<Exclude<Upstream, Plugin>>().toEqualTypeOf<never>();
          expectTypeOf<Upstream>().not.toEqualTypeOf<never>();
          expectTypeOf<Exclude<ToManyOnly, Plugin>>().toEqualTypeOf<never>();
          return { published: posts.where({ published: 1 }).count() };
        },
      },
      resolve: (user) => user.published,
    }),
  }),
});

// Counts are `Int`, and `query` takes a `where` or a callback of the args and context returning one.
builder.prismaObject('User', {
  variant: 'Aggregates',
  fields: (t) => {
    const count = t.relationCount('posts');
    expectTypeOf(count.$inferType).toEqualTypeOf<number>();
    // @ts-expect-error a count is never null
    t.relationCount('posts', { nullable: true });
    // `nullable: false` states what a count is, as in plugin-prisma.
    t.relationCount('posts', { nullable: false });
    t.relationCount('posts', { query: { where: { published: 1 } } });
    t.relationCount('posts', { query: { where: (post) => post.published.eq(1) } });
    t.relationCount('posts', { query: () => ({ where: (post) => post.published.eq(1) }) });
    t.relationCount('posts', { query: () => ({ where: { published: 1 } }) });
    t.relationCount('posts', {
      args: { published: t.arg.int() },
      query: (args) =>
        args.published == null ? undefined : { where: { published: args.published } },
    });
    // @ts-expect-error a `query` callback returns a query
    t.relationCount('posts', { query: () => 'oops' });
    // @ts-expect-error a count takes only a `where`
    t.relationCount('posts', { query: { where: { published: 1 }, limit: 1 } });
    // @ts-expect-error a count takes only a `where`, from a callback too
    t.relationCount('posts', { query: () => ({ orderBy: { id: 'asc' } }) });
    // @ts-expect-error unknown columns in a shorthand where are rejected
    t.relationCount('posts', { query: { where: { draft: 1 } } });
    // @ts-expect-error unknown columns in a callback's shorthand where are rejected
    t.relationCount('posts', { query: () => ({ where: { draft: 1 } }) });
    // @ts-expect-error `where` goes inside `query`
    t.relationCount('posts', { where: { published: 1 } });
    // @ts-expect-error a count is of a to-many relation
    t.relationCount('author');
    return { count };
  },
});

// A target without aggregates, such as MySQL, can't count, and the error says so.
const mysql = new SchemaBuilder<{ PrismaNextContract: MysqlContract }>({
  plugins: [PrismaNextPlugin],
  prismaNext: { client: null as never },
});
mysql.prismaObject('Author', {
  fields: (t) => ({
    // '"books"' is not assignable to 'relationCount runs a count aggregate, which this target
    // (MySQL) lacks'
    // @ts-expect-error a count needs aggregates
    bookCount: t.relationCount('books'),
  }),
});

// A to-one relation is nullable when its contract relation is, as Bug.reviewer is. A variant's own
// relation loads only in a field's select.
const inheritance = new SchemaBuilder<{ PrismaNextContract: InheritanceContract }>({
  plugins: [PrismaNextPlugin],
  prismaNext: { client: null as never },
});
inheritance.prismaObject('Bug', {
  variant: 'ReviewedBug',
  // @ts-expect-error a variant's own relation loads only in a field's select
  select: { reviewer: true },
});
inheritance.prismaObject('Bug', {
  select: { owner: true },
  fields: (t) => ({
    names: t.string({
      select: { reviewer: true },
      resolve: (bug) => {
        expectTypeOf(bug.reviewer).toEqualTypeOf<
          (DefaultModelRow<InheritanceContract, 'User'> & PlannedRowBrand<'User'>) | null
        >();
        expectTypeOf(bug.owner).toEqualTypeOf<
          DefaultModelRow<InheritanceContract, 'User'> & PlannedRowBrand<'User'>
        >();
        return '';
      },
    }),
  }),
});

// Relation fields follow the builder's default field nullability, never the contract's. A non-null
// field over a relation that can be null needs `onNull`.
const strict = new SchemaBuilder<{
  PrismaNextContract: InheritanceContract;
  DefaultFieldNullability: false;
}>({
  plugins: [PrismaNextPlugin],
  prismaNext: { client: null as never },
  defaultFieldNullability: false,
});
type StrictTypes = PothosSchemaTypes.ExtendDefaultTypes<{
  PrismaNextContract: InheritanceContract;
  DefaultFieldNullability: false;
}>;
// Called with only a name, the name's error says why `onNull` is required.
expectTypeOf<RelationWithoutOptionsCheck<StrictTypes, 'Bug', 'reviewer'>>().toEqualTypeOf<
  OnNullRequired<'Bug.reviewer can be null'>
>();
expectTypeOf<RelationWithoutOptionsCheck<StrictTypes, 'Bug', 'owner'>>().toEqualTypeOf<unknown>();
expectTypeOf<
  RelationWithoutOptionsCheck<StrictTypes, 'Bug', 'owner' | 'reviewer'>
>().toEqualTypeOf<unknown>();
const strictBug = strict.prismaObject('Bug', { variant: 'StrictBug', fields: () => ({}) });
const strictTask = strict.prismaObject('Task', { variant: 'StrictTask', fields: () => ({}) });
strict.prismaObject('User', { variant: 'StrictUser', fields: () => ({}) });
strict.prismaObject('Bug', {
  variant: 'StrictBugRelations',
  fields: (t) => {
    const owner = t.relation('owner');
    expectTypeOf(owner.$inferType).not.toBeNullable();
    const errorOnNull = t.relation('reviewer', { onNull: 'error' });
    expectTypeOf(errorOnNull.$inferType).not.toBeNullable();
    const fallback = t.relation('reviewer', {
      onNull: (bug, _args, _ctx, info) => {
        expectTypeOf(bug.id).toEqualTypeOf<string>();
        expectTypeOf(info.fieldName).toEqualTypeOf<string>();
        return new Error('no reviewer');
      },
    });
    const nullable = t.relation('reviewer', { nullable: true });
    expectTypeOf(nullable.$inferType).toBeNullable();
    // Variant fields follow the default too, and `isNull` needs the field nullable.
    const variant = t.variant(strictBug);
    expectTypeOf(variant.$inferType).not.toBeNullable();
    const maybeVariant = t.variant(strictBug, { nullable: true, isNull: () => false });
    expectTypeOf(maybeVariant.$inferType).toBeNullable();
    return {
      owner,
      variant,
      maybeVariant,
      // @ts-expect-error RequiresNullable<'isNull can resolve the field to null'>
      strictVariant: t.variant(strictBug, { isNull: () => false }),
      errorOnNull,
      fallback,
      nullable,
      // @ts-expect-error OnNullRequired<'Bug.reviewer can be null'>
      reviewer: t.relation('reviewer'),
      // @ts-expect-error an unknown relation fails as itself, not as needing `onNull`
      typo: t.relation('nope'),
      // @ts-expect-error OnNullRequired<'Bug.reviewer can be null'>
      explicit: t.relation('reviewer', { nullable: false }),
      // @ts-expect-error `onNull` returns a related row or an error
      badFallback: t.relation('reviewer', { onNull: () => 'nope' }),
    };
  },
});
strict.prismaObject('User', {
  variant: 'StrictUserLists',
  fields: (t) => {
    const tasks = t.relation('tasks');
    expectTypeOf(tasks.$inferType).not.toBeNullable();
    return { tasks };
  },
});
strict.prismaObject('Note', {
  fields: (t) => {
    const task = t.relation('task', { type: strictTask });
    expectTypeOf(task.$inferType).not.toBeNullable();
    // A variant `type` filters out rows of other variants, so the relation can be null.
    const errorBug = t.relation('task', { type: strictBug, onNull: 'error' });
    expectTypeOf(errorBug.$inferType).not.toBeNullable();
    const bug = t.relation('task', { type: strictBug, nullable: true });
    expectTypeOf(bug.$inferType).toBeNullable();
    return {
      task,
      errorBug,
      bug,
      // @ts-expect-error OnNullRequired<'Bug filters out other variants of Note.task'>
      requiredBug: t.relation('task', { type: strictBug }),
      // `onNull` is rejected where it's never used.
      // @ts-expect-error OnNullUnused<"Note.task can't be null">
      neverNull: t.relation('task', { type: strictTask, onNull: 'error' }),
      // @ts-expect-error OnNullUnused<'the field is nullable'>
      nullableBug: t.relation('task', { type: strictBug, nullable: true, onNull: 'error' }),
    };
  },
});

// With the default nullable fields, relations are nullable whatever the contract says.
const bugRef = inheritance.prismaObject('Bug', { variant: 'NoteBug', fields: () => ({}) });
inheritance.prismaObject('Note', {
  fields: (t) => {
    const bug = t.relation('task', { type: bugRef });
    expectTypeOf(bug.$inferType).toBeNullable();
    const requiredBug = t.relation('task', { type: bugRef, nullable: false, onNull: 'error' });
    expectTypeOf(requiredBug.$inferType).not.toBeNullable();
    return {
      bug,
      requiredBug,
      // @ts-expect-error OnNullUnused<'the field is nullable'>
      nullable: t.relation('task', { type: bugRef, onNull: 'error' }),
    };
  },
});

// A relation field's shape is the related rows.
builder.prismaObject('Post', {
  variant: 'RelationShapes',
  fields: (t) => {
    const author = t.relation('author', { nullable: false });
    expectTypeOf(author.$inferType).toEqualTypeOf<
      DefaultModelRow<Contract, 'User'> & PlannedRowBrand<'User'>
    >();
    const nullable = t.relation('author');
    expectTypeOf(nullable.$inferType).toEqualTypeOf<
      (DefaultModelRow<Contract, 'User'> & PlannedRowBrand<'User'>) | null
    >();
    const comments = t.relation('comments', { query: { limit: 2 } });
    expectTypeOf(comments.$inferType).toEqualTypeOf<
      readonly (DefaultModelRow<Contract, 'Comment'> & PlannedRowBrand<'Comment'>)[] | null
    >();
    const commentPage = t.relatedConnection('comments', {});
    // Nullable as the relay plugin makes it: by the builder's default field nullability.
    expectTypeOf(commentPage.$inferType).toBeNullable();
    expectTypeOf(commentPage.$inferType!.edges).not.toBeUnknown();
    return {
      author,
      nullable,
      comments,
      commentPage,
      extraKey: t.relation('comments', {
        // @ts-expect-error `take` isn't a query option, even beside a valid one
        query: { where: { body: 'x' }, take: 1 },
      }),
    };
  },
});

// A relation's `type` may be a prismaInterface ref, as it may be a prismaObject ref.
const NamedUser = builder.prismaInterface('User', {
  variant: 'NamedUser',
  select: ['firstName'],
  fields: (t) => ({ firstName: t.exposeString('firstName') }),
});
const NamedPost = builder.prismaInterface('Post', {
  variant: 'NamedPost',
  fields: (t) => ({ title: t.exposeString('title') }),
});
builder.prismaObject('Post', {
  variant: 'WithInterfaceAuthor',
  fields: (t) => ({
    author: t.relation('author', { type: NamedUser }),
    // @ts-expect-error `author` is a User, not a Post
    wrongModel: t.relation('author', { type: NamedPost }),
  }),
});
builder.prismaObject('User', {
  variant: 'WithInterfacePosts',
  fields: (t) => ({
    posts: t.relation('posts', { type: NamedPost }),
    page: t.relatedConnection('posts', { type: NamedPost }),
    // @ts-expect-error `posts` are Posts, not Users
    wrongPage: t.relatedConnection('posts', { type: NamedUser }),
  }),
});

// A to-many relation's `query` callback may return a refinement of the relation's collection,
// which can apply fragments.
declare const sqliteClient: SqliteClient<Contract>;
const publishedFragment = sqliteClient.orm.Post.fragment((posts) => posts.where({ published: 1 }));
builder.prismaObject('User', {
  variant: 'RefinedQueries',
  fields: (t) => ({
    refined: t.relation('posts', {
      query: () => (posts) => posts.where({ published: 1 }).orderBy((post) => post.title.asc()),
    }),
    withArgs: t.relation('posts', {
      args: { published: t.arg.int({ required: true }) },
      query: (args) => (posts) => posts.where({ published: args.published }),
    }),
    fragment: t.relation('posts', { query: () => (posts) => posts.with(publishedFragment) }),
    // @ts-expect-error a refinement returns the relation's collection
    notCollection: t.relation('posts', { query: () => () => 'nope' }),
    // @ts-expect-error a refinement of another model's collection
    otherModel: t.relation('posts', { query: () => () => sqliteClient.orm.User }),
  }),
});

// A to-one relation is loaded whole, so it takes no `query`.
builder.prismaObject('Post', {
  variant: 'ToOneQueries',
  fields: (t) => ({
    // @ts-expect-error A to-one relation takes no query: author
    where: t.relation('author', { query: { where: { firstName: 'Alice' } } }),
    // @ts-expect-error A to-one relation takes no query: author
    whereCallback: t.relation('author', { query: () => ({ where: { firstName: 'Alice' } }) }),
    // @ts-expect-error A to-one relation takes no query: author
    limited: t.relation('author', { query: { limit: 1 } }),
    // @ts-expect-error a to-one relation takes no refinement
    refined: t.relation('author', { query: () => (author: unknown) => author }),
  }),
});
expectTypeOf<RelationQuery<Types, 'Post', 'author', {}>>().toEqualTypeOf<{
  readonly 'A to-one relation takes no query: author': never;
}>();

// Async `select`, `query` and count `query` callbacks need `AsyncSelections: true`.
builder.prismaObject('User', {
  variant: 'SyncSelections',
  fields: (t) => ({
    // @ts-expect-error an async query needs AsyncSelections
    asyncQuery: t.relation('posts', { query: async () => ({ where: { published: 1 } }) }),
    asyncCount: t.relationCount('posts', {
      // @ts-expect-error an async query needs AsyncSelections
      query: async () => ({ where: { published: 1 } }),
    }),
    asyncCountWithArgs: t.relationCount('posts', {
      args: { published: t.arg.int({ required: true }) },
      // @ts-expect-error an async query needs AsyncSelections, with typed parameters too
      query: async (args) => ({ where: { published: args.published } }),
    }),
    // @ts-expect-error an async select needs AsyncSelections
    asyncSelect: t.string({ select: async () => ({ email: true }), resolve: () => '' }),
  }),
});
// A callback returning `any`, such as the ORM's predicate passed as the query, fails as itself
// (its parameter is the args) rather than as an async query. A real async callback still does.
expectTypeOf<
  QueryAsyncCheck<Types, (args: {}) => ReturnType<typeof JSON.parse>>
>().toEqualTypeOf<unknown>();
expectTypeOf<
  QueryAsyncCheck<Types, () => Promise<{ where: {} }>>
>().toEqualTypeOf<'An async selection requires `AsyncSelections: true` in the schema types'>();
builder.prismaObject('Post', {
  variant: 'PredicateAsQuery',
  fields: (t) => ({
    // @ts-expect-error the args have no `body`: the predicate goes in `where`
    count: t.relationCount('comments', { query: (c) => c.body.eq('x') }),
    // @ts-expect-error the args have no `body`: the predicate goes in `where`
    rows: t.relation('comments', { query: (c) => c.body.eq('x') }),
  }),
});
// A count's `query` callback takes the args and context. The ORM's predicate passed as the query
// reads the args as the row, and is rejected.
builder.prismaObject('Post', {
  variant: 'CountPredicate',
  fields: (t) => ({
    predicate: t.relationCount('comments', { query: { where: (c) => c.body.eq('x') } }),
    // @ts-expect-error the predicate goes in `where`: `query: { where: (c) => ... }`
    directPredicate: t.relationCount('comments', { query: (c) => c.body.eq('x') }),
  }),
});

const asyncBuilder = new SchemaBuilder<{ PrismaNextContract: Contract; AsyncSelections: true }>({
  plugins: [RelayPlugin, PrismaNextPlugin],
  relay: {},
  prismaNext: { client: null as never },
});
asyncBuilder.prismaObject('User', {
  fields: (t) => ({
    asyncQuery: t.relation('posts', { query: async () => ({ where: { published: 1 } }) }),
    asyncRefinement: t.relation('posts', {
      query: async () => (posts) => posts.where({ published: 1 }),
    }),
    asyncCount: t.relationCount('posts', { query: async () => ({ where: { published: 1 } }) }),
    asyncSelect: t.string({
      select: async () => ({ email: true }),
      resolve: (user) => user.email,
    }),
    // @ts-expect-error unknown query keys are rejected in an async result too
    asyncUnknown: t.relation('posts', { query: async () => ({ nope: 1 }) }),
  }),
});
