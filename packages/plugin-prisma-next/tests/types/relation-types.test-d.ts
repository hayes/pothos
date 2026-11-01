import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import type {
  AggregateBuilder,
  Collection,
  DefaultModelRow,
} from '@prisma/orm-family-sql/orm-client';
import { expectTypeOf } from 'vitest';
import prismaNextPlugin, {
  type RelatedModel,
  type RelationKeys,
  type RelationQuery,
  type RelationWhere,
  type SelectObjectSpec,
} from '../../src';
import type { Contract } from '../fixtures/sample-contract';
import type { Contract as InheritanceContract } from '../inheritance/contract';

const builder = new SchemaBuilder<{
  PrismaNextContract: Contract;
  Scalars: { BigInt: { Input: bigint; Output: bigint } };
}>({
  plugins: [RelayPlugin, prismaNextPlugin],
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
      query: { where: (post) => post.published.eq(1), orderBy: (post) => post.id.asc(), limit: 2 },
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
    take: t.relation('posts', {
      // @ts-expect-error unknown query options are rejected
      query: { take: 1 },
    }),
    resolver: t.relation('posts', {
      // @ts-expect-error t.relation installs its own resolver
      resolve: () => [],
    }),
    count: t.relationCount('posts'),
    nullableCount: t.relationCount('posts', { nullable: true }),
    publishedCount: t.relationCount('posts', { where: { published: 1 } }),
    countByFlag: t.relationCount('posts', {
      args: { flag: t.arg.int({ required: true }) },
      where: (post, args, _ctx, tools) => {
        expectTypeOf(tools.fns).not.toBeAny();
        return post.published.eq(args.flag);
      },
    }),
    // @ts-expect-error `nope` isn't a relation on User
    badCount: t.relationCount('nope'),
    countMissingColumn: t.relationCount('posts', {
      // @ts-expect-error accessors only expose model fields
      where: (post) => post.missing.neq('x'),
    }),
    countUnknownOption: t.relationCount('posts', {
      // @ts-expect-error unknown options are rejected
      unknownOption: true,
    }),
  }),
});

builder.prismaObject('Post', {
  fields: (t) => ({
    author: t.relation('author', {
      query: {
        where: (user, tools) => {
          expectTypeOf(tools.fns).not.toBeAny();
          return user.id.neq('x');
        },
      },
    }),
    // @ts-expect-error relatedConnection takes a to-many relation
    authorPage: t.relatedConnection('author', { cursor: 'id' }),
    // A to-one relation has no function form: it needs combine(), which only to-many relations
    // have.
    authorName: t.string({
      // @ts-expect-error function form on a to-one relation
      select: { author: (author) => ({ rows: author.select('firstName') }) },
      resolve: () => '',
    }),
    authorNameCallback: t.string({
      // @ts-expect-error function form on a to-one relation
      select: () => ({ author: (author) => ({ rows: author.select('firstName') }) }),
      resolve: () => '',
    }),
  }),
});

builder.prismaObject('Post', {
  variant: 'AuthorRefinement',
  // @ts-expect-error function form on a to-one relation
  select: { author: (author) => ({ rows: author.select('firstName') }) },
  fields: () => ({}),
});

// The to-one function form is a branded error type, so its parameter names the problem.
type AuthorFunctionForm = Extract<
  NonNullable<SelectObjectSpec<Types, 'Post'>['author']>,
  (...args: never[]) => unknown
>;
expectTypeOf<AuthorFunctionForm>().toHaveProperty(
  'To-one relations take true or { where, orderBy, limit, offset }, not a function',
);
expectTypeOf<AuthorFunctionForm>().parameter(0).toEqualTypeOf<AuthorFunctionForm>();

builder.prismaObject('User', {
  variant: 'PostsRefinement',
  fields: (t) => ({
    postTitles: t.stringList({
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
          return { rows: posts.select('title') };
        },
      },
      resolve: (user) => user.rows.map((post) => post.title),
    }),
  }),
});

// Aggregates: the op and field come from the contract; `type` picks a lossless result scalar.
builder.prismaObject('User', {
  variant: 'Aggregates',
  fields: (t) => {
    const count = t.relationAggregate('posts', { op: 'count' });
    const countField = t.relationAggregate('posts', { op: 'count', field: 'title' });
    const nullableCount = t.relationAggregate('posts', { op: 'count', nullable: true });
    const sum = t.relationAggregate('posts', { op: 'sum', field: 'published' });
    const avg = t.relationAggregate('posts', { op: 'avg', field: 'score' });
    const requiredSum = t.relationAggregate('posts', {
      op: 'sum',
      field: 'score',
      nullable: false,
    });
    const countBigInt = t.relationAggregate('posts', { op: 'countBigInt', type: 'BigInt' });
    const sumBigInt = t.relationAggregate('posts', {
      op: 'sumBigInt',
      field: 'published',
      type: 'BigInt',
    });
    const minText = t.relationAggregate('posts', { op: 'min', field: 'title', type: 'String' });
    expectTypeOf(t.relationCount('posts').$inferType).toEqualTypeOf<number>();
    expectTypeOf(t.relationCount('posts', { nullable: true }).$inferType).toEqualTypeOf<
      number | null
    >();
    expectTypeOf(count.$inferType).toEqualTypeOf<number>();
    expectTypeOf(countField.$inferType).toEqualTypeOf<number>();
    expectTypeOf(nullableCount.$inferType).toEqualTypeOf<number | null>();
    expectTypeOf(sum.$inferType).toEqualTypeOf<number | null>();
    expectTypeOf(avg.$inferType).toEqualTypeOf<number | null>();
    expectTypeOf(requiredSum.$inferType).toEqualTypeOf<number>();
    expectTypeOf(countBigInt.$inferType).toEqualTypeOf<bigint>();
    expectTypeOf(sumBigInt.$inferType).toEqualTypeOf<bigint | null>();
    expectTypeOf(minText.$inferType).toEqualTypeOf<string | null>();
    // @ts-expect-error `sum` needs a field
    t.relationAggregate('posts', { op: 'sum' });
    // @ts-expect-error `title` isn't numeric
    t.relationAggregate('posts', { op: 'sum', field: 'title' });
    // @ts-expect-error `nope` isn't a column
    t.relationAggregate('posts', { op: 'count', field: 'nope' });
    // @ts-expect-error lossless results need a GraphQL scalar that accepts bigint
    t.relationAggregate('posts', { op: 'countBigInt' });
    // @ts-expect-error Float can't serialize bigint without a lossy conversion
    t.relationAggregate('posts', { op: 'countBigInt', type: 'Float' });
    // @ts-expect-error SQLite does not declare avgDecimal
    t.relationAggregate('posts', { op: 'avgDecimal', field: 'published', type: 'String' });
    // @ts-expect-error sumBigInt does not accept floating point fields
    t.relationAggregate('posts', { op: 'sumBigInt', field: 'score', type: 'BigInt' });
    // @ts-expect-error no scalar's Output is a Date, so `type` can't be satisfied
    t.relationAggregate('posts', { op: 'max', field: 'createdAt', type: 'String' });
    // @ts-expect-error a `where` callback returns a condition
    t.relationCount('posts', { where: () => 'oops' });
    // @ts-expect-error a `where` callback returns a condition
    t.relationAggregate('posts', { op: 'sum', field: 'published', where: () => ({}) });
    t.relationCount('posts', { where: (post) => post.published.eq(1) });
    return { count, sum, countBigInt };
  },
});

// A to-one relation is nullable when its contract relation is, as Bug.reviewer is.
const inheritance = new SchemaBuilder<{ PrismaNextContract: InheritanceContract }>({
  plugins: [prismaNextPlugin],
  prismaNext: { client: null as never },
});
inheritance.prismaObject('Bug', {
  select: { reviewer: true, owner: true },
  fields: (t) => ({
    names: t.string({
      resolve: (bug) => {
        expectTypeOf(bug.reviewer).toEqualTypeOf<DefaultModelRow<
          InheritanceContract,
          'User'
        > | null>();
        expectTypeOf(bug.owner).toEqualTypeOf<DefaultModelRow<InheritanceContract, 'User'>>();
        return '';
      },
    }),
  }),
});

// A to-one relation typed as a variant of its target filters out rows of other variants, so it
// is nullable unless `nullable` says otherwise.
const bugRef = inheritance.prismaObject('Bug', { variant: 'NoteBug', fields: () => ({}) });
const taskRef = inheritance.prismaObject('Task', { variant: 'NoteTask', fields: () => ({}) });
inheritance.prismaObject('Note', {
  fields: (t) => {
    const task = t.relation('task', { type: taskRef });
    expectTypeOf(task.$inferType).not.toBeNullable();
    const bug = t.relation('task', { type: bugRef });
    expectTypeOf(bug.$inferType).toBeNullable();
    const requiredBug = t.relation('task', { type: bugRef, nullable: false });
    expectTypeOf(requiredBug.$inferType).not.toBeNullable();
    return { task, bug, requiredBug };
  },
});

// A relation field's shape is the related rows. A `query` can filter a to-one relation's row out,
// so it makes the field nullable unless `nullable` says otherwise.
builder.prismaObject('Post', {
  variant: 'RelationShapes',
  fields: (t) => {
    const author = t.relation('author');
    expectTypeOf(author.$inferType).toEqualTypeOf<DefaultModelRow<Contract, 'User'>>();
    const filtered = t.relation('author', { query: { where: { firstName: 'Alice' } } });
    expectTypeOf(filtered.$inferType).toEqualTypeOf<DefaultModelRow<Contract, 'User'> | null>();
    const byArgs = t.relation('author', {
      args: { name: t.arg.string({ required: true }) },
      query: (args) => ({ where: { firstName: args.name } }),
    });
    expectTypeOf(byArgs.$inferType).toEqualTypeOf<DefaultModelRow<Contract, 'User'> | null>();
    const required = t.relation('author', {
      nullable: false,
      query: { where: { firstName: 'Alice' } },
    });
    expectTypeOf(required.$inferType).toEqualTypeOf<DefaultModelRow<Contract, 'User'>>();
    const comments = t.relation('comments', { query: { limit: 2 } });
    expectTypeOf(comments.$inferType).toEqualTypeOf<
      readonly DefaultModelRow<Contract, 'Comment'>[]
    >();
    const commentPage = t.relatedConnection('comments', { cursor: 'id' });
    // Nullable as the relay plugin makes it: by the builder's default field nullability.
    expectTypeOf(commentPage.$inferType).toBeNullable();
    expectTypeOf(commentPage.$inferType!.edges).not.toBeUnknown();
    return {
      author,
      filtered,
      byArgs,
      required,
      comments,
      commentPage,
      extraKey: t.relation('comments', {
        // @ts-expect-error `take` isn't a query option, even beside a valid one
        query: { where: { body: 'x' }, take: 1 },
      }),
    };
  },
});
